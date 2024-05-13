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
                default: pullRequest.targetBranches,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVyZ2UtdG9vbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9wci9tZXJnZS9tZXJnZS10b29sLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sUUFBUSxNQUFNLFVBQVUsQ0FBQztBQUNoQyxPQUFPLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBR3JFLE9BQU8sRUFDTCw2QkFBNkIsRUFDN0IsNENBQTRDLEVBQzVDLDBCQUEwQixHQUMzQixNQUFNLGVBQWUsQ0FBQztBQUN2QixPQUFPLEVBQUMsMEJBQTBCLEVBQWMsTUFBTSxtQkFBbUIsQ0FBQztBQUMxRSxPQUFPLEVBQUMsc0JBQXNCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUNqRSxPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUV6RSxPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUN2RSxPQUFPLEVBQ0wsbUJBQW1CLEVBQ25CLG1DQUFtQyxFQUNuQyxpQkFBaUIsR0FDbEIsTUFBTSxtQ0FBbUMsQ0FBQztBQUMzQyxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDN0MsT0FBTyxFQUNMLG1CQUFtQixFQUNuQiwwQkFBMEIsRUFDMUIseUJBQXlCLEdBQzFCLE1BQU0sZUFBZSxDQUFDO0FBQ3ZCLE9BQU8sRUFBQyxpQ0FBaUMsRUFBQyxNQUFNLDJDQUEyQyxDQUFDO0FBUzVGLE1BQU0sNEJBQTRCLEdBQTBCO0lBQzFELFlBQVksRUFBRSxJQUFJO0lBQ2xCLG1CQUFtQixFQUFFLEtBQUs7SUFDMUIsTUFBTSxFQUFFLEtBQUs7SUFDYixvQkFBb0IsRUFBRSxLQUFLO0NBQzVCLENBQUM7QUFFRjs7OztHQUlHO0FBQ0gsTUFBTSxPQUFPLFNBQVM7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Q3ZFLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7b0JBQzdCLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7d0JBQy9CLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ3ZCLENBQUM7eUJBQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQzt3QkFDM0MsT0FBTyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztvQkFDOUIsQ0FBQztnQkFDSCxDQUFDO2dCQUVELDZGQUE2RjtnQkFDN0Ysc0ZBQXNGO2dCQUN0Riw2RkFBNkY7Z0JBQzdGLDRCQUE0QjtnQkFDNUIsb0ZBQW9GO2dCQUNwRixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO29CQUNqQyxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUMzQixDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLGNBQWMsS0FBSyxJQUFJLEVBQUUsQ0FBQztnQkFDNUIsTUFBTSxJQUFJLG1CQUFtQixDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN0RCxDQUFDO1lBQ0QsT0FBTztRQUNULENBQUM7YUFBTSxDQUFDO1lBQ04sMkZBQTJGO1lBQzNGLEdBQUcsQ0FBQyxLQUFLLENBQUMscURBQXFELENBQUMsQ0FBQztRQUNuRSxDQUFDO0lBQ0gsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QXV0aGVudGljYXRlZEdpdENsaWVudH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2F1dGhlbnRpY2F0ZWQtZ2l0LWNsaWVudC5qcyc7XG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XG5pbXBvcnQgaW5xdWlyZXIgZnJvbSAnaW5xdWlyZXInO1xuaW1wb3J0IHtib2xkLCBncmVlbiwgTG9nLCByZWQsIHllbGxvd30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5cbmltcG9ydCB7UHVsbFJlcXVlc3RDb25maWcsIFB1bGxSZXF1ZXN0VmFsaWRhdGlvbkNvbmZpZ30gZnJvbSAnLi4vY29uZmlnL2luZGV4LmpzJztcbmltcG9ydCB7XG4gIGdldENhcmV0YWtlck5vdGVQcm9tcHRNZXNzYWdlLFxuICBnZXRUYXJnZXRlZEJyYW5jaGVzQ29uZmlybWF0aW9uUHJvbXB0TWVzc2FnZSxcbiAgZ2V0VGFyZ2V0ZWRCcmFuY2hlc01lc3NhZ2UsXG59IGZyb20gJy4vbWVzc2FnZXMuanMnO1xuaW1wb3J0IHtsb2FkQW5kVmFsaWRhdGVQdWxsUmVxdWVzdCwgUHVsbFJlcXVlc3R9IGZyb20gJy4vcHVsbC1yZXF1ZXN0LmpzJztcbmltcG9ydCB7R2l0aHViQXBpTWVyZ2VTdHJhdGVneX0gZnJvbSAnLi9zdHJhdGVnaWVzL2FwaS1tZXJnZS5qcyc7XG5pbXBvcnQge0F1dG9zcXVhc2hNZXJnZVN0cmF0ZWd5fSBmcm9tICcuL3N0cmF0ZWdpZXMvYXV0b3NxdWFzaC1tZXJnZS5qcyc7XG5pbXBvcnQge0dpdGh1YkNvbmZpZywgTmdEZXZDb25maWd9IGZyb20gJy4uLy4uL3V0aWxzL2NvbmZpZy5qcyc7XG5pbXBvcnQge2Fzc2VydFZhbGlkUmVsZWFzZUNvbmZpZ30gZnJvbSAnLi4vLi4vcmVsZWFzZS9jb25maWcvaW5kZXguanMnO1xuaW1wb3J0IHtcbiAgQWN0aXZlUmVsZWFzZVRyYWlucyxcbiAgZmV0Y2hMb25nVGVybVN1cHBvcnRCcmFuY2hlc0Zyb21OcG0sXG4gIGdldE5leHRCcmFuY2hOYW1lLFxufSBmcm9tICcuLi8uLi9yZWxlYXNlL3ZlcnNpb25pbmcvaW5kZXguanMnO1xuaW1wb3J0IHtQcm9tcHR9IGZyb20gJy4uLy4uL3V0aWxzL3Byb21wdC5qcyc7XG5pbXBvcnQge1xuICBGYXRhbE1lcmdlVG9vbEVycm9yLFxuICBQdWxsUmVxdWVzdFZhbGlkYXRpb25FcnJvcixcbiAgVXNlckFib3J0ZWRNZXJnZVRvb2xFcnJvcixcbn0gZnJvbSAnLi9mYWlsdXJlcy5qcyc7XG5pbXBvcnQge2NyZWF0ZVB1bGxSZXF1ZXN0VmFsaWRhdGlvbkNvbmZpZ30gZnJvbSAnLi4vY29tbW9uL3ZhbGlkYXRpb24vdmFsaWRhdGlvbi1jb25maWcuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFB1bGxSZXF1ZXN0TWVyZ2VGbGFncyB7XG4gIGJyYW5jaFByb21wdDogYm9vbGVhbjtcbiAgZm9yY2VNYW51YWxCcmFuY2hlczogYm9vbGVhbjtcbiAgZHJ5UnVuOiBib29sZWFuO1xuICBpZ25vcmVQZW5kaW5nUmV2aWV3czogYm9vbGVhbjtcbn1cblxuY29uc3QgZGVmYXVsdFB1bGxSZXF1ZXN0TWVyZ2VGbGFnczogUHVsbFJlcXVlc3RNZXJnZUZsYWdzID0ge1xuICBicmFuY2hQcm9tcHQ6IHRydWUsXG4gIGZvcmNlTWFudWFsQnJhbmNoZXM6IGZhbHNlLFxuICBkcnlSdW46IGZhbHNlLFxuICBpZ25vcmVQZW5kaW5nUmV2aWV3czogZmFsc2UsXG59O1xuXG4vKipcbiAqIENsYXNzIHRoYXQgYWNjZXB0cyBhIG1lcmdlIHNjcmlwdCBjb25maWd1cmF0aW9uIGFuZCBHaXRodWIgdG9rZW4uIEl0IHByb3ZpZGVzXG4gKiBhIHByb2dyYW1tYXRpYyBpbnRlcmZhY2UgZm9yIG1lcmdpbmcgbXVsdGlwbGUgcHVsbCByZXF1ZXN0cyBiYXNlZCBvbiB0aGVpclxuICogbGFiZWxzIHRoYXQgaGF2ZSBiZWVuIHJlc29sdmVkIHRocm91Z2ggdGhlIG1lcmdlIHNjcmlwdCBjb25maWd1cmF0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgTWVyZ2VUb29sIHtcbiAgcHJpdmF0ZSBmbGFnczogUHVsbFJlcXVlc3RNZXJnZUZsYWdzO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyBjb25maWc6IE5nRGV2Q29uZmlnPHtcbiAgICAgIHB1bGxSZXF1ZXN0OiBQdWxsUmVxdWVzdENvbmZpZztcbiAgICAgIGdpdGh1YjogR2l0aHViQ29uZmlnO1xuICAgIH0+LFxuICAgIHB1YmxpYyBnaXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4gICAgZmxhZ3M6IFBhcnRpYWw8UHVsbFJlcXVlc3RNZXJnZUZsYWdzPixcbiAgKSB7XG4gICAgLy8gVXBkYXRlIGZsYWdzIHByb3BlcnR5IHdpdGggdGhlIHByb3ZpZGVkIGZsYWdzIHZhbHVlcyBhcyBwYXRjaGVzIHRvIHRoZSBkZWZhdWx0IGZsYWcgdmFsdWVzLlxuICAgIHRoaXMuZmxhZ3MgPSB7Li4uZGVmYXVsdFB1bGxSZXF1ZXN0TWVyZ2VGbGFncywgLi4uZmxhZ3N9O1xuICB9XG5cbiAgLyoqXG4gICAqIE1lcmdlcyB0aGUgZ2l2ZW4gcHVsbCByZXF1ZXN0IGFuZCBwdXNoZXMgaXQgdXBzdHJlYW0uXG4gICAqIEBwYXJhbSBwck51bWJlciBQdWxsIHJlcXVlc3QgdGhhdCBzaG91bGQgYmUgbWVyZ2VkLlxuICAgKiBAcGFyYW0gcGFydGlhbFZhbGlkYXRpb25Db25maWcgUHVsbCByZXF1ZXN0IHZhbGlkYXRpb24gY29uZmlnLiBDYW4gYmUgbW9kaWZpZWQgdG8gc2tpcFxuICAgKiAgIGNlcnRhaW4gbm9uLWZhdGFsIHZhbGlkYXRpb25zLlxuICAgKi9cbiAgYXN5bmMgbWVyZ2UoXG4gICAgcHJOdW1iZXI6IG51bWJlcixcbiAgICBwYXJ0aWFsVmFsaWRhdGlvbkNvbmZpZzogUHVsbFJlcXVlc3RWYWxpZGF0aW9uQ29uZmlnLFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvKiogVGhlIGZ1bGwgdmFsaWRhdGlvbiBjb25maWcsIHVzaW5nIHRoZSBwcm92aWRlZCBjb25maWcgZnJvbSBmbGFncywgY29uZmlnIGFuZCBkZWZhdWx0cy4gKi9cbiAgICBjb25zdCB2YWxpZGF0aW9uQ29uZmlnID0gY3JlYXRlUHVsbFJlcXVlc3RWYWxpZGF0aW9uQ29uZmlnKHtcbiAgICAgIC4uLnRoaXMuY29uZmlnLnB1bGxSZXF1ZXN0LnZhbGlkYXRvcnMsXG4gICAgICAuLi5wYXJ0aWFsVmFsaWRhdGlvbkNvbmZpZyxcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmdpdC5oYXNVbmNvbW1pdHRlZENoYW5nZXMoKSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsTWVyZ2VUb29sRXJyb3IoXG4gICAgICAgICdMb2NhbCB3b3JraW5nIHJlcG9zaXRvcnkgbm90IGNsZWFuLiBQbGVhc2UgbWFrZSBzdXJlIHRoZXJlIGFyZSAnICtcbiAgICAgICAgICAnbm8gdW5jb21taXR0ZWQgY2hhbmdlcy4nLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5naXQuaXNTaGFsbG93UmVwbygpKSB7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxNZXJnZVRvb2xFcnJvcihcbiAgICAgICAgYFVuYWJsZSB0byBwZXJmb3JtIG1lcmdlIGluIGEgbG9jYWwgcmVwb3NpdG9yeSB0aGF0IGlzIGNvbmZpZ3VyZWQgYXMgc2hhbGxvdy5cXG5gICtcbiAgICAgICAgICBgUGxlYXNlIGNvbnZlcnQgdGhlIHJlcG9zaXRvcnkgdG8gYSBjb21wbGV0ZSBvbmUgYnkgc3luY2luZyB3aXRoIHVwc3RyZWFtLlxcbmAgK1xuICAgICAgICAgIGBodHRwczovL2dpdC1zY20uY29tL2RvY3MvZ2l0LWZldGNoI0RvY3VtZW50YXRpb24vZ2l0LWZldGNoLnR4dC0tLXVuc2hhbGxvd2AsXG4gICAgICApO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuY29uZmlybU1lcmdlQWNjZXNzKCk7XG5cbiAgICBjb25zdCBwdWxsUmVxdWVzdCA9IGF3YWl0IGxvYWRBbmRWYWxpZGF0ZVB1bGxSZXF1ZXN0KHRoaXMsIHByTnVtYmVyLCB2YWxpZGF0aW9uQ29uZmlnKTtcblxuICAgIGlmIChwdWxsUmVxdWVzdC52YWxpZGF0aW9uRmFpbHVyZXMubGVuZ3RoID4gMCkge1xuICAgICAgTG9nLmVycm9yKGBQdWxsIHJlcXVlc3QgZGlkIG5vdCBwYXNzIG9uZSBvciBtb3JlIHZhbGlkYXRpb24gY2hlY2tzLiBFcnJvcjpgKTtcblxuICAgICAgZm9yIChjb25zdCBmYWlsdXJlIG9mIHB1bGxSZXF1ZXN0LnZhbGlkYXRpb25GYWlsdXJlcykge1xuICAgICAgICBMb2cuZXJyb3IoYCAtPiAke2JvbGQoZmFpbHVyZS5tZXNzYWdlKX1gKTtcbiAgICAgIH1cbiAgICAgIExvZy5pbmZvKCk7XG5cbiAgICAgIGlmIChwdWxsUmVxdWVzdC52YWxpZGF0aW9uRmFpbHVyZXMuc29tZSgoZmFpbHVyZSkgPT4gIWZhaWx1cmUuY2FuQmVGb3JjZUlnbm9yZWQpKSB7XG4gICAgICAgIExvZy5kZWJ1ZygnRGlzY292ZXJlZCBhIGZhdGFsIGVycm9yLCB3aGljaCBjYW5ub3QgYmUgZm9yY2VkJyk7XG4gICAgICAgIHRocm93IG5ldyBQdWxsUmVxdWVzdFZhbGlkYXRpb25FcnJvcigpO1xuICAgICAgfVxuXG4gICAgICBMb2cuaW5mbyh5ZWxsb3coYEFsbCBkaXNjb3ZlcmVkIHZhbGlkYXRpb25zIGFyZSBub24tZmF0YWwgYW5kIGNhbiBiZSBmb3JjaWJseSBpZ25vcmVkLmApKTtcbiAgICAgIGlmICghKGF3YWl0IFByb21wdC5jb25maXJtKCdEbyB5b3Ugd2FudCB0byBmb3JjaWJseSBpZ25vcmUgdGhlc2UgdmFsaWRhdGlvbiBmYWlsdXJlcz8nKSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFB1bGxSZXF1ZXN0VmFsaWRhdGlvbkVycm9yKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZmxhZ3MuZm9yY2VNYW51YWxCcmFuY2hlcykge1xuICAgICAgYXdhaXQgdGhpcy51cGRhdGVQdWxsUmVxdWVzdFRhcmdldGVkQnJhbmNoZXNGcm9tUHJvbXB0KHB1bGxSZXF1ZXN0KTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgcHVsbCByZXF1ZXN0IGhhcyBhIGNhcmV0YWtlciBub3RlIGFwcGxpZWQsIHJhaXNlIGF3YXJlbmVzcyBieSBwcm9tcHRpbmdcbiAgICAvLyB0aGUgY2FyZXRha2VyLiBUaGUgY2FyZXRha2VyIGNhbiB0aGVuIGRlY2lkZSB0byBwcm9jZWVkIG9yIGFib3J0IHRoZSBtZXJnZS5cbiAgICBpZiAoXG4gICAgICBwdWxsUmVxdWVzdC5oYXNDYXJldGFrZXJOb3RlICYmXG4gICAgICAhKGF3YWl0IFByb21wdC5jb25maXJtKGdldENhcmV0YWtlck5vdGVQcm9tcHRNZXNzYWdlKHB1bGxSZXF1ZXN0KSkpXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgVXNlckFib3J0ZWRNZXJnZVRvb2xFcnJvcigpO1xuICAgIH1cblxuICAgIGNvbnN0IHN0cmF0ZWd5ID0gdGhpcy5jb25maWcucHVsbFJlcXVlc3QuZ2l0aHViQXBpTWVyZ2VcbiAgICAgID8gbmV3IEdpdGh1YkFwaU1lcmdlU3RyYXRlZ3kodGhpcy5naXQsIHRoaXMuY29uZmlnLnB1bGxSZXF1ZXN0LmdpdGh1YkFwaU1lcmdlKVxuICAgICAgOiBuZXcgQXV0b3NxdWFzaE1lcmdlU3RyYXRlZ3kodGhpcy5naXQpO1xuXG4gICAgLy8gQnJhbmNoIG9yIHJldmlzaW9uIHRoYXQgaXMgY3VycmVudGx5IGNoZWNrZWQgb3V0IHNvIHRoYXQgd2UgY2FuIHN3aXRjaCBiYWNrIHRvXG4gICAgLy8gaXQgb25jZSB0aGUgcHVsbCByZXF1ZXN0IGhhcyBiZWVuIG1lcmdlZC5cbiAgICBjb25zdCBwcmV2aW91c0JyYW5jaE9yUmV2aXNpb24gPSB0aGlzLmdpdC5nZXRDdXJyZW50QnJhbmNoT3JSZXZpc2lvbigpO1xuXG4gICAgLy8gVGhlIGZvbGxvd2luZyBibG9jayBydW5zIEdpdCBjb21tYW5kcyBhcyBjaGlsZCBwcm9jZXNzZXMuIFRoZXNlIEdpdCBjb21tYW5kcyBjYW4gZmFpbC5cbiAgICAvLyBXZSB3YW50IHRvIGNhcHR1cmUgdGhlc2UgY29tbWFuZCBlcnJvcnMgYW5kIHJldHVybiBhbiBhcHByb3ByaWF0ZSBtZXJnZSByZXF1ZXN0IHN0YXR1cy5cbiAgICB0cnkge1xuICAgICAgLy8gUnVuIHByZXBhcmF0aW9ucyBmb3IgdGhlIG1lcmdlIChlLmcuIGZldGNoaW5nIGJyYW5jaGVzKS5cbiAgICAgIGF3YWl0IHN0cmF0ZWd5LnByZXBhcmUocHVsbFJlcXVlc3QpO1xuXG4gICAgICAvLyBQcmludCB0aGUgdGFyZ2V0IGJyYW5jaGVzLlxuICAgICAgTG9nLmluZm8oKTtcbiAgICAgIExvZy5pbmZvKGdldFRhcmdldGVkQnJhbmNoZXNNZXNzYWdlKHB1bGxSZXF1ZXN0KSk7XG5cbiAgICAgIC8vIENoZWNrIGZvciBjb25mbGljdHMgYmV0d2VlbiB0aGUgcHVsbCByZXF1ZXN0IGFuZCB0YXJnZXQgYnJhbmNoZXMuXG4gICAgICBhd2FpdCBzdHJhdGVneS5jaGVjayhwdWxsUmVxdWVzdCk7XG5cbiAgICAgIExvZy5pbmZvKCcnKTtcbiAgICAgIExvZy5pbmZvKGdyZWVuKGAgICAgIFBSOiAke2JvbGQocHVsbFJlcXVlc3QudGl0bGUpfWApKTtcbiAgICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgUHVsbCByZXF1ZXN0IGNhbiBiZSBtZXJnZWQgaW50byBhbGwgdGFyZ2V0IGJyYW5jaGVzLmApKTtcbiAgICAgIExvZy5pbmZvKCk7XG5cbiAgICAgIGlmICh0aGlzLmZsYWdzLmRyeVJ1bikge1xuICAgICAgICBMb2cuaW5mbyhncmVlbihgICDinJMgIEV4aXRpbmcgZHVlIHRvIGRyeSBydW4gbW9kZS5gKSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICAvLyBJZiB0aGVyZSBpcyBubyB0YXJnZXQgbGFiZWxpbmcgdGhlbiB0aGUgcHVsbCByZXF1ZXN0IGlzIGFsd2F5cyBqdXN0IGRpcmVjdGx5IG1lcmdlZCwgc29cbiAgICAgICAgLy8gdGhlIGNvbmZpcm1hdGlvbiBjYW4gYmUgc2tpcHBlZC5cbiAgICAgICAgIXRoaXMuY29uZmlnLnB1bGxSZXF1ZXN0Ll9fbm9UYXJnZXRMYWJlbGluZyAmJlxuICAgICAgICAvLyBJbiBjYXNlcyB3aGVyZSBtYW51YWwgYnJhbmNoIHRhcmdldGluZyBpcyB1c2VkLCB0aGUgdXNlciBhbHJlYWR5IGNvbmZpcm1lZC5cbiAgICAgICAgIXRoaXMuZmxhZ3MuZm9yY2VNYW51YWxCcmFuY2hlcyAmJlxuICAgICAgICB0aGlzLmZsYWdzLmJyYW5jaFByb21wdCAmJlxuICAgICAgICAhKGF3YWl0IFByb21wdC5jb25maXJtKGdldFRhcmdldGVkQnJhbmNoZXNDb25maXJtYXRpb25Qcm9tcHRNZXNzYWdlKCkpKVxuICAgICAgKSB7XG4gICAgICAgIHRocm93IG5ldyBVc2VyQWJvcnRlZE1lcmdlVG9vbEVycm9yKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFBlcmZvcm0gdGhlIG1lcmdlIGFuZCBwYXNzLXRocm91Z2ggcG90ZW50aWFsIGZhaWx1cmVzLlxuICAgICAgYXdhaXQgc3RyYXRlZ3kubWVyZ2UocHVsbFJlcXVlc3QpO1xuICAgICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICBTdWNjZXNzZnVsbHkgbWVyZ2VkIHRoZSBwdWxsIHJlcXVlc3Q6ICMke3ByTnVtYmVyfWApKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgLy8gU3dpdGNoIGJhY2sgdG8gdGhlIHByZXZpb3VzIGJyYW5jaC4gV2UgbmVlZCB0byBkbyB0aGlzIGJlZm9yZSBkZWxldGluZyB0aGUgdGVtcG9yYXJ5XG4gICAgICAvLyBicmFuY2hlcyBiZWNhdXNlIHdlIGNhbm5vdCBkZWxldGUgYnJhbmNoZXMgd2hpY2ggYXJlIGN1cnJlbnRseSBjaGVja2VkIG91dC5cbiAgICAgIHRoaXMuZ2l0LnJ1bihbJ2NoZWNrb3V0JywgJy1mJywgcHJldmlvdXNCcmFuY2hPclJldmlzaW9uXSk7XG5cbiAgICAgIGF3YWl0IHN0cmF0ZWd5LmNsZWFudXAocHVsbFJlcXVlc3QpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNb2RpZmllcyB0aGUgcHVsbCByZXF1ZXN0IGluIHBsYWNlIHdpdGggbmV3IHRhcmdldCBicmFuY2hlcyBiYXNlZCBvbiB1c2VyXG4gICAqIHNlbGVjdGlvbiBmcm9tIHRoZSBhdmFpbGFibGUgYWN0aXZlIGJyYW5jaGVzLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyB1cGRhdGVQdWxsUmVxdWVzdFRhcmdldGVkQnJhbmNoZXNGcm9tUHJvbXB0KFxuICAgIHB1bGxSZXF1ZXN0OiBQdWxsUmVxdWVzdCxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qge25hbWU6IHJlcG9OYW1lLCBvd25lcn0gPSB0aGlzLmNvbmZpZy5naXRodWI7XG5cbiAgICAvLyBBdHRlbXB0IHRvIHJldHJpZXZlIHRoZSBhY3RpdmUgTFRTIGJyYW5jaGVzIHRvIGJlIGluY2x1ZGVkIGluIHRoZSBzZWxlY3Rpb24uXG4gICAgbGV0IGx0c0JyYW5jaGVzOiB7YnJhbmNoTmFtZTogc3RyaW5nOyB2ZXJzaW9uOiBzZW12ZXIuU2VtVmVyfVtdID0gW107XG4gICAgdHJ5IHtcbiAgICAgIGFzc2VydFZhbGlkUmVsZWFzZUNvbmZpZyh0aGlzLmNvbmZpZyk7XG4gICAgICBjb25zdCBsdHNCcmFuY2hlc0Zyb21OcG0gPSBhd2FpdCBmZXRjaExvbmdUZXJtU3VwcG9ydEJyYW5jaGVzRnJvbU5wbSh0aGlzLmNvbmZpZy5yZWxlYXNlKTtcbiAgICAgIGx0c0JyYW5jaGVzID0gbHRzQnJhbmNoZXNGcm9tTnBtLmFjdGl2ZS5tYXAoKHtuYW1lLCB2ZXJzaW9ufSkgPT4gKHtcbiAgICAgICAgYnJhbmNoTmFtZTogbmFtZSxcbiAgICAgICAgdmVyc2lvbixcbiAgICAgIH0pKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIExvZy53YXJuKFxuICAgICAgICAnVW5hYmxlIHRvIGRldGVybWluZSB0aGUgYWN0aXZlIExUUyBicmFuY2hlcyBhcyBhIHJlbGVhc2UgY29uZmlnIGlzIG5vdCBzZXQgZm9yIHRoaXMgcmVwby4nLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBHYXRoZXIgdGhlIGN1cnJlbnQgYWN0aXZlIHJlbGVhc2UgdHJhaW5zLlxuICAgIGNvbnN0IHtsYXRlc3QsIG5leHQsIHJlbGVhc2VDYW5kaWRhdGV9ID0gYXdhaXQgQWN0aXZlUmVsZWFzZVRyYWlucy5mZXRjaCh7XG4gICAgICBuYW1lOiByZXBvTmFtZSxcbiAgICAgIG5leHRCcmFuY2hOYW1lOiBnZXROZXh0QnJhbmNoTmFtZSh0aGlzLmNvbmZpZy5naXRodWIpLFxuICAgICAgb3duZXIsXG4gICAgICBhcGk6IHRoaXMuZ2l0LmdpdGh1YixcbiAgICB9KTtcblxuICAgIC8vIENvbGxhdGUgdGhlIGtub3duIGFjdGl2ZSBicmFuY2hlcyBpbnRvIGEgc2luZ2xlIGxpc3QuXG4gICAgY29uc3QgYWN0aXZlQnJhbmNoZXM6IHticmFuY2hOYW1lOiBzdHJpbmc7IHZlcnNpb246IHNlbXZlci5TZW1WZXJ9W10gPSBbXG4gICAgICBuZXh0LFxuICAgICAgbGF0ZXN0LFxuICAgICAgLi4ubHRzQnJhbmNoZXMsXG4gICAgXTtcbiAgICBpZiAocmVsZWFzZUNhbmRpZGF0ZSAhPT0gbnVsbCkge1xuICAgICAgLy8gU2luY2UgdGhlIG5leHQgdmVyc2lvbiB3aWxsIGFsd2F5cyBiZSB0aGUgcHJpbWFyeSBnaXRodWIgYnJhbmNoIHJhdGhlciB0aGFuIHNlbXZlciwgdGhlIFJDXG4gICAgICAvLyBicmFuY2ggc2hvdWxkIGJlIGluY2x1ZGVkIGFzIHRoZSBzZWNvbmQgaXRlbSBpbiB0aGUgbGlzdC5cbiAgICAgIGFjdGl2ZUJyYW5jaGVzLnNwbGljZSgxLCAwLCByZWxlYXNlQ2FuZGlkYXRlKTtcbiAgICB9XG5cbiAgICBjb25zdCB7c2VsZWN0ZWRCcmFuY2hlcywgY29uZmlybX0gPSBhd2FpdCBpbnF1aXJlci5wcm9tcHQoW1xuICAgICAge1xuICAgICAgICB0eXBlOiAnY2hlY2tib3gnLFxuICAgICAgICBkZWZhdWx0OiBwdWxsUmVxdWVzdC50YXJnZXRCcmFuY2hlcyxcbiAgICAgICAgY2hvaWNlczogYWN0aXZlQnJhbmNoZXMubWFwKCh7YnJhbmNoTmFtZSwgdmVyc2lvbn0pID0+IHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY2hlY2tlZDogcHVsbFJlcXVlc3QudGFyZ2V0QnJhbmNoZXMuaW5jbHVkZXMoYnJhbmNoTmFtZSksXG4gICAgICAgICAgICB2YWx1ZTogYnJhbmNoTmFtZSxcbiAgICAgICAgICAgIHNob3J0OiBicmFuY2hOYW1lLFxuICAgICAgICAgICAgbmFtZTogYCR7YnJhbmNoTmFtZX0gKCR7dmVyc2lvbn0pJHtcbiAgICAgICAgICAgICAgYnJhbmNoTmFtZSA9PT0gcHVsbFJlcXVlc3QuZ2l0aHViVGFyZ2V0QnJhbmNoID8gJyBbVGFyZ2V0ZWQgdmlhIEdpdGh1YiBVSV0nIDogJydcbiAgICAgICAgICAgIH1gLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pLFxuICAgICAgICBtZXNzYWdlOiAnU2VsZWN0IGJyYW5jaGVzIHRvIG1lcmdlIHB1bGwgcmVxdWVzdCBpbnRvOicsXG4gICAgICAgIG5hbWU6ICdzZWxlY3RlZEJyYW5jaGVzJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdjb25maXJtJyxcbiAgICAgICAgZGVmYXVsdDogZmFsc2UsXG4gICAgICAgIG1lc3NhZ2U6XG4gICAgICAgICAgcmVkKCchISEhISEgV0FSTklORyAhISEhISEhXFxuJykgK1xuICAgICAgICAgIHllbGxvdyhcbiAgICAgICAgICAgICdVc2luZyBtYW51YWwgYnJhbmNoIHNlbGVjdGlvbiBkaXNhYmxlcyBwcm90ZWN0aXZlIGNoZWNrcyBwcm92aWRlZCBieSB0aGUgbWVyZ2UgJyArXG4gICAgICAgICAgICAgICd0b29saW5nLiBUaGlzIG1lYW5zIHRoYXQgdGhlIG1lcmdlIHRvb2xpbmcgd2lsbCBub3QgcHJldmVudCBjaGFuZ2VzIHdoaWNoIGFyZSBub3QgJyArXG4gICAgICAgICAgICAgICdhbGxvd2VkIGZvciB0aGUgdGFyZ2V0ZWQgYnJhbmNoZXMuIFBsZWFzZSBwcm9jZWVkIHdpdGggY2F1dGlvbi5cXG4nLFxuICAgICAgICAgICkgK1xuICAgICAgICAgICdBcmUgeW91IHN1cmUgeW91IHdvdWxkIGxpa2UgdG8gcHJvY2VlZCB3aXRoIHRoZSBzZWxlY3RlZCBicmFuY2hlcz8nLFxuICAgICAgICBuYW1lOiAnY29uZmlybScsXG4gICAgICB9LFxuICAgIF0pO1xuXG4gICAgaWYgKGNvbmZpcm0gPT09IGZhbHNlKSB7XG4gICAgICB0aHJvdyBuZXcgVXNlckFib3J0ZWRNZXJnZVRvb2xFcnJvcigpO1xuICAgIH1cblxuICAgIC8vIFRoZSBHaXRodWIgVGFyZ2V0ZWQgYnJhbmNoIG11c3QgYWx3YXlzIGJlIHNlbGVjdGVkLiBJdCBpcyBub3QgY3VycmVudGx5IHBvc3NpYmxlXG4gICAgLy8gdG8gbWFrZSBhIHJlYWRvbmx5IHNlbGVjdGlvbiBpbiBpbnF1aXJlcidzIGNoZWNrYm94LlxuICAgIGlmICghc2VsZWN0ZWRCcmFuY2hlcy5pbmNsdWRlcyhwdWxsUmVxdWVzdC5naXRodWJUYXJnZXRCcmFuY2gpKSB7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxNZXJnZVRvb2xFcnJvcihcbiAgICAgICAgYFB1bGwgUmVxdWVzdHMgbXVzdCBtZXJnZSBpbnRvIHRoZWlyIHRhcmdldGVkIEdpdGh1YiBicmFuY2guIElmIHRoaXMgYnJhbmNoICgke3B1bGxSZXF1ZXN0LmdpdGh1YlRhcmdldEJyYW5jaH0pIGAgK1xuICAgICAgICAgICdzaG91bGQgbm90IGJlIGluY2x1ZGVkLCBwbGVhc2UgY2hhbmdlIHRoZSB0YXJnZXRlZCBicmFuY2ggdmlhIHRoZSBHaXRodWIgVUkuJyxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcHVsbFJlcXVlc3QudGFyZ2V0QnJhbmNoZXMgPSBzZWxlY3RlZEJyYW5jaGVzO1xuICB9XG5cbiAgYXN5bmMgY29uZmlybU1lcmdlQWNjZXNzKCkge1xuICAgIGlmICh0aGlzLmdpdC51c2VyVHlwZSA9PT0gJ3VzZXInKSB7XG4gICAgICAvLyBDaGVjayB3aGV0aGVyIHRoZSBnaXZlbiBHaXRodWIgdG9rZW4gaGFzIHN1ZmZpY2llbnQgcGVybWlzc2lvbnMgZm9yIHdyaXRpbmdcbiAgICAgIC8vIHRvIHRoZSBjb25maWd1cmVkIHJlcG9zaXRvcnkuIElmIHRoZSByZXBvc2l0b3J5IGlzIG5vdCBwcml2YXRlLCBvbmx5IHRoZVxuICAgICAgLy8gcmVkdWNlZCBgcHVibGljX3JlcG9gIE9BdXRoIHNjb3BlIGlzIHN1ZmZpY2llbnQgZm9yIHBlcmZvcm1pbmcgbWVyZ2VzLlxuICAgICAgY29uc3QgaGFzT2F1dGhTY29wZXMgPSBhd2FpdCB0aGlzLmdpdC5oYXNPYXV0aFNjb3Blcygoc2NvcGVzLCBtaXNzaW5nKSA9PiB7XG4gICAgICAgIGlmICghc2NvcGVzLmluY2x1ZGVzKCdyZXBvJykpIHtcbiAgICAgICAgICBpZiAodGhpcy5jb25maWcuZ2l0aHViLnByaXZhdGUpIHtcbiAgICAgICAgICAgIG1pc3NpbmcucHVzaCgncmVwbycpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoIXNjb3Blcy5pbmNsdWRlcygncHVibGljX3JlcG8nKSkge1xuICAgICAgICAgICAgbWlzc2luZy5wdXNoKCdwdWJsaWNfcmVwbycpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFB1bGwgcmVxdWVzdHMgY2FuIG1vZGlmeSBHaXRodWIgYWN0aW9uIHdvcmtmbG93IGZpbGVzLiBJbiBzdWNoIGNhc2VzIEdpdGh1YiByZXF1aXJlcyB1cyB0b1xuICAgICAgICAvLyBwdXNoIHdpdGggYSB0b2tlbiB0aGF0IGhhcyB0aGUgYHdvcmtmbG93YCBvYXV0aCBzY29wZSBzZXQuIFRvIGF2b2lkIGVycm9ycyB3aGVuIHRoZVxuICAgICAgICAvLyBjYXJldGFrZXIgaW50ZW5kcyB0byBtZXJnZSBzdWNoIFBScywgd2UgZW5zdXJlIHRoZSBzY29wZSBpcyBhbHdheXMgc2V0IG9uIHRoZSB0b2tlbiBiZWZvcmVcbiAgICAgICAgLy8gdGhlIG1lcmdlIHByb2Nlc3Mgc3RhcnRzLlxuICAgICAgICAvLyBodHRwczovL2RvY3MuZ2l0aHViLmNvbS9lbi9kZXZlbG9wZXJzL2FwcHMvc2NvcGVzLWZvci1vYXV0aC1hcHBzI2F2YWlsYWJsZS1zY29wZXNcbiAgICAgICAgaWYgKCFzY29wZXMuaW5jbHVkZXMoJ3dvcmtmbG93JykpIHtcbiAgICAgICAgICBtaXNzaW5nLnB1c2goJ3dvcmtmbG93Jyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpZiAoaGFzT2F1dGhTY29wZXMgIT09IHRydWUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEZhdGFsTWVyZ2VUb29sRXJyb3IoaGFzT2F1dGhTY29wZXMuZXJyb3IpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUT0RPKGpvc2VwaHBlcnJvdHQpOiBGaW5kIGEgd2F5IHRvIGNoZWNrIGFjY2VzcyBvZiB0aGUgaW5zdGFsbGF0aW9uIHdpdGhvdXQgdXNpbmcgYSBKV1QuXG4gICAgICBMb2cuZGVidWcoJ0Fzc3VtaW5nIGNvcnJlY3QgYWNjZXNzIGJlY2F1c2UgdGhpcyBhIGJvdCBhY2NvdW50LicpO1xuICAgIH1cbiAgfVxufVxuIl19