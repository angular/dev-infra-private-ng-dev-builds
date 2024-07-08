/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import inquirer from 'inquirer';
import { bold, green, Log, red, yellow } from '../../utils/logging.js';
import { getCaretakerNotePromptMessage, getTargetedBranchesConfirmationPromptMessage, getTargetedBranchesMessage, } from './messages.js';
import { loadAndValidatePullRequest } from './pull-request.js';
import { GithubApiMergeStrategy } from './strategies/api-merge.js';
import { AutosquashMergeStrategy } from './strategies/autosquash-merge.js';
import { assertValidReleaseConfig } from '../../release/config/index.js';
import { ActiveReleaseTrains, fetchLongTermSupportBranchesFromNpm, getNextBranchName, } from '../../release/versioning/index.js';
import { Prompt } from '../../utils/prompt.js';
import { FatalMergeToolError, PullRequestValidationError, UserAbortedMergeToolError, } from './failures.js';
import { createPullRequestValidationConfig } from '../common/validation/validation-config.js';
const defaultPullRequestMergeFlags = {
    branchPrompt: true,
    forceManualBranches: false,
    dryRun: false,
    ignorePendingReviews: false,
};
/**
 * Class that accepts a merge script configuration and Github token. It provides
 * a programmatic interface for merging multiple pull requests based on their
 * labels that have been resolved through the merge script configuration.
 */
export class MergeTool {
    constructor(config, git, flags) {
        this.config = config;
        this.git = git;
        // Update flags property with the provided flags values as patches to the default flag values.
        this.flags = { ...defaultPullRequestMergeFlags, ...flags };
    }
    /**
     * Merges the given pull request and pushes it upstream.
     * @param prNumber Pull request that should be merged.
     * @param partialValidationConfig Pull request validation config. Can be modified to skip
     *   certain non-fatal validations.
     */
    async merge(prNumber, partialValidationConfig) {
        /** The full validation config, using the provided config from flags, config and defaults. */
        const validationConfig = createPullRequestValidationConfig({
            ...this.config.pullRequest.validators,
            ...partialValidationConfig,
        });
        if (this.git.hasUncommittedChanges()) {
            throw new FatalMergeToolError('Local working repository not clean. Please make sure there are ' +
                'no uncommitted changes.');
        }
        if (this.git.isShallowRepo()) {
            throw new FatalMergeToolError(`Unable to perform merge in a local repository that is configured as shallow.\n` +
                `Please convert the repository to a complete one by syncing with upstream.\n` +
                `https://git-scm.com/docs/git-fetch#Documentation/git-fetch.txt---unshallow`);
        }
        await this.confirmMergeAccess();
        const pullRequest = await loadAndValidatePullRequest(this, prNumber, validationConfig);
        if (pullRequest.validationFailures.length > 0) {
            Log.error(`Pull request did not pass one or more validation checks. Error:`);
            for (const failure of pullRequest.validationFailures) {
                Log.error(` -> ${bold(failure.message)}`);
            }
            Log.info();
            if (pullRequest.validationFailures.some((failure) => !failure.canBeForceIgnored)) {
                Log.debug('Discovered a fatal error, which cannot be forced');
                throw new PullRequestValidationError();
            }
            Log.info(yellow(`All discovered validations are non-fatal and can be forcibly ignored.`));
            if (!(await Prompt.confirm('Do you want to forcibly ignore these validation failures?'))) {
                throw new PullRequestValidationError();
            }
        }
        if (this.flags.forceManualBranches) {
            await this.updatePullRequestTargetedBranchesFromPrompt(pullRequest);
        }
        // If the pull request has a caretaker note applied, raise awareness by prompting
        // the caretaker. The caretaker can then decide to proceed or abort the merge.
        if (pullRequest.hasCaretakerNote &&
            !(await Prompt.confirm(getCaretakerNotePromptMessage(pullRequest)))) {
            throw new UserAbortedMergeToolError();
        }
        const strategy = this.config.pullRequest.githubApiMerge
            ? new GithubApiMergeStrategy(this.git, this.config.pullRequest.githubApiMerge)
            : new AutosquashMergeStrategy(this.git);
        // Branch or revision that is currently checked out so that we can switch back to
        // it once the pull request has been merged.
        const previousBranchOrRevision = this.git.getCurrentBranchOrRevision();
        // The following block runs Git commands as child processes. These Git commands can fail.
        // We want to capture these command errors and return an appropriate merge request status.
        try {
            // Run preparations for the merge (e.g. fetching branches).
            await strategy.prepare(pullRequest);
            // Print the target branches.
            Log.info();
            Log.info(getTargetedBranchesMessage(pullRequest));
            // Check for conflicts between the pull request and target branches.
            await strategy.check(pullRequest);
            Log.info('');
            Log.info(green(`     PR: ${bold(pullRequest.title)}`));
            Log.info(green(`  ✓  Pull request can be merged into all target branches.`));
            Log.info();
            if (this.flags.dryRun) {
                Log.info(green(`  ✓  Exiting due to dry run mode.`));
                return;
            }
            if (
            // If there is no target labeling then the pull request is always just directly merged, so
            // the confirmation can be skipped.
            !this.config.pullRequest.__noTargetLabeling &&
                // In cases where manual branch targeting is used, the user already confirmed.
                !this.flags.forceManualBranches &&
                this.flags.branchPrompt &&
                !(await Prompt.confirm(getTargetedBranchesConfirmationPromptMessage()))) {
                throw new UserAbortedMergeToolError();
            }
            // Perform the merge and pass-through potential failures.
            await strategy.merge(pullRequest);
            Log.info(green(`  ✓  Successfully merged the pull request: #${prNumber}`));
        }
        finally {
            // Switch back to the previous branch. We need to do this before deleting the temporary
            // branches because we cannot delete branches which are currently checked out.
            this.git.run(['checkout', '-f', previousBranchOrRevision]);
            await strategy.cleanup(pullRequest);
        }
    }
    /**
     * Modifies the pull request in place with new target branches based on user
     * selection from the available active branches.
     */
    async updatePullRequestTargetedBranchesFromPrompt(pullRequest) {
        const { name: repoName, owner } = this.config.github;
        // Attempt to retrieve the active LTS branches to be included in the selection.
        let ltsBranches = [];
        try {
            assertValidReleaseConfig(this.config);
            const ltsBranchesFromNpm = await fetchLongTermSupportBranchesFromNpm(this.config.release);
            ltsBranches = ltsBranchesFromNpm.active.map(({ name, version }) => ({
                branchName: name,
                version,
            }));
        }
        catch {
            Log.warn('Unable to determine the active LTS branches as a release config is not set for this repo.');
        }
        // Gather the current active release trains.
        const { latest, next, releaseCandidate } = await ActiveReleaseTrains.fetch({
            name: repoName,
            nextBranchName: getNextBranchName(this.config.github),
            owner,
            api: this.git.github,
        });
        // Collate the known active branches into a single list.
        const activeBranches = [
            next,
            latest,
            ...ltsBranches,
        ];
        if (releaseCandidate !== null) {
            // Since the next version will always be the primary github branch rather than semver, the RC
            // branch should be included as the second item in the list.
            activeBranches.splice(1, 0, releaseCandidate);
        }
        const { selectedBranches, confirm } = await inquirer.prompt([
            {
                type: 'checkbox',
                choices: activeBranches.map(({ branchName, version }) => {
                    return {
                        checked: pullRequest.targetBranches.includes(branchName),
                        value: branchName,
                        short: branchName,
                        name: `${branchName} (${version})${branchName === pullRequest.githubTargetBranch ? ' [Targeted via Github UI]' : ''}`,
                    };
                }),
                message: 'Select branches to merge pull request into:',
                name: 'selectedBranches',
            },
            {
                type: 'confirm',
                default: false,
                message: red('!!!!!! WARNING !!!!!!!\n') +
                    yellow('Using manual branch selection disables protective checks provided by the merge ' +
                        'tooling. This means that the merge tooling will not prevent changes which are not ' +
                        'allowed for the targeted branches. Please proceed with caution.\n') +
                    'Are you sure you would like to proceed with the selected branches?',
                name: 'confirm',
            },
        ]);
        if (confirm === false) {
            throw new UserAbortedMergeToolError();
        }
        // The Github Targeted branch must always be selected. It is not currently possible
        // to make a readonly selection in inquirer's checkbox.
        if (!selectedBranches.includes(pullRequest.githubTargetBranch)) {
            throw new FatalMergeToolError(`Pull Requests must merge into their targeted Github branch. If this branch (${pullRequest.githubTargetBranch}) ` +
                'should not be included, please change the targeted branch via the Github UI.');
        }
        pullRequest.targetBranches = selectedBranches;
    }
    async confirmMergeAccess() {
        if (this.git.userType === 'user') {
            // Check whether the given Github token has sufficient permissions for writing
            // to the configured repository. If the repository is not private, only the
            // reduced `public_repo` OAuth scope is sufficient for performing merges.
            const hasOauthScopes = await this.git.hasOauthScopes((scopes, missing) => {
                if (!scopes.includes('repo')) {
                    if (this.config.github.private) {
                        missing.push('repo');
                    }
                    else if (!scopes.includes('public_repo')) {
                        missing.push('public_repo');
                    }
                }
                // Pull requests can modify Github action workflow files. In such cases Github requires us to
                // push with a token that has the `workflow` oauth scope set. To avoid errors when the
                // caretaker intends to merge such PRs, we ensure the scope is always set on the token before
                // the merge process starts.
                // https://docs.github.com/en/developers/apps/scopes-for-oauth-apps#available-scopes
                if (!scopes.includes('workflow')) {
                    missing.push('workflow');
                }
            });
            if (hasOauthScopes !== true) {
                throw new FatalMergeToolError(hasOauthScopes.error);
            }
            return;
        }
        else {
            // TODO(josephperrott): Find a way to check access of the installation without using a JWT.
            Log.debug('Assuming correct access because this a bot account.');
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVyZ2UtdG9vbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9wci9tZXJnZS9tZXJnZS10b29sLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sUUFBUSxNQUFNLFVBQVUsQ0FBQztBQUNoQyxPQUFPLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBR3JFLE9BQU8sRUFDTCw2QkFBNkIsRUFDN0IsNENBQTRDLEVBQzVDLDBCQUEwQixHQUMzQixNQUFNLGVBQWUsQ0FBQztBQUN2QixPQUFPLEVBQUMsMEJBQTBCLEVBQWMsTUFBTSxtQkFBbUIsQ0FBQztBQUMxRSxPQUFPLEVBQUMsc0JBQXNCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUNqRSxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUV6RSxPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUN2RSxPQUFPLEVBQ0wsbUJBQW1CLEVBQ25CLG1DQUFtQyxFQUNuQyxpQkFBaUIsR0FDbEIsTUFBTSxtQ0FBbUMsQ0FBQztBQUMzQyxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDN0MsT0FBTyxFQUNMLG1CQUFtQixFQUNuQiwwQkFBMEIsRUFDMUIseUJBQXlCLEdBQzFCLE1BQU0sZUFBZSxDQUFDO0FBQ3ZCLE9BQU8sRUFBQyxpQ0FBaUMsRUFBQyxNQUFNLDJDQUEyQyxDQUFDO0FBUzVGLE1BQU0sNEJBQTRCLEdBQTBCO0lBQzFELFlBQVksRUFBRSxJQUFJO0lBQ2xCLG1CQUFtQixFQUFFLEtBQUs7SUFDMUIsTUFBTSxFQUFFLEtBQUs7SUFDYixvQkFBb0IsRUFBRSxLQUFLO0NBQzVCLENBQUM7QUFFRjs7OztHQUlHO0FBQ0gsTUFBTSxPQUFPLFNBQVM7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QyxNQUFNLENBQUMsRUFBRSxDQUFDO29CQUM3QixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUMvQixPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUN2QixDQUFDO3lCQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7d0JBQzNDLE9BQU8sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7b0JBQzlCLENBQUM7Z0JBQ0gsQ0FBQztnQkFFRCw2RkFBNkY7Z0JBQzdGLHNGQUFzRjtnQkFDdEYsNkZBQTZGO2dCQUM3Riw0QkFBNEI7Z0JBQzVCLG9GQUFvRjtnQkFDcEYsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztvQkFDakMsT0FBTyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDM0IsQ0FBQztZQUNILENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxjQUFjLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQzVCLE1BQU0sSUFBSSxtQkFBbUIsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDdEQsQ0FBQztZQUNELE9BQU87UUFDVCxDQUFDO2FBQU0sQ0FBQztZQUNOLDJGQUEyRjtZQUMzRixHQUFHLENBQUMsS0FBSyxDQUFDLHFEQUFxRCxDQUFDLENBQUM7UUFDbkUsQ0FBQztJQUNILENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0F1dGhlbnRpY2F0ZWRHaXRDbGllbnR9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQuanMnO1xuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xuaW1wb3J0IGlucXVpcmVyIGZyb20gJ2lucXVpcmVyJztcbmltcG9ydCB7Ym9sZCwgZ3JlZW4sIExvZywgcmVkLCB5ZWxsb3d9IGZyb20gJy4uLy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuXG5pbXBvcnQge1B1bGxSZXF1ZXN0Q29uZmlnLCBQdWxsUmVxdWVzdFZhbGlkYXRpb25Db25maWd9IGZyb20gJy4uL2NvbmZpZy9pbmRleC5qcyc7XG5pbXBvcnQge1xuICBnZXRDYXJldGFrZXJOb3RlUHJvbXB0TWVzc2FnZSxcbiAgZ2V0VGFyZ2V0ZWRCcmFuY2hlc0NvbmZpcm1hdGlvblByb21wdE1lc3NhZ2UsXG4gIGdldFRhcmdldGVkQnJhbmNoZXNNZXNzYWdlLFxufSBmcm9tICcuL21lc3NhZ2VzLmpzJztcbmltcG9ydCB7bG9hZEFuZFZhbGlkYXRlUHVsbFJlcXVlc3QsIFB1bGxSZXF1ZXN0fSBmcm9tICcuL3B1bGwtcmVxdWVzdC5qcyc7XG5pbXBvcnQge0dpdGh1YkFwaU1lcmdlU3RyYXRlZ3l9IGZyb20gJy4vc3RyYXRlZ2llcy9hcGktbWVyZ2UuanMnO1xuaW1wb3J0IHtBdXRvc3F1YXNoTWVyZ2VTdHJhdGVneX0gZnJvbSAnLi9zdHJhdGVnaWVzL2F1dG9zcXVhc2gtbWVyZ2UuanMnO1xuaW1wb3J0IHtHaXRodWJDb25maWcsIE5nRGV2Q29uZmlnfSBmcm9tICcuLi8uLi91dGlscy9jb25maWcuanMnO1xuaW1wb3J0IHthc3NlcnRWYWxpZFJlbGVhc2VDb25maWd9IGZyb20gJy4uLy4uL3JlbGVhc2UvY29uZmlnL2luZGV4LmpzJztcbmltcG9ydCB7XG4gIEFjdGl2ZVJlbGVhc2VUcmFpbnMsXG4gIGZldGNoTG9uZ1Rlcm1TdXBwb3J0QnJhbmNoZXNGcm9tTnBtLFxuICBnZXROZXh0QnJhbmNoTmFtZSxcbn0gZnJvbSAnLi4vLi4vcmVsZWFzZS92ZXJzaW9uaW5nL2luZGV4LmpzJztcbmltcG9ydCB7UHJvbXB0fSBmcm9tICcuLi8uLi91dGlscy9wcm9tcHQuanMnO1xuaW1wb3J0IHtcbiAgRmF0YWxNZXJnZVRvb2xFcnJvcixcbiAgUHVsbFJlcXVlc3RWYWxpZGF0aW9uRXJyb3IsXG4gIFVzZXJBYm9ydGVkTWVyZ2VUb29sRXJyb3IsXG59IGZyb20gJy4vZmFpbHVyZXMuanMnO1xuaW1wb3J0IHtjcmVhdGVQdWxsUmVxdWVzdFZhbGlkYXRpb25Db25maWd9IGZyb20gJy4uL2NvbW1vbi92YWxpZGF0aW9uL3ZhbGlkYXRpb24tY29uZmlnLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBQdWxsUmVxdWVzdE1lcmdlRmxhZ3Mge1xuICBicmFuY2hQcm9tcHQ6IGJvb2xlYW47XG4gIGZvcmNlTWFudWFsQnJhbmNoZXM6IGJvb2xlYW47XG4gIGRyeVJ1bjogYm9vbGVhbjtcbiAgaWdub3JlUGVuZGluZ1Jldmlld3M6IGJvb2xlYW47XG59XG5cbmNvbnN0IGRlZmF1bHRQdWxsUmVxdWVzdE1lcmdlRmxhZ3M6IFB1bGxSZXF1ZXN0TWVyZ2VGbGFncyA9IHtcbiAgYnJhbmNoUHJvbXB0OiB0cnVlLFxuICBmb3JjZU1hbnVhbEJyYW5jaGVzOiBmYWxzZSxcbiAgZHJ5UnVuOiBmYWxzZSxcbiAgaWdub3JlUGVuZGluZ1Jldmlld3M6IGZhbHNlLFxufTtcblxuLyoqXG4gKiBDbGFzcyB0aGF0IGFjY2VwdHMgYSBtZXJnZSBzY3JpcHQgY29uZmlndXJhdGlvbiBhbmQgR2l0aHViIHRva2VuLiBJdCBwcm92aWRlc1xuICogYSBwcm9ncmFtbWF0aWMgaW50ZXJmYWNlIGZvciBtZXJnaW5nIG11bHRpcGxlIHB1bGwgcmVxdWVzdHMgYmFzZWQgb24gdGhlaXJcbiAqIGxhYmVscyB0aGF0IGhhdmUgYmVlbiByZXNvbHZlZCB0aHJvdWdoIHRoZSBtZXJnZSBzY3JpcHQgY29uZmlndXJhdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIE1lcmdlVG9vbCB7XG4gIHByaXZhdGUgZmxhZ3M6IFB1bGxSZXF1ZXN0TWVyZ2VGbGFncztcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgY29uZmlnOiBOZ0RldkNvbmZpZzx7XG4gICAgICBwdWxsUmVxdWVzdDogUHVsbFJlcXVlc3RDb25maWc7XG4gICAgICBnaXRodWI6IEdpdGh1YkNvbmZpZztcbiAgICB9PixcbiAgICBwdWJsaWMgZ2l0OiBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LFxuICAgIGZsYWdzOiBQYXJ0aWFsPFB1bGxSZXF1ZXN0TWVyZ2VGbGFncz4sXG4gICkge1xuICAgIC8vIFVwZGF0ZSBmbGFncyBwcm9wZXJ0eSB3aXRoIHRoZSBwcm92aWRlZCBmbGFncyB2YWx1ZXMgYXMgcGF0Y2hlcyB0byB0aGUgZGVmYXVsdCBmbGFnIHZhbHVlcy5cbiAgICB0aGlzLmZsYWdzID0gey4uLmRlZmF1bHRQdWxsUmVxdWVzdE1lcmdlRmxhZ3MsIC4uLmZsYWdzfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNZXJnZXMgdGhlIGdpdmVuIHB1bGwgcmVxdWVzdCBhbmQgcHVzaGVzIGl0IHVwc3RyZWFtLlxuICAgKiBAcGFyYW0gcHJOdW1iZXIgUHVsbCByZXF1ZXN0IHRoYXQgc2hvdWxkIGJlIG1lcmdlZC5cbiAgICogQHBhcmFtIHBhcnRpYWxWYWxpZGF0aW9uQ29uZmlnIFB1bGwgcmVxdWVzdCB2YWxpZGF0aW9uIGNvbmZpZy4gQ2FuIGJlIG1vZGlmaWVkIHRvIHNraXBcbiAgICogICBjZXJ0YWluIG5vbi1mYXRhbCB2YWxpZGF0aW9ucy5cbiAgICovXG4gIGFzeW5jIG1lcmdlKFxuICAgIHByTnVtYmVyOiBudW1iZXIsXG4gICAgcGFydGlhbFZhbGlkYXRpb25Db25maWc6IFB1bGxSZXF1ZXN0VmFsaWRhdGlvbkNvbmZpZyxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLyoqIFRoZSBmdWxsIHZhbGlkYXRpb24gY29uZmlnLCB1c2luZyB0aGUgcHJvdmlkZWQgY29uZmlnIGZyb20gZmxhZ3MsIGNvbmZpZyBhbmQgZGVmYXVsdHMuICovXG4gICAgY29uc3QgdmFsaWRhdGlvbkNvbmZpZyA9IGNyZWF0ZVB1bGxSZXF1ZXN0VmFsaWRhdGlvbkNvbmZpZyh7XG4gICAgICAuLi50aGlzLmNvbmZpZy5wdWxsUmVxdWVzdC52YWxpZGF0b3JzLFxuICAgICAgLi4ucGFydGlhbFZhbGlkYXRpb25Db25maWcsXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5naXQuaGFzVW5jb21taXR0ZWRDaGFuZ2VzKCkpIHtcbiAgICAgIHRocm93IG5ldyBGYXRhbE1lcmdlVG9vbEVycm9yKFxuICAgICAgICAnTG9jYWwgd29ya2luZyByZXBvc2l0b3J5IG5vdCBjbGVhbi4gUGxlYXNlIG1ha2Ugc3VyZSB0aGVyZSBhcmUgJyArXG4gICAgICAgICAgJ25vIHVuY29tbWl0dGVkIGNoYW5nZXMuJyxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZ2l0LmlzU2hhbGxvd1JlcG8oKSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsTWVyZ2VUb29sRXJyb3IoXG4gICAgICAgIGBVbmFibGUgdG8gcGVyZm9ybSBtZXJnZSBpbiBhIGxvY2FsIHJlcG9zaXRvcnkgdGhhdCBpcyBjb25maWd1cmVkIGFzIHNoYWxsb3cuXFxuYCArXG4gICAgICAgICAgYFBsZWFzZSBjb252ZXJ0IHRoZSByZXBvc2l0b3J5IHRvIGEgY29tcGxldGUgb25lIGJ5IHN5bmNpbmcgd2l0aCB1cHN0cmVhbS5cXG5gICtcbiAgICAgICAgICBgaHR0cHM6Ly9naXQtc2NtLmNvbS9kb2NzL2dpdC1mZXRjaCNEb2N1bWVudGF0aW9uL2dpdC1mZXRjaC50eHQtLS11bnNoYWxsb3dgLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLmNvbmZpcm1NZXJnZUFjY2VzcygpO1xuXG4gICAgY29uc3QgcHVsbFJlcXVlc3QgPSBhd2FpdCBsb2FkQW5kVmFsaWRhdGVQdWxsUmVxdWVzdCh0aGlzLCBwck51bWJlciwgdmFsaWRhdGlvbkNvbmZpZyk7XG5cbiAgICBpZiAocHVsbFJlcXVlc3QudmFsaWRhdGlvbkZhaWx1cmVzLmxlbmd0aCA+IDApIHtcbiAgICAgIExvZy5lcnJvcihgUHVsbCByZXF1ZXN0IGRpZCBub3QgcGFzcyBvbmUgb3IgbW9yZSB2YWxpZGF0aW9uIGNoZWNrcy4gRXJyb3I6YCk7XG5cbiAgICAgIGZvciAoY29uc3QgZmFpbHVyZSBvZiBwdWxsUmVxdWVzdC52YWxpZGF0aW9uRmFpbHVyZXMpIHtcbiAgICAgICAgTG9nLmVycm9yKGAgLT4gJHtib2xkKGZhaWx1cmUubWVzc2FnZSl9YCk7XG4gICAgICB9XG4gICAgICBMb2cuaW5mbygpO1xuXG4gICAgICBpZiAocHVsbFJlcXVlc3QudmFsaWRhdGlvbkZhaWx1cmVzLnNvbWUoKGZhaWx1cmUpID0+ICFmYWlsdXJlLmNhbkJlRm9yY2VJZ25vcmVkKSkge1xuICAgICAgICBMb2cuZGVidWcoJ0Rpc2NvdmVyZWQgYSBmYXRhbCBlcnJvciwgd2hpY2ggY2Fubm90IGJlIGZvcmNlZCcpO1xuICAgICAgICB0aHJvdyBuZXcgUHVsbFJlcXVlc3RWYWxpZGF0aW9uRXJyb3IoKTtcbiAgICAgIH1cblxuICAgICAgTG9nLmluZm8oeWVsbG93KGBBbGwgZGlzY292ZXJlZCB2YWxpZGF0aW9ucyBhcmUgbm9uLWZhdGFsIGFuZCBjYW4gYmUgZm9yY2libHkgaWdub3JlZC5gKSk7XG4gICAgICBpZiAoIShhd2FpdCBQcm9tcHQuY29uZmlybSgnRG8geW91IHdhbnQgdG8gZm9yY2libHkgaWdub3JlIHRoZXNlIHZhbGlkYXRpb24gZmFpbHVyZXM/JykpKSB7XG4gICAgICAgIHRocm93IG5ldyBQdWxsUmVxdWVzdFZhbGlkYXRpb25FcnJvcigpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLmZsYWdzLmZvcmNlTWFudWFsQnJhbmNoZXMpIHtcbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUHVsbFJlcXVlc3RUYXJnZXRlZEJyYW5jaGVzRnJvbVByb21wdChwdWxsUmVxdWVzdCk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIHB1bGwgcmVxdWVzdCBoYXMgYSBjYXJldGFrZXIgbm90ZSBhcHBsaWVkLCByYWlzZSBhd2FyZW5lc3MgYnkgcHJvbXB0aW5nXG4gICAgLy8gdGhlIGNhcmV0YWtlci4gVGhlIGNhcmV0YWtlciBjYW4gdGhlbiBkZWNpZGUgdG8gcHJvY2VlZCBvciBhYm9ydCB0aGUgbWVyZ2UuXG4gICAgaWYgKFxuICAgICAgcHVsbFJlcXVlc3QuaGFzQ2FyZXRha2VyTm90ZSAmJlxuICAgICAgIShhd2FpdCBQcm9tcHQuY29uZmlybShnZXRDYXJldGFrZXJOb3RlUHJvbXB0TWVzc2FnZShwdWxsUmVxdWVzdCkpKVxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IFVzZXJBYm9ydGVkTWVyZ2VUb29sRXJyb3IoKTtcbiAgICB9XG5cbiAgICBjb25zdCBzdHJhdGVneSA9IHRoaXMuY29uZmlnLnB1bGxSZXF1ZXN0LmdpdGh1YkFwaU1lcmdlXG4gICAgICA/IG5ldyBHaXRodWJBcGlNZXJnZVN0cmF0ZWd5KHRoaXMuZ2l0LCB0aGlzLmNvbmZpZy5wdWxsUmVxdWVzdC5naXRodWJBcGlNZXJnZSlcbiAgICAgIDogbmV3IEF1dG9zcXVhc2hNZXJnZVN0cmF0ZWd5KHRoaXMuZ2l0KTtcblxuICAgIC8vIEJyYW5jaCBvciByZXZpc2lvbiB0aGF0IGlzIGN1cnJlbnRseSBjaGVja2VkIG91dCBzbyB0aGF0IHdlIGNhbiBzd2l0Y2ggYmFjayB0b1xuICAgIC8vIGl0IG9uY2UgdGhlIHB1bGwgcmVxdWVzdCBoYXMgYmVlbiBtZXJnZWQuXG4gICAgY29uc3QgcHJldmlvdXNCcmFuY2hPclJldmlzaW9uID0gdGhpcy5naXQuZ2V0Q3VycmVudEJyYW5jaE9yUmV2aXNpb24oKTtcblxuICAgIC8vIFRoZSBmb2xsb3dpbmcgYmxvY2sgcnVucyBHaXQgY29tbWFuZHMgYXMgY2hpbGQgcHJvY2Vzc2VzLiBUaGVzZSBHaXQgY29tbWFuZHMgY2FuIGZhaWwuXG4gICAgLy8gV2Ugd2FudCB0byBjYXB0dXJlIHRoZXNlIGNvbW1hbmQgZXJyb3JzIGFuZCByZXR1cm4gYW4gYXBwcm9wcmlhdGUgbWVyZ2UgcmVxdWVzdCBzdGF0dXMuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFJ1biBwcmVwYXJhdGlvbnMgZm9yIHRoZSBtZXJnZSAoZS5nLiBmZXRjaGluZyBicmFuY2hlcykuXG4gICAgICBhd2FpdCBzdHJhdGVneS5wcmVwYXJlKHB1bGxSZXF1ZXN0KTtcblxuICAgICAgLy8gUHJpbnQgdGhlIHRhcmdldCBicmFuY2hlcy5cbiAgICAgIExvZy5pbmZvKCk7XG4gICAgICBMb2cuaW5mbyhnZXRUYXJnZXRlZEJyYW5jaGVzTWVzc2FnZShwdWxsUmVxdWVzdCkpO1xuXG4gICAgICAvLyBDaGVjayBmb3IgY29uZmxpY3RzIGJldHdlZW4gdGhlIHB1bGwgcmVxdWVzdCBhbmQgdGFyZ2V0IGJyYW5jaGVzLlxuICAgICAgYXdhaXQgc3RyYXRlZ3kuY2hlY2socHVsbFJlcXVlc3QpO1xuXG4gICAgICBMb2cuaW5mbygnJyk7XG4gICAgICBMb2cuaW5mbyhncmVlbihgICAgICBQUjogJHtib2xkKHB1bGxSZXF1ZXN0LnRpdGxlKX1gKSk7XG4gICAgICBMb2cuaW5mbyhncmVlbihgICDinJMgIFB1bGwgcmVxdWVzdCBjYW4gYmUgbWVyZ2VkIGludG8gYWxsIHRhcmdldCBicmFuY2hlcy5gKSk7XG4gICAgICBMb2cuaW5mbygpO1xuXG4gICAgICBpZiAodGhpcy5mbGFncy5kcnlSdW4pIHtcbiAgICAgICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICBFeGl0aW5nIGR1ZSB0byBkcnkgcnVuIG1vZGUuYCkpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChcbiAgICAgICAgLy8gSWYgdGhlcmUgaXMgbm8gdGFyZ2V0IGxhYmVsaW5nIHRoZW4gdGhlIHB1bGwgcmVxdWVzdCBpcyBhbHdheXMganVzdCBkaXJlY3RseSBtZXJnZWQsIHNvXG4gICAgICAgIC8vIHRoZSBjb25maXJtYXRpb24gY2FuIGJlIHNraXBwZWQuXG4gICAgICAgICF0aGlzLmNvbmZpZy5wdWxsUmVxdWVzdC5fX25vVGFyZ2V0TGFiZWxpbmcgJiZcbiAgICAgICAgLy8gSW4gY2FzZXMgd2hlcmUgbWFudWFsIGJyYW5jaCB0YXJnZXRpbmcgaXMgdXNlZCwgdGhlIHVzZXIgYWxyZWFkeSBjb25maXJtZWQuXG4gICAgICAgICF0aGlzLmZsYWdzLmZvcmNlTWFudWFsQnJhbmNoZXMgJiZcbiAgICAgICAgdGhpcy5mbGFncy5icmFuY2hQcm9tcHQgJiZcbiAgICAgICAgIShhd2FpdCBQcm9tcHQuY29uZmlybShnZXRUYXJnZXRlZEJyYW5jaGVzQ29uZmlybWF0aW9uUHJvbXB0TWVzc2FnZSgpKSlcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgVXNlckFib3J0ZWRNZXJnZVRvb2xFcnJvcigpO1xuICAgICAgfVxuXG4gICAgICAvLyBQZXJmb3JtIHRoZSBtZXJnZSBhbmQgcGFzcy10aHJvdWdoIHBvdGVudGlhbCBmYWlsdXJlcy5cbiAgICAgIGF3YWl0IHN0cmF0ZWd5Lm1lcmdlKHB1bGxSZXF1ZXN0KTtcbiAgICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgU3VjY2Vzc2Z1bGx5IG1lcmdlZCB0aGUgcHVsbCByZXF1ZXN0OiAjJHtwck51bWJlcn1gKSk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIC8vIFN3aXRjaCBiYWNrIHRvIHRoZSBwcmV2aW91cyBicmFuY2guIFdlIG5lZWQgdG8gZG8gdGhpcyBiZWZvcmUgZGVsZXRpbmcgdGhlIHRlbXBvcmFyeVxuICAgICAgLy8gYnJhbmNoZXMgYmVjYXVzZSB3ZSBjYW5ub3QgZGVsZXRlIGJyYW5jaGVzIHdoaWNoIGFyZSBjdXJyZW50bHkgY2hlY2tlZCBvdXQuXG4gICAgICB0aGlzLmdpdC5ydW4oWydjaGVja291dCcsICctZicsIHByZXZpb3VzQnJhbmNoT3JSZXZpc2lvbl0pO1xuXG4gICAgICBhd2FpdCBzdHJhdGVneS5jbGVhbnVwKHB1bGxSZXF1ZXN0KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTW9kaWZpZXMgdGhlIHB1bGwgcmVxdWVzdCBpbiBwbGFjZSB3aXRoIG5ldyB0YXJnZXQgYnJhbmNoZXMgYmFzZWQgb24gdXNlclxuICAgKiBzZWxlY3Rpb24gZnJvbSB0aGUgYXZhaWxhYmxlIGFjdGl2ZSBicmFuY2hlcy5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgdXBkYXRlUHVsbFJlcXVlc3RUYXJnZXRlZEJyYW5jaGVzRnJvbVByb21wdChcbiAgICBwdWxsUmVxdWVzdDogUHVsbFJlcXVlc3QsXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHtuYW1lOiByZXBvTmFtZSwgb3duZXJ9ID0gdGhpcy5jb25maWcuZ2l0aHViO1xuXG4gICAgLy8gQXR0ZW1wdCB0byByZXRyaWV2ZSB0aGUgYWN0aXZlIExUUyBicmFuY2hlcyB0byBiZSBpbmNsdWRlZCBpbiB0aGUgc2VsZWN0aW9uLlxuICAgIGxldCBsdHNCcmFuY2hlczoge2JyYW5jaE5hbWU6IHN0cmluZzsgdmVyc2lvbjogc2VtdmVyLlNlbVZlcn1bXSA9IFtdO1xuICAgIHRyeSB7XG4gICAgICBhc3NlcnRWYWxpZFJlbGVhc2VDb25maWcodGhpcy5jb25maWcpO1xuICAgICAgY29uc3QgbHRzQnJhbmNoZXNGcm9tTnBtID0gYXdhaXQgZmV0Y2hMb25nVGVybVN1cHBvcnRCcmFuY2hlc0Zyb21OcG0odGhpcy5jb25maWcucmVsZWFzZSk7XG4gICAgICBsdHNCcmFuY2hlcyA9IGx0c0JyYW5jaGVzRnJvbU5wbS5hY3RpdmUubWFwKCh7bmFtZSwgdmVyc2lvbn0pID0+ICh7XG4gICAgICAgIGJyYW5jaE5hbWU6IG5hbWUsXG4gICAgICAgIHZlcnNpb24sXG4gICAgICB9KSk7XG4gICAgfSBjYXRjaCB7XG4gICAgICBMb2cud2FybihcbiAgICAgICAgJ1VuYWJsZSB0byBkZXRlcm1pbmUgdGhlIGFjdGl2ZSBMVFMgYnJhbmNoZXMgYXMgYSByZWxlYXNlIGNvbmZpZyBpcyBub3Qgc2V0IGZvciB0aGlzIHJlcG8uJyxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gR2F0aGVyIHRoZSBjdXJyZW50IGFjdGl2ZSByZWxlYXNlIHRyYWlucy5cbiAgICBjb25zdCB7bGF0ZXN0LCBuZXh0LCByZWxlYXNlQ2FuZGlkYXRlfSA9IGF3YWl0IEFjdGl2ZVJlbGVhc2VUcmFpbnMuZmV0Y2goe1xuICAgICAgbmFtZTogcmVwb05hbWUsXG4gICAgICBuZXh0QnJhbmNoTmFtZTogZ2V0TmV4dEJyYW5jaE5hbWUodGhpcy5jb25maWcuZ2l0aHViKSxcbiAgICAgIG93bmVyLFxuICAgICAgYXBpOiB0aGlzLmdpdC5naXRodWIsXG4gICAgfSk7XG5cbiAgICAvLyBDb2xsYXRlIHRoZSBrbm93biBhY3RpdmUgYnJhbmNoZXMgaW50byBhIHNpbmdsZSBsaXN0LlxuICAgIGNvbnN0IGFjdGl2ZUJyYW5jaGVzOiB7YnJhbmNoTmFtZTogc3RyaW5nOyB2ZXJzaW9uOiBzZW12ZXIuU2VtVmVyfVtdID0gW1xuICAgICAgbmV4dCxcbiAgICAgIGxhdGVzdCxcbiAgICAgIC4uLmx0c0JyYW5jaGVzLFxuICAgIF07XG4gICAgaWYgKHJlbGVhc2VDYW5kaWRhdGUgIT09IG51bGwpIHtcbiAgICAgIC8vIFNpbmNlIHRoZSBuZXh0IHZlcnNpb24gd2lsbCBhbHdheXMgYmUgdGhlIHByaW1hcnkgZ2l0aHViIGJyYW5jaCByYXRoZXIgdGhhbiBzZW12ZXIsIHRoZSBSQ1xuICAgICAgLy8gYnJhbmNoIHNob3VsZCBiZSBpbmNsdWRlZCBhcyB0aGUgc2Vjb25kIGl0ZW0gaW4gdGhlIGxpc3QuXG4gICAgICBhY3RpdmVCcmFuY2hlcy5zcGxpY2UoMSwgMCwgcmVsZWFzZUNhbmRpZGF0ZSk7XG4gICAgfVxuXG4gICAgY29uc3Qge3NlbGVjdGVkQnJhbmNoZXMsIGNvbmZpcm19ID0gYXdhaXQgaW5xdWlyZXIucHJvbXB0PHtcbiAgICAgIHNlbGVjdGVkQnJhbmNoZXM6IHN0cmluZ1tdO1xuICAgICAgY29uZmlybTogYm9vbGVhbjtcbiAgICB9PihbXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdjaGVja2JveCcsXG4gICAgICAgIGNob2ljZXM6IGFjdGl2ZUJyYW5jaGVzLm1hcCgoe2JyYW5jaE5hbWUsIHZlcnNpb259KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNoZWNrZWQ6IHB1bGxSZXF1ZXN0LnRhcmdldEJyYW5jaGVzLmluY2x1ZGVzKGJyYW5jaE5hbWUpLFxuICAgICAgICAgICAgdmFsdWU6IGJyYW5jaE5hbWUsXG4gICAgICAgICAgICBzaG9ydDogYnJhbmNoTmFtZSxcbiAgICAgICAgICAgIG5hbWU6IGAke2JyYW5jaE5hbWV9ICgke3ZlcnNpb259KSR7XG4gICAgICAgICAgICAgIGJyYW5jaE5hbWUgPT09IHB1bGxSZXF1ZXN0LmdpdGh1YlRhcmdldEJyYW5jaCA/ICcgW1RhcmdldGVkIHZpYSBHaXRodWIgVUldJyA6ICcnXG4gICAgICAgICAgICB9YCxcbiAgICAgICAgICB9O1xuICAgICAgICB9KSxcbiAgICAgICAgbWVzc2FnZTogJ1NlbGVjdCBicmFuY2hlcyB0byBtZXJnZSBwdWxsIHJlcXVlc3QgaW50bzonLFxuICAgICAgICBuYW1lOiAnc2VsZWN0ZWRCcmFuY2hlcycsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0eXBlOiAnY29uZmlybScsXG4gICAgICAgIGRlZmF1bHQ6IGZhbHNlLFxuICAgICAgICBtZXNzYWdlOlxuICAgICAgICAgIHJlZCgnISEhISEhIFdBUk5JTkcgISEhISEhIVxcbicpICtcbiAgICAgICAgICB5ZWxsb3coXG4gICAgICAgICAgICAnVXNpbmcgbWFudWFsIGJyYW5jaCBzZWxlY3Rpb24gZGlzYWJsZXMgcHJvdGVjdGl2ZSBjaGVja3MgcHJvdmlkZWQgYnkgdGhlIG1lcmdlICcgK1xuICAgICAgICAgICAgICAndG9vbGluZy4gVGhpcyBtZWFucyB0aGF0IHRoZSBtZXJnZSB0b29saW5nIHdpbGwgbm90IHByZXZlbnQgY2hhbmdlcyB3aGljaCBhcmUgbm90ICcgK1xuICAgICAgICAgICAgICAnYWxsb3dlZCBmb3IgdGhlIHRhcmdldGVkIGJyYW5jaGVzLiBQbGVhc2UgcHJvY2VlZCB3aXRoIGNhdXRpb24uXFxuJyxcbiAgICAgICAgICApICtcbiAgICAgICAgICAnQXJlIHlvdSBzdXJlIHlvdSB3b3VsZCBsaWtlIHRvIHByb2NlZWQgd2l0aCB0aGUgc2VsZWN0ZWQgYnJhbmNoZXM/JyxcbiAgICAgICAgbmFtZTogJ2NvbmZpcm0nLFxuICAgICAgfSxcbiAgICBdKTtcblxuICAgIGlmIChjb25maXJtID09PSBmYWxzZSkge1xuICAgICAgdGhyb3cgbmV3IFVzZXJBYm9ydGVkTWVyZ2VUb29sRXJyb3IoKTtcbiAgICB9XG5cbiAgICAvLyBUaGUgR2l0aHViIFRhcmdldGVkIGJyYW5jaCBtdXN0IGFsd2F5cyBiZSBzZWxlY3RlZC4gSXQgaXMgbm90IGN1cnJlbnRseSBwb3NzaWJsZVxuICAgIC8vIHRvIG1ha2UgYSByZWFkb25seSBzZWxlY3Rpb24gaW4gaW5xdWlyZXIncyBjaGVja2JveC5cbiAgICBpZiAoIXNlbGVjdGVkQnJhbmNoZXMuaW5jbHVkZXMocHVsbFJlcXVlc3QuZ2l0aHViVGFyZ2V0QnJhbmNoKSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsTWVyZ2VUb29sRXJyb3IoXG4gICAgICAgIGBQdWxsIFJlcXVlc3RzIG11c3QgbWVyZ2UgaW50byB0aGVpciB0YXJnZXRlZCBHaXRodWIgYnJhbmNoLiBJZiB0aGlzIGJyYW5jaCAoJHtwdWxsUmVxdWVzdC5naXRodWJUYXJnZXRCcmFuY2h9KSBgICtcbiAgICAgICAgICAnc2hvdWxkIG5vdCBiZSBpbmNsdWRlZCwgcGxlYXNlIGNoYW5nZSB0aGUgdGFyZ2V0ZWQgYnJhbmNoIHZpYSB0aGUgR2l0aHViIFVJLicsXG4gICAgICApO1xuICAgIH1cblxuICAgIHB1bGxSZXF1ZXN0LnRhcmdldEJyYW5jaGVzID0gc2VsZWN0ZWRCcmFuY2hlcztcbiAgfVxuXG4gIGFzeW5jIGNvbmZpcm1NZXJnZUFjY2VzcygpIHtcbiAgICBpZiAodGhpcy5naXQudXNlclR5cGUgPT09ICd1c2VyJykge1xuICAgICAgLy8gQ2hlY2sgd2hldGhlciB0aGUgZ2l2ZW4gR2l0aHViIHRva2VuIGhhcyBzdWZmaWNpZW50IHBlcm1pc3Npb25zIGZvciB3cml0aW5nXG4gICAgICAvLyB0byB0aGUgY29uZmlndXJlZCByZXBvc2l0b3J5LiBJZiB0aGUgcmVwb3NpdG9yeSBpcyBub3QgcHJpdmF0ZSwgb25seSB0aGVcbiAgICAgIC8vIHJlZHVjZWQgYHB1YmxpY19yZXBvYCBPQXV0aCBzY29wZSBpcyBzdWZmaWNpZW50IGZvciBwZXJmb3JtaW5nIG1lcmdlcy5cbiAgICAgIGNvbnN0IGhhc09hdXRoU2NvcGVzID0gYXdhaXQgdGhpcy5naXQuaGFzT2F1dGhTY29wZXMoKHNjb3BlcywgbWlzc2luZykgPT4ge1xuICAgICAgICBpZiAoIXNjb3Blcy5pbmNsdWRlcygncmVwbycpKSB7XG4gICAgICAgICAgaWYgKHRoaXMuY29uZmlnLmdpdGh1Yi5wcml2YXRlKSB7XG4gICAgICAgICAgICBtaXNzaW5nLnB1c2goJ3JlcG8nKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKCFzY29wZXMuaW5jbHVkZXMoJ3B1YmxpY19yZXBvJykpIHtcbiAgICAgICAgICAgIG1pc3NpbmcucHVzaCgncHVibGljX3JlcG8nKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBQdWxsIHJlcXVlc3RzIGNhbiBtb2RpZnkgR2l0aHViIGFjdGlvbiB3b3JrZmxvdyBmaWxlcy4gSW4gc3VjaCBjYXNlcyBHaXRodWIgcmVxdWlyZXMgdXMgdG9cbiAgICAgICAgLy8gcHVzaCB3aXRoIGEgdG9rZW4gdGhhdCBoYXMgdGhlIGB3b3JrZmxvd2Agb2F1dGggc2NvcGUgc2V0LiBUbyBhdm9pZCBlcnJvcnMgd2hlbiB0aGVcbiAgICAgICAgLy8gY2FyZXRha2VyIGludGVuZHMgdG8gbWVyZ2Ugc3VjaCBQUnMsIHdlIGVuc3VyZSB0aGUgc2NvcGUgaXMgYWx3YXlzIHNldCBvbiB0aGUgdG9rZW4gYmVmb3JlXG4gICAgICAgIC8vIHRoZSBtZXJnZSBwcm9jZXNzIHN0YXJ0cy5cbiAgICAgICAgLy8gaHR0cHM6Ly9kb2NzLmdpdGh1Yi5jb20vZW4vZGV2ZWxvcGVycy9hcHBzL3Njb3Blcy1mb3Itb2F1dGgtYXBwcyNhdmFpbGFibGUtc2NvcGVzXG4gICAgICAgIGlmICghc2NvcGVzLmluY2x1ZGVzKCd3b3JrZmxvdycpKSB7XG4gICAgICAgICAgbWlzc2luZy5wdXNoKCd3b3JrZmxvdycpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgaWYgKGhhc09hdXRoU2NvcGVzICE9PSB0cnVlKSB7XG4gICAgICAgIHRocm93IG5ldyBGYXRhbE1lcmdlVG9vbEVycm9yKGhhc09hdXRoU2NvcGVzLmVycm9yKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVE9ETyhqb3NlcGhwZXJyb3R0KTogRmluZCBhIHdheSB0byBjaGVjayBhY2Nlc3Mgb2YgdGhlIGluc3RhbGxhdGlvbiB3aXRob3V0IHVzaW5nIGEgSldULlxuICAgICAgTG9nLmRlYnVnKCdBc3N1bWluZyBjb3JyZWN0IGFjY2VzcyBiZWNhdXNlIHRoaXMgYSBib3QgYWNjb3VudC4nKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==