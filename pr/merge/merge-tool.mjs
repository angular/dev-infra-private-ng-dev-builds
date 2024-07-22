/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { bold, green, Log, red, yellow } from '../../utils/logging.js';
import { getCaretakerNotePromptMessage, getTargetedBranchesConfirmationPromptMessage, getTargetedBranchesMessage, } from './messages.js';
import { loadAndValidatePullRequest } from './pull-request.js';
import { GithubApiMergeStrategy } from './strategies/api-merge.js';
import { AutosquashMergeStrategy } from './strategies/autosquash-merge.js';
import { assertValidReleaseConfig } from '../../release/config/index.js';
import { ActiveReleaseTrains, fetchLongTermSupportBranchesFromNpm, getNextBranchName, } from '../../release/versioning/index.js';
import { FatalMergeToolError, PullRequestValidationError, UserAbortedMergeToolError, } from './failures.js';
import { createPullRequestValidationConfig } from '../common/validation/validation-config.js';
import { Prompt } from '../../utils/prompt.js';
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
            if (!(await Prompt.confirm({
                message: 'Do you want to forcibly ignore these validation failures?',
            }))) {
                throw new PullRequestValidationError();
            }
        }
        if (this.flags.forceManualBranches) {
            await this.updatePullRequestTargetedBranchesFromPrompt(pullRequest);
        }
        // If the pull request has a caretaker note applied, raise awareness by prompting
        // the caretaker. The caretaker can then decide to proceed or abort the merge.
        if (pullRequest.hasCaretakerNote &&
            !(await Prompt.confirm({ message: getCaretakerNotePromptMessage(pullRequest) }))) {
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
                !(await Prompt.confirm({ message: getTargetedBranchesConfirmationPromptMessage() }))) {
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
        const selectedBranches = await Prompt.checkbox({
            choices: activeBranches.map(({ branchName, version }) => {
                return {
                    checked: pullRequest.targetBranches.includes(branchName),
                    value: branchName,
                    short: branchName,
                    name: `${branchName} (${version})${branchName === pullRequest.githubTargetBranch ? ' [Targeted via Github UI]' : ''}`,
                };
            }),
            message: 'Select branches to merge pull request into:',
        });
        const confirmation = await Prompt.confirm({
            default: false,
            message: red('!!!!!! WARNING !!!!!!!\n') +
                yellow('Using manual branch selection disables protective checks provided by the merge ' +
                    'tooling. This means that the merge tooling will not prevent changes which are not ' +
                    'allowed for the targeted branches. Please proceed with caution.\n') +
                'Are you sure you would like to proceed with the selected branches?',
        });
        if (confirmation === false) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVyZ2UtdG9vbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9wci9tZXJnZS9tZXJnZS10b29sLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFHckUsT0FBTyxFQUNMLDZCQUE2QixFQUM3Qiw0Q0FBNEMsRUFDNUMsMEJBQTBCLEdBQzNCLE1BQU0sZUFBZSxDQUFDO0FBQ3ZCLE9BQU8sRUFBQywwQkFBMEIsRUFBYyxNQUFNLG1CQUFtQixDQUFDO0FBQzFFLE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBQ2pFLE9BQU8sRUFBQyx1QkFBdUIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBRXpFLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ3ZFLE9BQU8sRUFDTCxtQkFBbUIsRUFDbkIsbUNBQW1DLEVBQ25DLGlCQUFpQixHQUNsQixNQUFNLG1DQUFtQyxDQUFDO0FBQzNDLE9BQU8sRUFDTCxtQkFBbUIsRUFDbkIsMEJBQTBCLEVBQzFCLHlCQUF5QixHQUMxQixNQUFNLGVBQWUsQ0FBQztBQUN2QixPQUFPLEVBQUMsaUNBQWlDLEVBQUMsTUFBTSwyQ0FBMkMsQ0FBQztBQUM1RixPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFTN0MsTUFBTSw0QkFBNEIsR0FBMEI7SUFDMUQsWUFBWSxFQUFFLElBQUk7SUFDbEIsbUJBQW1CLEVBQUUsS0FBSztJQUMxQixNQUFNLEVBQUUsS0FBSztJQUNiLG9CQUFvQixFQUFFLEtBQUs7Q0FDNUIsQ0FBQztBQUVGOzs7O0dBSUc7QUFDSCxNQUFNLE9BQU8sU0FBUztJQUdwQixZQUNTLE1BR0wsRUFDSyxHQUEyQixFQUNs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QyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUMvQixPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUN2QixDQUFDO3lCQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7d0JBQzNDLE9BQU8sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7b0JBQzlCLENBQUM7Z0JBQ0gsQ0FBQztnQkFFRCw2RkFBNkY7Z0JBQzdGLHNGQUFzRjtnQkFDdEYsNkZBQTZGO2dCQUM3Riw0QkFBNEI7Z0JBQzVCLG9GQUFvRjtnQkFDcEYsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztvQkFDakMsT0FBTyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDM0IsQ0FBQztZQUNILENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxjQUFjLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQzVCLE1BQU0sSUFBSSxtQkFBbUIsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDdEQsQ0FBQztZQUNELE9BQU87UUFDVCxDQUFDO2FBQU0sQ0FBQztZQUNOLDJGQUEyRjtZQUMzRixHQUFHLENBQUMsS0FBSyxDQUFDLHFEQUFxRCxDQUFDLENBQUM7UUFDbkUsQ0FBQztJQUNILENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0F1dGhlbnRpY2F0ZWRHaXRDbGllbnR9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQuanMnO1xuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xuaW1wb3J0IHtib2xkLCBncmVlbiwgTG9nLCByZWQsIHllbGxvd30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5cbmltcG9ydCB7UHVsbFJlcXVlc3RDb25maWcsIFB1bGxSZXF1ZXN0VmFsaWRhdGlvbkNvbmZpZ30gZnJvbSAnLi4vY29uZmlnL2luZGV4LmpzJztcbmltcG9ydCB7XG4gIGdldENhcmV0YWtlck5vdGVQcm9tcHRNZXNzYWdlLFxuICBnZXRUYXJnZXRlZEJyYW5jaGVzQ29uZmlybWF0aW9uUHJvbXB0TWVzc2FnZSxcbiAgZ2V0VGFyZ2V0ZWRCcmFuY2hlc01lc3NhZ2UsXG59IGZyb20gJy4vbWVzc2FnZXMuanMnO1xuaW1wb3J0IHtsb2FkQW5kVmFsaWRhdGVQdWxsUmVxdWVzdCwgUHVsbFJlcXVlc3R9IGZyb20gJy4vcHVsbC1yZXF1ZXN0LmpzJztcbmltcG9ydCB7R2l0aHViQXBpTWVyZ2VTdHJhdGVneX0gZnJvbSAnLi9zdHJhdGVnaWVzL2FwaS1tZXJnZS5qcyc7XG5pbXBvcnQge0F1dG9zcXVhc2hNZXJnZVN0cmF0ZWd5fSBmcm9tICcuL3N0cmF0ZWdpZXMvYXV0b3NxdWFzaC1tZXJnZS5qcyc7XG5pbXBvcnQge0dpdGh1YkNvbmZpZywgTmdEZXZDb25maWd9IGZyb20gJy4uLy4uL3V0aWxzL2NvbmZpZy5qcyc7XG5pbXBvcnQge2Fzc2VydFZhbGlkUmVsZWFzZUNvbmZpZ30gZnJvbSAnLi4vLi4vcmVsZWFzZS9jb25maWcvaW5kZXguanMnO1xuaW1wb3J0IHtcbiAgQWN0aXZlUmVsZWFzZVRyYWlucyxcbiAgZmV0Y2hMb25nVGVybVN1cHBvcnRCcmFuY2hlc0Zyb21OcG0sXG4gIGdldE5leHRCcmFuY2hOYW1lLFxufSBmcm9tICcuLi8uLi9yZWxlYXNlL3ZlcnNpb25pbmcvaW5kZXguanMnO1xuaW1wb3J0IHtcbiAgRmF0YWxNZXJnZVRvb2xFcnJvcixcbiAgUHVsbFJlcXVlc3RWYWxpZGF0aW9uRXJyb3IsXG4gIFVzZXJBYm9ydGVkTWVyZ2VUb29sRXJyb3IsXG59IGZyb20gJy4vZmFpbHVyZXMuanMnO1xuaW1wb3J0IHtjcmVhdGVQdWxsUmVxdWVzdFZhbGlkYXRpb25Db25maWd9IGZyb20gJy4uL2NvbW1vbi92YWxpZGF0aW9uL3ZhbGlkYXRpb24tY29uZmlnLmpzJztcbmltcG9ydCB7UHJvbXB0fSBmcm9tICcuLi8uLi91dGlscy9wcm9tcHQuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFB1bGxSZXF1ZXN0TWVyZ2VGbGFncyB7XG4gIGJyYW5jaFByb21wdDogYm9vbGVhbjtcbiAgZm9yY2VNYW51YWxCcmFuY2hlczogYm9vbGVhbjtcbiAgZHJ5UnVuOiBib29sZWFuO1xuICBpZ25vcmVQZW5kaW5nUmV2aWV3czogYm9vbGVhbjtcbn1cblxuY29uc3QgZGVmYXVsdFB1bGxSZXF1ZXN0TWVyZ2VGbGFnczogUHVsbFJlcXVlc3RNZXJnZUZsYWdzID0ge1xuICBicmFuY2hQcm9tcHQ6IHRydWUsXG4gIGZvcmNlTWFudWFsQnJhbmNoZXM6IGZhbHNlLFxuICBkcnlSdW46IGZhbHNlLFxuICBpZ25vcmVQZW5kaW5nUmV2aWV3czogZmFsc2UsXG59O1xuXG4vKipcbiAqIENsYXNzIHRoYXQgYWNjZXB0cyBhIG1lcmdlIHNjcmlwdCBjb25maWd1cmF0aW9uIGFuZCBHaXRodWIgdG9rZW4uIEl0IHByb3ZpZGVzXG4gKiBhIHByb2dyYW1tYXRpYyBpbnRlcmZhY2UgZm9yIG1lcmdpbmcgbXVsdGlwbGUgcHVsbCByZXF1ZXN0cyBiYXNlZCBvbiB0aGVpclxuICogbGFiZWxzIHRoYXQgaGF2ZSBiZWVuIHJlc29sdmVkIHRocm91Z2ggdGhlIG1lcmdlIHNjcmlwdCBjb25maWd1cmF0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgTWVyZ2VUb29sIHtcbiAgcHJpdmF0ZSBmbGFnczogUHVsbFJlcXVlc3RNZXJnZUZsYWdzO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyBjb25maWc6IE5nRGV2Q29uZmlnPHtcbiAgICAgIHB1bGxSZXF1ZXN0OiBQdWxsUmVxdWVzdENvbmZpZztcbiAgICAgIGdpdGh1YjogR2l0aHViQ29uZmlnO1xuICAgIH0+LFxuICAgIHB1YmxpYyBnaXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4gICAgZmxhZ3M6IFBhcnRpYWw8UHVsbFJlcXVlc3RNZXJnZUZsYWdzPixcbiAgKSB7XG4gICAgLy8gVXBkYXRlIGZsYWdzIHByb3BlcnR5IHdpdGggdGhlIHByb3ZpZGVkIGZsYWdzIHZhbHVlcyBhcyBwYXRjaGVzIHRvIHRoZSBkZWZhdWx0IGZsYWcgdmFsdWVzLlxuICAgIHRoaXMuZmxhZ3MgPSB7Li4uZGVmYXVsdFB1bGxSZXF1ZXN0TWVyZ2VGbGFncywgLi4uZmxhZ3N9O1xuICB9XG5cbiAgLyoqXG4gICAqIE1lcmdlcyB0aGUgZ2l2ZW4gcHVsbCByZXF1ZXN0IGFuZCBwdXNoZXMgaXQgdXBzdHJlYW0uXG4gICAqIEBwYXJhbSBwck51bWJlciBQdWxsIHJlcXVlc3QgdGhhdCBzaG91bGQgYmUgbWVyZ2VkLlxuICAgKiBAcGFyYW0gcGFydGlhbFZhbGlkYXRpb25Db25maWcgUHVsbCByZXF1ZXN0IHZhbGlkYXRpb24gY29uZmlnLiBDYW4gYmUgbW9kaWZpZWQgdG8gc2tpcFxuICAgKiAgIGNlcnRhaW4gbm9uLWZhdGFsIHZhbGlkYXRpb25zLlxuICAgKi9cbiAgYXN5bmMgbWVyZ2UoXG4gICAgcHJOdW1iZXI6IG51bWJlcixcbiAgICBwYXJ0aWFsVmFsaWRhdGlvbkNvbmZpZzogUHVsbFJlcXVlc3RWYWxpZGF0aW9uQ29uZmlnLFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvKiogVGhlIGZ1bGwgdmFsaWRhdGlvbiBjb25maWcsIHVzaW5nIHRoZSBwcm92aWRlZCBjb25maWcgZnJvbSBmbGFncywgY29uZmlnIGFuZCBkZWZhdWx0cy4gKi9cbiAgICBjb25zdCB2YWxpZGF0aW9uQ29uZmlnID0gY3JlYXRlUHVsbFJlcXVlc3RWYWxpZGF0aW9uQ29uZmlnKHtcbiAgICAgIC4uLnRoaXMuY29uZmlnLnB1bGxSZXF1ZXN0LnZhbGlkYXRvcnMsXG4gICAgICAuLi5wYXJ0aWFsVmFsaWRhdGlvbkNvbmZpZyxcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLmdpdC5oYXNVbmNvbW1pdHRlZENoYW5nZXMoKSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsTWVyZ2VUb29sRXJyb3IoXG4gICAgICAgICdMb2NhbCB3b3JraW5nIHJlcG9zaXRvcnkgbm90IGNsZWFuLiBQbGVhc2UgbWFrZSBzdXJlIHRoZXJlIGFyZSAnICtcbiAgICAgICAgICAnbm8gdW5jb21taXR0ZWQgY2hhbmdlcy4nLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5naXQuaXNTaGFsbG93UmVwbygpKSB7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxNZXJnZVRvb2xFcnJvcihcbiAgICAgICAgYFVuYWJsZSB0byBwZXJmb3JtIG1lcmdlIGluIGEgbG9jYWwgcmVwb3NpdG9yeSB0aGF0IGlzIGNvbmZpZ3VyZWQgYXMgc2hhbGxvdy5cXG5gICtcbiAgICAgICAgICBgUGxlYXNlIGNvbnZlcnQgdGhlIHJlcG9zaXRvcnkgdG8gYSBjb21wbGV0ZSBvbmUgYnkgc3luY2luZyB3aXRoIHVwc3RyZWFtLlxcbmAgK1xuICAgICAgICAgIGBodHRwczovL2dpdC1zY20uY29tL2RvY3MvZ2l0LWZldGNoI0RvY3VtZW50YXRpb24vZ2l0LWZldGNoLnR4dC0tLXVuc2hhbGxvd2AsXG4gICAgICApO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuY29uZmlybU1lcmdlQWNjZXNzKCk7XG5cbiAgICBjb25zdCBwdWxsUmVxdWVzdCA9IGF3YWl0IGxvYWRBbmRWYWxpZGF0ZVB1bGxSZXF1ZXN0KHRoaXMsIHByTnVtYmVyLCB2YWxpZGF0aW9uQ29uZmlnKTtcblxuICAgIGlmIChwdWxsUmVxdWVzdC52YWxpZGF0aW9uRmFpbHVyZXMubGVuZ3RoID4gMCkge1xuICAgICAgTG9nLmVycm9yKGBQdWxsIHJlcXVlc3QgZGlkIG5vdCBwYXNzIG9uZSBvciBtb3JlIHZhbGlkYXRpb24gY2hlY2tzLiBFcnJvcjpgKTtcblxuICAgICAgZm9yIChjb25zdCBmYWlsdXJlIG9mIHB1bGxSZXF1ZXN0LnZhbGlkYXRpb25GYWlsdXJlcykge1xuICAgICAgICBMb2cuZXJyb3IoYCAtPiAke2JvbGQoZmFpbHVyZS5tZXNzYWdlKX1gKTtcbiAgICAgIH1cbiAgICAgIExvZy5pbmZvKCk7XG5cbiAgICAgIGlmIChwdWxsUmVxdWVzdC52YWxpZGF0aW9uRmFpbHVyZXMuc29tZSgoZmFpbHVyZSkgPT4gIWZhaWx1cmUuY2FuQmVGb3JjZUlnbm9yZWQpKSB7XG4gICAgICAgIExvZy5kZWJ1ZygnRGlzY292ZXJlZCBhIGZhdGFsIGVycm9yLCB3aGljaCBjYW5ub3QgYmUgZm9yY2VkJyk7XG4gICAgICAgIHRocm93IG5ldyBQdWxsUmVxdWVzdFZhbGlkYXRpb25FcnJvcigpO1xuICAgICAgfVxuXG4gICAgICBMb2cuaW5mbyh5ZWxsb3coYEFsbCBkaXNjb3ZlcmVkIHZhbGlkYXRpb25zIGFyZSBub24tZmF0YWwgYW5kIGNhbiBiZSBmb3JjaWJseSBpZ25vcmVkLmApKTtcbiAgICAgIGlmIChcbiAgICAgICAgIShhd2FpdCBQcm9tcHQuY29uZmlybSh7XG4gICAgICAgICAgbWVzc2FnZTogJ0RvIHlvdSB3YW50IHRvIGZvcmNpYmx5IGlnbm9yZSB0aGVzZSB2YWxpZGF0aW9uIGZhaWx1cmVzPycsXG4gICAgICAgIH0pKVxuICAgICAgKSB7XG4gICAgICAgIHRocm93IG5ldyBQdWxsUmVxdWVzdFZhbGlkYXRpb25FcnJvcigpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLmZsYWdzLmZvcmNlTWFudWFsQnJhbmNoZXMpIHtcbiAgICAgIGF3YWl0IHRoaXMudXBkYXRlUHVsbFJlcXVlc3RUYXJnZXRlZEJyYW5jaGVzRnJvbVByb21wdChwdWxsUmVxdWVzdCk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIHB1bGwgcmVxdWVzdCBoYXMgYSBjYXJldGFrZXIgbm90ZSBhcHBsaWVkLCByYWlzZSBhd2FyZW5lc3MgYnkgcHJvbXB0aW5nXG4gICAgLy8gdGhlIGNhcmV0YWtlci4gVGhlIGNhcmV0YWtlciBjYW4gdGhlbiBkZWNpZGUgdG8gcHJvY2VlZCBvciBhYm9ydCB0aGUgbWVyZ2UuXG4gICAgaWYgKFxuICAgICAgcHVsbFJlcXVlc3QuaGFzQ2FyZXRha2VyTm90ZSAmJlxuICAgICAgIShhd2FpdCBQcm9tcHQuY29uZmlybSh7bWVzc2FnZTogZ2V0Q2FyZXRha2VyTm90ZVByb21wdE1lc3NhZ2UocHVsbFJlcXVlc3QpfSkpXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgVXNlckFib3J0ZWRNZXJnZVRvb2xFcnJvcigpO1xuICAgIH1cblxuICAgIGNvbnN0IHN0cmF0ZWd5ID0gdGhpcy5jb25maWcucHVsbFJlcXVlc3QuZ2l0aHViQXBpTWVyZ2VcbiAgICAgID8gbmV3IEdpdGh1YkFwaU1lcmdlU3RyYXRlZ3kodGhpcy5naXQsIHRoaXMuY29uZmlnLnB1bGxSZXF1ZXN0LmdpdGh1YkFwaU1lcmdlKVxuICAgICAgOiBuZXcgQXV0b3NxdWFzaE1lcmdlU3RyYXRlZ3kodGhpcy5naXQpO1xuXG4gICAgLy8gQnJhbmNoIG9yIHJldmlzaW9uIHRoYXQgaXMgY3VycmVudGx5IGNoZWNrZWQgb3V0IHNvIHRoYXQgd2UgY2FuIHN3aXRjaCBiYWNrIHRvXG4gICAgLy8gaXQgb25jZSB0aGUgcHVsbCByZXF1ZXN0IGhhcyBiZWVuIG1lcmdlZC5cbiAgICBjb25zdCBwcmV2aW91c0JyYW5jaE9yUmV2aXNpb24gPSB0aGlzLmdpdC5nZXRDdXJyZW50QnJhbmNoT3JSZXZpc2lvbigpO1xuXG4gICAgLy8gVGhlIGZvbGxvd2luZyBibG9jayBydW5zIEdpdCBjb21tYW5kcyBhcyBjaGlsZCBwcm9jZXNzZXMuIFRoZXNlIEdpdCBjb21tYW5kcyBjYW4gZmFpbC5cbiAgICAvLyBXZSB3YW50IHRvIGNhcHR1cmUgdGhlc2UgY29tbWFuZCBlcnJvcnMgYW5kIHJldHVybiBhbiBhcHByb3ByaWF0ZSBtZXJnZSByZXF1ZXN0IHN0YXR1cy5cbiAgICB0cnkge1xuICAgICAgLy8gUnVuIHByZXBhcmF0aW9ucyBmb3IgdGhlIG1lcmdlIChlLmcuIGZldGNoaW5nIGJyYW5jaGVzKS5cbiAgICAgIGF3YWl0IHN0cmF0ZWd5LnByZXBhcmUocHVsbFJlcXVlc3QpO1xuXG4gICAgICAvLyBQcmludCB0aGUgdGFyZ2V0IGJyYW5jaGVzLlxuICAgICAgTG9nLmluZm8oKTtcbiAgICAgIExvZy5pbmZvKGdldFRhcmdldGVkQnJhbmNoZXNNZXNzYWdlKHB1bGxSZXF1ZXN0KSk7XG5cbiAgICAgIC8vIENoZWNrIGZvciBjb25mbGljdHMgYmV0d2VlbiB0aGUgcHVsbCByZXF1ZXN0IGFuZCB0YXJnZXQgYnJhbmNoZXMuXG4gICAgICBhd2FpdCBzdHJhdGVneS5jaGVjayhwdWxsUmVxdWVzdCk7XG5cbiAgICAgIExvZy5pbmZvKCcnKTtcbiAgICAgIExvZy5pbmZvKGdyZWVuKGAgICAgIFBSOiAke2JvbGQocHVsbFJlcXVlc3QudGl0bGUpfWApKTtcbiAgICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgUHVsbCByZXF1ZXN0IGNhbiBiZSBtZXJnZWQgaW50byBhbGwgdGFyZ2V0IGJyYW5jaGVzLmApKTtcbiAgICAgIExvZy5pbmZvKCk7XG5cbiAgICAgIGlmICh0aGlzLmZsYWdzLmRyeVJ1bikge1xuICAgICAgICBMb2cuaW5mbyhncmVlbihgICDinJMgIEV4aXRpbmcgZHVlIHRvIGRyeSBydW4gbW9kZS5gKSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICAvLyBJZiB0aGVyZSBpcyBubyB0YXJnZXQgbGFiZWxpbmcgdGhlbiB0aGUgcHVsbCByZXF1ZXN0IGlzIGFsd2F5cyBqdXN0IGRpcmVjdGx5IG1lcmdlZCwgc29cbiAgICAgICAgLy8gdGhlIGNvbmZpcm1hdGlvbiBjYW4gYmUgc2tpcHBlZC5cbiAgICAgICAgIXRoaXMuY29uZmlnLnB1bGxSZXF1ZXN0Ll9fbm9UYXJnZXRMYWJlbGluZyAmJlxuICAgICAgICAvLyBJbiBjYXNlcyB3aGVyZSBtYW51YWwgYnJhbmNoIHRhcmdldGluZyBpcyB1c2VkLCB0aGUgdXNlciBhbHJlYWR5IGNvbmZpcm1lZC5cbiAgICAgICAgIXRoaXMuZmxhZ3MuZm9yY2VNYW51YWxCcmFuY2hlcyAmJlxuICAgICAgICB0aGlzLmZsYWdzLmJyYW5jaFByb21wdCAmJlxuICAgICAgICAhKGF3YWl0IFByb21wdC5jb25maXJtKHttZXNzYWdlOiBnZXRUYXJnZXRlZEJyYW5jaGVzQ29uZmlybWF0aW9uUHJvbXB0TWVzc2FnZSgpfSkpXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IFVzZXJBYm9ydGVkTWVyZ2VUb29sRXJyb3IoKTtcbiAgICAgIH1cblxuICAgICAgLy8gUGVyZm9ybSB0aGUgbWVyZ2UgYW5kIHBhc3MtdGhyb3VnaCBwb3RlbnRpYWwgZmFpbHVyZXMuXG4gICAgICBhd2FpdCBzdHJhdGVneS5tZXJnZShwdWxsUmVxdWVzdCk7XG4gICAgICBMb2cuaW5mbyhncmVlbihgICDinJMgIFN1Y2Nlc3NmdWxseSBtZXJnZWQgdGhlIHB1bGwgcmVxdWVzdDogIyR7cHJOdW1iZXJ9YCkpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICAvLyBTd2l0Y2ggYmFjayB0byB0aGUgcHJldmlvdXMgYnJhbmNoLiBXZSBuZWVkIHRvIGRvIHRoaXMgYmVmb3JlIGRlbGV0aW5nIHRoZSB0ZW1wb3JhcnlcbiAgICAgIC8vIGJyYW5jaGVzIGJlY2F1c2Ugd2UgY2Fubm90IGRlbGV0ZSBicmFuY2hlcyB3aGljaCBhcmUgY3VycmVudGx5IGNoZWNrZWQgb3V0LlxuICAgICAgdGhpcy5naXQucnVuKFsnY2hlY2tvdXQnLCAnLWYnLCBwcmV2aW91c0JyYW5jaE9yUmV2aXNpb25dKTtcblxuICAgICAgYXdhaXQgc3RyYXRlZ3kuY2xlYW51cChwdWxsUmVxdWVzdCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE1vZGlmaWVzIHRoZSBwdWxsIHJlcXVlc3QgaW4gcGxhY2Ugd2l0aCBuZXcgdGFyZ2V0IGJyYW5jaGVzIGJhc2VkIG9uIHVzZXJcbiAgICogc2VsZWN0aW9uIGZyb20gdGhlIGF2YWlsYWJsZSBhY3RpdmUgYnJhbmNoZXMuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHVwZGF0ZVB1bGxSZXF1ZXN0VGFyZ2V0ZWRCcmFuY2hlc0Zyb21Qcm9tcHQoXG4gICAgcHVsbFJlcXVlc3Q6IFB1bGxSZXF1ZXN0LFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7bmFtZTogcmVwb05hbWUsIG93bmVyfSA9IHRoaXMuY29uZmlnLmdpdGh1YjtcblxuICAgIC8vIEF0dGVtcHQgdG8gcmV0cmlldmUgdGhlIGFjdGl2ZSBMVFMgYnJhbmNoZXMgdG8gYmUgaW5jbHVkZWQgaW4gdGhlIHNlbGVjdGlvbi5cbiAgICBsZXQgbHRzQnJhbmNoZXM6IHticmFuY2hOYW1lOiBzdHJpbmc7IHZlcnNpb246IHNlbXZlci5TZW1WZXJ9W10gPSBbXTtcbiAgICB0cnkge1xuICAgICAgYXNzZXJ0VmFsaWRSZWxlYXNlQ29uZmlnKHRoaXMuY29uZmlnKTtcbiAgICAgIGNvbnN0IGx0c0JyYW5jaGVzRnJvbU5wbSA9IGF3YWl0IGZldGNoTG9uZ1Rlcm1TdXBwb3J0QnJhbmNoZXNGcm9tTnBtKHRoaXMuY29uZmlnLnJlbGVhc2UpO1xuICAgICAgbHRzQnJhbmNoZXMgPSBsdHNCcmFuY2hlc0Zyb21OcG0uYWN0aXZlLm1hcCgoe25hbWUsIHZlcnNpb259KSA9PiAoe1xuICAgICAgICBicmFuY2hOYW1lOiBuYW1lLFxuICAgICAgICB2ZXJzaW9uLFxuICAgICAgfSkpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgTG9nLndhcm4oXG4gICAgICAgICdVbmFibGUgdG8gZGV0ZXJtaW5lIHRoZSBhY3RpdmUgTFRTIGJyYW5jaGVzIGFzIGEgcmVsZWFzZSBjb25maWcgaXMgbm90IHNldCBmb3IgdGhpcyByZXBvLicsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIEdhdGhlciB0aGUgY3VycmVudCBhY3RpdmUgcmVsZWFzZSB0cmFpbnMuXG4gICAgY29uc3Qge2xhdGVzdCwgbmV4dCwgcmVsZWFzZUNhbmRpZGF0ZX0gPSBhd2FpdCBBY3RpdmVSZWxlYXNlVHJhaW5zLmZldGNoKHtcbiAgICAgIG5hbWU6IHJlcG9OYW1lLFxuICAgICAgbmV4dEJyYW5jaE5hbWU6IGdldE5leHRCcmFuY2hOYW1lKHRoaXMuY29uZmlnLmdpdGh1YiksXG4gICAgICBvd25lcixcbiAgICAgIGFwaTogdGhpcy5naXQuZ2l0aHViLFxuICAgIH0pO1xuXG4gICAgLy8gQ29sbGF0ZSB0aGUga25vd24gYWN0aXZlIGJyYW5jaGVzIGludG8gYSBzaW5nbGUgbGlzdC5cbiAgICBjb25zdCBhY3RpdmVCcmFuY2hlczoge2JyYW5jaE5hbWU6IHN0cmluZzsgdmVyc2lvbjogc2VtdmVyLlNlbVZlcn1bXSA9IFtcbiAgICAgIG5leHQsXG4gICAgICBsYXRlc3QsXG4gICAgICAuLi5sdHNCcmFuY2hlcyxcbiAgICBdO1xuICAgIGlmIChyZWxlYXNlQ2FuZGlkYXRlICE9PSBudWxsKSB7XG4gICAgICAvLyBTaW5jZSB0aGUgbmV4dCB2ZXJzaW9uIHdpbGwgYWx3YXlzIGJlIHRoZSBwcmltYXJ5IGdpdGh1YiBicmFuY2ggcmF0aGVyIHRoYW4gc2VtdmVyLCB0aGUgUkNcbiAgICAgIC8vIGJyYW5jaCBzaG91bGQgYmUgaW5jbHVkZWQgYXMgdGhlIHNlY29uZCBpdGVtIGluIHRoZSBsaXN0LlxuICAgICAgYWN0aXZlQnJhbmNoZXMuc3BsaWNlKDEsIDAsIHJlbGVhc2VDYW5kaWRhdGUpO1xuICAgIH1cblxuICAgIGNvbnN0IHNlbGVjdGVkQnJhbmNoZXMgPSBhd2FpdCBQcm9tcHQuY2hlY2tib3goe1xuICAgICAgY2hvaWNlczogYWN0aXZlQnJhbmNoZXMubWFwKCh7YnJhbmNoTmFtZSwgdmVyc2lvbn0pID0+IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBjaGVja2VkOiBwdWxsUmVxdWVzdC50YXJnZXRCcmFuY2hlcy5pbmNsdWRlcyhicmFuY2hOYW1lKSxcbiAgICAgICAgICB2YWx1ZTogYnJhbmNoTmFtZSxcbiAgICAgICAgICBzaG9ydDogYnJhbmNoTmFtZSxcbiAgICAgICAgICBuYW1lOiBgJHticmFuY2hOYW1lfSAoJHt2ZXJzaW9ufSkke1xuICAgICAgICAgICAgYnJhbmNoTmFtZSA9PT0gcHVsbFJlcXVlc3QuZ2l0aHViVGFyZ2V0QnJhbmNoID8gJyBbVGFyZ2V0ZWQgdmlhIEdpdGh1YiBVSV0nIDogJydcbiAgICAgICAgICB9YCxcbiAgICAgICAgfTtcbiAgICAgIH0pLFxuICAgICAgbWVzc2FnZTogJ1NlbGVjdCBicmFuY2hlcyB0byBtZXJnZSBwdWxsIHJlcXVlc3QgaW50bzonLFxuICAgIH0pO1xuICAgIGNvbnN0IGNvbmZpcm1hdGlvbiA9IGF3YWl0IFByb21wdC5jb25maXJtKHtcbiAgICAgIGRlZmF1bHQ6IGZhbHNlLFxuICAgICAgbWVzc2FnZTpcbiAgICAgICAgcmVkKCchISEhISEgV0FSTklORyAhISEhISEhXFxuJykgK1xuICAgICAgICB5ZWxsb3coXG4gICAgICAgICAgJ1VzaW5nIG1hbnVhbCBicmFuY2ggc2VsZWN0aW9uIGRpc2FibGVzIHByb3RlY3RpdmUgY2hlY2tzIHByb3ZpZGVkIGJ5IHRoZSBtZXJnZSAnICtcbiAgICAgICAgICAgICd0b29saW5nLiBUaGlzIG1lYW5zIHRoYXQgdGhlIG1lcmdlIHRvb2xpbmcgd2lsbCBub3QgcHJldmVudCBjaGFuZ2VzIHdoaWNoIGFyZSBub3QgJyArXG4gICAgICAgICAgICAnYWxsb3dlZCBmb3IgdGhlIHRhcmdldGVkIGJyYW5jaGVzLiBQbGVhc2UgcHJvY2VlZCB3aXRoIGNhdXRpb24uXFxuJyxcbiAgICAgICAgKSArXG4gICAgICAgICdBcmUgeW91IHN1cmUgeW91IHdvdWxkIGxpa2UgdG8gcHJvY2VlZCB3aXRoIHRoZSBzZWxlY3RlZCBicmFuY2hlcz8nLFxuICAgIH0pO1xuXG4gICAgaWYgKGNvbmZpcm1hdGlvbiA9PT0gZmFsc2UpIHtcbiAgICAgIHRocm93IG5ldyBVc2VyQWJvcnRlZE1lcmdlVG9vbEVycm9yKCk7XG4gICAgfVxuXG4gICAgLy8gVGhlIEdpdGh1YiBUYXJnZXRlZCBicmFuY2ggbXVzdCBhbHdheXMgYmUgc2VsZWN0ZWQuIEl0IGlzIG5vdCBjdXJyZW50bHkgcG9zc2libGVcbiAgICAvLyB0byBtYWtlIGEgcmVhZG9ubHkgc2VsZWN0aW9uIGluIGlucXVpcmVyJ3MgY2hlY2tib3guXG4gICAgaWYgKCFzZWxlY3RlZEJyYW5jaGVzLmluY2x1ZGVzKHB1bGxSZXF1ZXN0LmdpdGh1YlRhcmdldEJyYW5jaCkpIHtcbiAgICAgIHRocm93IG5ldyBGYXRhbE1lcmdlVG9vbEVycm9yKFxuICAgICAgICBgUHVsbCBSZXF1ZXN0cyBtdXN0IG1lcmdlIGludG8gdGhlaXIgdGFyZ2V0ZWQgR2l0aHViIGJyYW5jaC4gSWYgdGhpcyBicmFuY2ggKCR7cHVsbFJlcXVlc3QuZ2l0aHViVGFyZ2V0QnJhbmNofSkgYCArXG4gICAgICAgICAgJ3Nob3VsZCBub3QgYmUgaW5jbHVkZWQsIHBsZWFzZSBjaGFuZ2UgdGhlIHRhcmdldGVkIGJyYW5jaCB2aWEgdGhlIEdpdGh1YiBVSS4nLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBwdWxsUmVxdWVzdC50YXJnZXRCcmFuY2hlcyA9IHNlbGVjdGVkQnJhbmNoZXM7XG4gIH1cblxuICBhc3luYyBjb25maXJtTWVyZ2VBY2Nlc3MoKSB7XG4gICAgaWYgKHRoaXMuZ2l0LnVzZXJUeXBlID09PSAndXNlcicpIHtcbiAgICAgIC8vIENoZWNrIHdoZXRoZXIgdGhlIGdpdmVuIEdpdGh1YiB0b2tlbiBoYXMgc3VmZmljaWVudCBwZXJtaXNzaW9ucyBmb3Igd3JpdGluZ1xuICAgICAgLy8gdG8gdGhlIGNvbmZpZ3VyZWQgcmVwb3NpdG9yeS4gSWYgdGhlIHJlcG9zaXRvcnkgaXMgbm90IHByaXZhdGUsIG9ubHkgdGhlXG4gICAgICAvLyByZWR1Y2VkIGBwdWJsaWNfcmVwb2AgT0F1dGggc2NvcGUgaXMgc3VmZmljaWVudCBmb3IgcGVyZm9ybWluZyBtZXJnZXMuXG4gICAgICBjb25zdCBoYXNPYXV0aFNjb3BlcyA9IGF3YWl0IHRoaXMuZ2l0Lmhhc09hdXRoU2NvcGVzKChzY29wZXMsIG1pc3NpbmcpID0+IHtcbiAgICAgICAgaWYgKCFzY29wZXMuaW5jbHVkZXMoJ3JlcG8nKSkge1xuICAgICAgICAgIGlmICh0aGlzLmNvbmZpZy5naXRodWIucHJpdmF0ZSkge1xuICAgICAgICAgICAgbWlzc2luZy5wdXNoKCdyZXBvJyk7XG4gICAgICAgICAgfSBlbHNlIGlmICghc2NvcGVzLmluY2x1ZGVzKCdwdWJsaWNfcmVwbycpKSB7XG4gICAgICAgICAgICBtaXNzaW5nLnB1c2goJ3B1YmxpY19yZXBvJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUHVsbCByZXF1ZXN0cyBjYW4gbW9kaWZ5IEdpdGh1YiBhY3Rpb24gd29ya2Zsb3cgZmlsZXMuIEluIHN1Y2ggY2FzZXMgR2l0aHViIHJlcXVpcmVzIHVzIHRvXG4gICAgICAgIC8vIHB1c2ggd2l0aCBhIHRva2VuIHRoYXQgaGFzIHRoZSBgd29ya2Zsb3dgIG9hdXRoIHNjb3BlIHNldC4gVG8gYXZvaWQgZXJyb3JzIHdoZW4gdGhlXG4gICAgICAgIC8vIGNhcmV0YWtlciBpbnRlbmRzIHRvIG1lcmdlIHN1Y2ggUFJzLCB3ZSBlbnN1cmUgdGhlIHNjb3BlIGlzIGFsd2F5cyBzZXQgb24gdGhlIHRva2VuIGJlZm9yZVxuICAgICAgICAvLyB0aGUgbWVyZ2UgcHJvY2VzcyBzdGFydHMuXG4gICAgICAgIC8vIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL2VuL2RldmVsb3BlcnMvYXBwcy9zY29wZXMtZm9yLW9hdXRoLWFwcHMjYXZhaWxhYmxlLXNjb3Blc1xuICAgICAgICBpZiAoIXNjb3Blcy5pbmNsdWRlcygnd29ya2Zsb3cnKSkge1xuICAgICAgICAgIG1pc3NpbmcucHVzaCgnd29ya2Zsb3cnKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGlmIChoYXNPYXV0aFNjb3BlcyAhPT0gdHJ1ZSkge1xuICAgICAgICB0aHJvdyBuZXcgRmF0YWxNZXJnZVRvb2xFcnJvcihoYXNPYXV0aFNjb3Blcy5lcnJvcik7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRPRE8oam9zZXBocGVycm90dCk6IEZpbmQgYSB3YXkgdG8gY2hlY2sgYWNjZXNzIG9mIHRoZSBpbnN0YWxsYXRpb24gd2l0aG91dCB1c2luZyBhIEpXVC5cbiAgICAgIExvZy5kZWJ1ZygnQXNzdW1pbmcgY29ycmVjdCBhY2Nlc3MgYmVjYXVzZSB0aGlzIGEgYm90IGFjY291bnQuJyk7XG4gICAgfVxuICB9XG59XG4iXX0=