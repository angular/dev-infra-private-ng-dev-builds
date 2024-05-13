/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { FatalMergeToolError, MergeConflictsFatalError, MismatchedTargetBranchFatalError, UnsatisfiedBaseShaFatalError, } from '../failures.js';
/**
 * Name of a temporary branch that contains the head of a currently-processed PR. Note
 * that a branch name should be used that most likely does not conflict with other local
 * development branches.
 */
export const TEMP_PR_HEAD_BRANCH = 'merge_pr_head';
/**
 * Base class for merge strategies. A merge strategy accepts a pull request and
 * merges it into the determined target branches.
 */
export class MergeStrategy {
    constructor(git) {
        this.git = git;
    }
    /**
     * Prepares a merge of the given pull request. The strategy by default will
     * fetch all target branches and the pull request into local temporary branches.
     */
    async prepare(pullRequest) {
        this.fetchTargetBranches(pullRequest.targetBranches, `pull/${pullRequest.prNumber}/head:${TEMP_PR_HEAD_BRANCH}`);
    }
    /**
     * Checks to confirm that a pull request in its current state is able to merge as expected to
     * the targeted branches. This method notably does not commit any attempted cherry-picks during
     * its check, but instead leaves this to the merging action.
     *
     * @throws {GitCommandError} An unknown Git command error occurred that is not
     *   specific to the pull request merge.
     * @throws {UnsatisfiedBaseShaFatalError} A fatal error if a specific is required to be present
     *   in the pull requests branch and is not present in that branch.
     * @throws {MismatchedTargetBranchFatalError} A fatal error if the pull request does not target
     *   a branch via the Github UI that is managed by merge tooling.
     */
    async check(pullRequest) {
        const { githubTargetBranch, targetBranches, requiredBaseSha } = pullRequest;
        // If the pull request does not have its base branch set to any determined target
        // branch, we cannot merge using the API.
        if (targetBranches.every((t) => t !== githubTargetBranch)) {
            throw new MismatchedTargetBranchFatalError(targetBranches);
        }
        // In cases where a required base commit is specified for this pull request, check if
        // the pull request contains the given commit. If not, return a pull request failure.
        // This check is useful for enforcing that PRs are rebased on top of a given commit.
        // e.g. a commit that changes the code ownership validation. PRs which are not rebased
        // could bypass new codeowner ship rules.
        if (requiredBaseSha && !this.git.hasCommit(TEMP_PR_HEAD_BRANCH, requiredBaseSha)) {
            throw new UnsatisfiedBaseShaFatalError();
        }
        // First cherry-pick the PR into all local target branches in dry-run mode. This is
        // purely for testing so that we can figure out whether the PR can be cherry-picked
        // into the other target branches. We don't want to merge the PR through the API, and
        // then run into cherry-pick conflicts after the initial merge already completed.
        await this._assertMergeableOrThrow(pullRequest, targetBranches);
    }
    /** Cleans up the pull request merge. e.g. deleting temporary local branches. */
    async cleanup(pullRequest) {
        // Delete all temporary target branches.
        pullRequest.targetBranches.forEach((branchName) => this.git.run(['branch', '-D', this.getLocalTargetBranchName(branchName)]));
        // Delete temporary branch for the pull request head.
        this.git.run(['branch', '-D', TEMP_PR_HEAD_BRANCH]);
    }
    /** Gets a deterministic local branch name for a given branch. */
    getLocalTargetBranchName(targetBranch) {
        return `merge_pr_target_${targetBranch.replace(/\//g, '_')}`;
    }
    /**
     * Cherry-picks the given revision range into the specified target branches.
     * @returns A list of branches for which the revisions could not be cherry-picked into.
     */
    cherryPickIntoTargetBranches(revisionRange, targetBranches, options = {}) {
        const cherryPickArgs = [revisionRange];
        const failedBranches = [];
        const revisionCountOutput = this.git.run(['rev-list', '--count', revisionRange]);
        const revisionCount = Number(revisionCountOutput.stdout.trim());
        if (isNaN(revisionCount)) {
            throw new FatalMergeToolError('Unexpected revision range for cherry-picking. No commit count could be determined.');
        }
        if (options.linkToOriginalCommits) {
            // We add `-x` when cherry-picking as that will allow us to easily jump to original
            // commits for cherry-picked commits. With that flag set, Git will automatically append
            // the original SHA/revision to the commit message. e.g. `(cherry picked from commit <..>)`.
            // https://git-scm.com/docs/git-cherry-pick#Documentation/git-cherry-pick.txt--x.
            cherryPickArgs.push('-x');
        }
        // Cherry-pick the refspec into all determined target branches.
        for (const branchName of targetBranches) {
            const localTargetBranch = this.getLocalTargetBranchName(branchName);
            // Checkout the local target branch.
            this.git.run(['checkout', localTargetBranch]);
            // Cherry-pick the refspec into the target branch.
            const cherryPickResult = this.git.runGraceful(['cherry-pick', ...cherryPickArgs]);
            if (cherryPickResult.status !== 0) {
                // Abort the failed cherry-pick. We do this because Git persists the failed
                // cherry-pick state globally in the repository. This could prevent future
                // pull request merges as a Git thinks a cherry-pick is still in progress.
                this.git.runGraceful(['cherry-pick', '--abort']);
                failedBranches.push(branchName);
            }
            // If we run with dry run mode, we reset the local target branch so that all dry-run
            // cherry-pick changes are discard. Changes are applied to the working tree and index.
            if (options.dryRun) {
                this.git.run(['reset', '--hard', `HEAD~${revisionCount}`]);
            }
        }
        return failedBranches;
    }
    /**
     * Fetches the given target branches. Also accepts a list of additional refspecs that
     * should be fetched. This is helpful as multiple slow fetches could be avoided.
     */
    fetchTargetBranches(names, ...extraRefspecs) {
        const fetchRefspecs = names.map((targetBranch) => {
            const localTargetBranch = this.getLocalTargetBranchName(targetBranch);
            return `refs/heads/${targetBranch}:${localTargetBranch}`;
        });
        // Fetch all target branches with a single command. We don't want to fetch them
        // individually as that could cause an unnecessary slow-down.
        this.git.run([
            'fetch',
            '-q',
            '-f',
            this.git.getRepoGitUrl(),
            ...fetchRefspecs,
            ...extraRefspecs,
        ]);
    }
    /** Pushes the given target branches upstream. */
    pushTargetBranchesUpstream(names) {
        const pushRefspecs = names.map((targetBranch) => {
            const localTargetBranch = this.getLocalTargetBranchName(targetBranch);
            return `${localTargetBranch}:refs/heads/${targetBranch}`;
        });
        // Push all target branches with a single command if we don't run in dry-run mode.
        // We don't want to push them individually as that could cause an unnecessary slow-down.
        this.git.run(['push', '--atomic', this.git.getRepoGitUrl(), ...pushRefspecs]);
    }
    /** Asserts that given pull request could be merged into the given target branches. */
    async _assertMergeableOrThrow({ revisionRange }, targetBranches) {
        const failedBranches = this.cherryPickIntoTargetBranches(revisionRange, targetBranches, {
            dryRun: true,
        });
        if (failedBranches.length) {
            throw new MergeConflictsFatalError(failedBranches);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RyYXRlZ3kuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvbWVyZ2Uvc3RyYXRlZ2llcy9zdHJhdGVneS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFHSCxPQUFPLEVBQ0wsbUJBQW1CLEVBQ25CLHdCQUF3QixFQUN4QixnQ0FBZ0MsRUFDaEMsNEJBQTRCLEdBQzdCLE1BQU0sZ0JBQWdCLENBQUM7QUFHeEI7Ozs7R0FJRztBQUNILE1BQU0sQ0FBQyxNQUFNLG1CQUFtQixHQUFHLGVBQWUsQ0FBQztBQUVuRDs7O0dBR0c7QUFDSCxNQUFNLE9BQWdCLGFBQWE7SUFDakMsWUFBc0IsR0FBMkI7UUFBM0IsUUFBRyxHQUFILEdBQUcsQ0FBd0I7SUFBRyxDQUFDO0lBRXJEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBd0I7UUFDcEMsSUFBSSxDQUFDLG1CQUFtQixDQUN0QixXQUFXLENBQUMsY0FBYyxFQUMxQixRQUFRLFdBQVcsQ0FBQyxRQUFRLFNBQVMsbUJBQW1CLEVBQUUsQ0FDM0QsQ0FBQztJQUNKLENBQUM7SUFXRDs7Ozs7Ozs7Ozs7T0FXRztJQUNILEtBQUssQ0FBQyxLQUFLLENBQUMsV0FBd0I7UUFDbEMsTUFBTSxFQUFDLGtCQUFrQixFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUMsR0FBRyxXQUFXLENBQUM7UUFDMUUsaUZBQWlGO1FBQ2pGLHlDQUF5QztRQUN6QyxJQUFJLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBSyxrQkFBa0IsQ0FBQyxFQUFFLENBQUM7WUFDMUQsTUFBTSxJQUFJLGdDQUFnQyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzdELENBQUM7UUFFRCxxRkFBcUY7UUFDckYscUZBQXFGO1FBQ3JGLG9GQUFvRjtRQUNwRixzRkFBc0Y7UUFDdEYseUNBQXlDO1FBQ3pDLElBQUks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QUFDLGFBQWEsRUFBRSxFQUFFLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQztJQUNoRixDQUFDO0lBRUQsc0ZBQXNGO0lBQzVFLEtBQUssQ0FBQyx1QkFBdUIsQ0FDckMsRUFBQyxhQUFhLEVBQWMsRUFDNUIsY0FBd0I7UUFFeEIsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLDRCQUE0QixDQUFDLGFBQWEsRUFBRSxjQUFjLEVBQUU7WUFDdEYsTUFBTSxFQUFFLElBQUk7U0FDYixDQUFDLENBQUM7UUFFSCxJQUFJLGNBQWMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUMxQixNQUFNLElBQUksd0JBQXdCLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDckQsQ0FBQztJQUNILENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0F1dGhlbnRpY2F0ZWRHaXRDbGllbnR9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQuanMnO1xuaW1wb3J0IHtcbiAgRmF0YWxNZXJnZVRvb2xFcnJvcixcbiAgTWVyZ2VDb25mbGljdHNGYXRhbEVycm9yLFxuICBNaXNtYXRjaGVkVGFyZ2V0QnJhbmNoRmF0YWxFcnJvcixcbiAgVW5zYXRpc2ZpZWRCYXNlU2hhRmF0YWxFcnJvcixcbn0gZnJvbSAnLi4vZmFpbHVyZXMuanMnO1xuaW1wb3J0IHtQdWxsUmVxdWVzdH0gZnJvbSAnLi4vcHVsbC1yZXF1ZXN0LmpzJztcblxuLyoqXG4gKiBOYW1lIG9mIGEgdGVtcG9yYXJ5IGJyYW5jaCB0aGF0IGNvbnRhaW5zIHRoZSBoZWFkIG9mIGEgY3VycmVudGx5LXByb2Nlc3NlZCBQUi4gTm90ZVxuICogdGhhdCBhIGJyYW5jaCBuYW1lIHNob3VsZCBiZSB1c2VkIHRoYXQgbW9zdCBsaWtlbHkgZG9lcyBub3QgY29uZmxpY3Qgd2l0aCBvdGhlciBsb2NhbFxuICogZGV2ZWxvcG1lbnQgYnJhbmNoZXMuXG4gKi9cbmV4cG9ydCBjb25zdCBURU1QX1BSX0hFQURfQlJBTkNIID0gJ21lcmdlX3ByX2hlYWQnO1xuXG4vKipcbiAqIEJhc2UgY2xhc3MgZm9yIG1lcmdlIHN0cmF0ZWdpZXMuIEEgbWVyZ2Ugc3RyYXRlZ3kgYWNjZXB0cyBhIHB1bGwgcmVxdWVzdCBhbmRcbiAqIG1lcmdlcyBpdCBpbnRvIHRoZSBkZXRlcm1pbmVkIHRhcmdldCBicmFuY2hlcy5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIE1lcmdlU3RyYXRlZ3kge1xuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgZ2l0OiBBdXRoZW50aWNhdGVkR2l0Q2xpZW50KSB7fVxuXG4gIC8qKlxuICAgKiBQcmVwYXJlcyBhIG1lcmdlIG9mIHRoZSBnaXZlbiBwdWxsIHJlcXVlc3QuIFRoZSBzdHJhdGVneSBieSBkZWZhdWx0IHdpbGxcbiAgICogZmV0Y2ggYWxsIHRhcmdldCBicmFuY2hlcyBhbmQgdGhlIHB1bGwgcmVxdWVzdCBpbnRvIGxvY2FsIHRlbXBvcmFyeSBicmFuY2hlcy5cbiAgICovXG4gIGFzeW5jIHByZXBhcmUocHVsbFJlcXVlc3Q6IFB1bGxSZXF1ZXN0KSB7XG4gICAgdGhpcy5mZXRjaFRhcmdldEJyYW5jaGVzKFxuICAgICAgcHVsbFJlcXVlc3QudGFyZ2V0QnJhbmNoZXMsXG4gICAgICBgcHVsbC8ke3B1bGxSZXF1ZXN0LnByTnVtYmVyfS9oZWFkOiR7VEVNUF9QUl9IRUFEX0JSQU5DSH1gLFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogUGVyZm9ybXMgdGhlIG1lcmdlIG9mIHRoZSBnaXZlbiBwdWxsIHJlcXVlc3QuIFRoaXMgbmVlZHMgdG8gYmUgaW1wbGVtZW50ZWRcbiAgICogYnkgaW5kaXZpZHVhbCBtZXJnZSBzdHJhdGVnaWVzLlxuICAgKlxuICAgKiBAdGhyb3dzIHtGYXRhbE1lcmdlVG9vbEVycm9yfSBBIGZhdGFsIGVycm9yIGhhcyBvY2N1cnJlZCB3aGVuIGF0dGVtcHRpbmcgdG8gbWVyZ2UgdGhlXG4gICAqICAgcHVsbCByZXF1ZXN0LlxuICAgKi9cbiAgYWJzdHJhY3QgbWVyZ2UocHVsbFJlcXVlc3Q6IFB1bGxSZXF1ZXN0KTogUHJvbWlzZTx2b2lkPjtcblxuICAvKipcbiAgICogQ2hlY2tzIHRvIGNvbmZpcm0gdGhhdCBhIHB1bGwgcmVxdWVzdCBpbiBpdHMgY3VycmVudCBzdGF0ZSBpcyBhYmxlIHRvIG1lcmdlIGFzIGV4cGVjdGVkIHRvXG4gICAqIHRoZSB0YXJnZXRlZCBicmFuY2hlcy4gVGhpcyBtZXRob2Qgbm90YWJseSBkb2VzIG5vdCBjb21taXQgYW55IGF0dGVtcHRlZCBjaGVycnktcGlja3MgZHVyaW5nXG4gICAqIGl0cyBjaGVjaywgYnV0IGluc3RlYWQgbGVhdmVzIHRoaXMgdG8gdGhlIG1lcmdpbmcgYWN0aW9uLlxuICAgKlxuICAgKiBAdGhyb3dzIHtHaXRDb21tYW5kRXJyb3J9IEFuIHVua25vd24gR2l0IGNvbW1hbmQgZXJyb3Igb2NjdXJyZWQgdGhhdCBpcyBub3RcbiAgICogICBzcGVjaWZpYyB0byB0aGUgcHVsbCByZXF1ZXN0IG1lcmdlLlxuICAgKiBAdGhyb3dzIHtVbnNhdGlzZmllZEJhc2VTaGFGYXRhbEVycm9yfSBBIGZhdGFsIGVycm9yIGlmIGEgc3BlY2lmaWMgaXMgcmVxdWlyZWQgdG8gYmUgcHJlc2VudFxuICAgKiAgIGluIHRoZSBwdWxsIHJlcXVlc3RzIGJyYW5jaCBhbmQgaXMgbm90IHByZXNlbnQgaW4gdGhhdCBicmFuY2guXG4gICAqIEB0aHJvd3Mge01pc21hdGNoZWRUYXJnZXRCcmFuY2hGYXRhbEVycm9yfSBBIGZhdGFsIGVycm9yIGlmIHRoZSBwdWxsIHJlcXVlc3QgZG9lcyBub3QgdGFyZ2V0XG4gICAqICAgYSBicmFuY2ggdmlhIHRoZSBHaXRodWIgVUkgdGhhdCBpcyBtYW5hZ2VkIGJ5IG1lcmdlIHRvb2xpbmcuXG4gICAqL1xuICBhc3luYyBjaGVjayhwdWxsUmVxdWVzdDogUHVsbFJlcXVlc3QpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7Z2l0aHViVGFyZ2V0QnJhbmNoLCB0YXJnZXRCcmFuY2hlcywgcmVxdWlyZWRCYXNlU2hhfSA9IHB1bGxSZXF1ZXN0O1xuICAgIC8vIElmIHRoZSBwdWxsIHJlcXVlc3QgZG9lcyBub3QgaGF2ZSBpdHMgYmFzZSBicmFuY2ggc2V0IHRvIGFueSBkZXRlcm1pbmVkIHRhcmdldFxuICAgIC8vIGJyYW5jaCwgd2UgY2Fubm90IG1lcmdlIHVzaW5nIHRoZSBBUEkuXG4gICAgaWYgKHRhcmdldEJyYW5jaGVzLmV2ZXJ5KCh0KSA9PiB0ICE9PSBnaXRodWJUYXJnZXRCcmFuY2gpKSB7XG4gICAgICB0aHJvdyBuZXcgTWlzbWF0Y2hlZFRhcmdldEJyYW5jaEZhdGFsRXJyb3IodGFyZ2V0QnJhbmNoZXMpO1xuICAgIH1cblxuICAgIC8vIEluIGNhc2VzIHdoZXJlIGEgcmVxdWlyZWQgYmFzZSBjb21taXQgaXMgc3BlY2lmaWVkIGZvciB0aGlzIHB1bGwgcmVxdWVzdCwgY2hlY2sgaWZcbiAgICAvLyB0aGUgcHVsbCByZXF1ZXN0IGNvbnRhaW5zIHRoZSBnaXZlbiBjb21taXQuIElmIG5vdCwgcmV0dXJuIGEgcHVsbCByZXF1ZXN0IGZhaWx1cmUuXG4gICAgLy8gVGhpcyBjaGVjayBpcyB1c2VmdWwgZm9yIGVuZm9yY2luZyB0aGF0IFBScyBhcmUgcmViYXNlZCBvbiB0b3Agb2YgYSBnaXZlbiBjb21taXQuXG4gICAgLy8gZS5nLiBhIGNvbW1pdCB0aGF0IGNoYW5nZXMgdGhlIGNvZGUgb3duZXJzaGlwIHZhbGlkYXRpb24uIFBScyB3aGljaCBhcmUgbm90IHJlYmFzZWRcbiAgICAvLyBjb3VsZCBieXBhc3MgbmV3IGNvZGVvd25lciBzaGlwIHJ1bGVzLlxuICAgIGlmIChyZXF1aXJlZEJhc2VTaGEgJiYgIXRoaXMuZ2l0Lmhhc0NvbW1pdChURU1QX1BSX0hFQURfQlJBTkNILCByZXF1aXJlZEJhc2VTaGEpKSB7XG4gICAgICB0aHJvdyBuZXcgVW5zYXRpc2ZpZWRCYXNlU2hhRmF0YWxFcnJvcigpO1xuICAgIH1cblxuICAgIC8vIEZpcnN0IGNoZXJyeS1waWNrIHRoZSBQUiBpbnRvIGFsbCBsb2NhbCB0YXJnZXQgYnJhbmNoZXMgaW4gZHJ5LXJ1biBtb2RlLiBUaGlzIGlzXG4gICAgLy8gcHVyZWx5IGZvciB0ZXN0aW5nIHNvIHRoYXQgd2UgY2FuIGZpZ3VyZSBvdXQgd2hldGhlciB0aGUgUFIgY2FuIGJlIGNoZXJyeS1waWNrZWRcbiAgICAvLyBpbnRvIHRoZSBvdGhlciB0YXJnZXQgYnJhbmNoZXMuIFdlIGRvbid0IHdhbnQgdG8gbWVyZ2UgdGhlIFBSIHRocm91Z2ggdGhlIEFQSSwgYW5kXG4gICAgLy8gdGhlbiBydW4gaW50byBjaGVycnktcGljayBjb25mbGljdHMgYWZ0ZXIgdGhlIGluaXRpYWwgbWVyZ2UgYWxyZWFkeSBjb21wbGV0ZWQuXG4gICAgYXdhaXQgdGhpcy5fYXNzZXJ0TWVyZ2VhYmxlT3JUaHJvdyhwdWxsUmVxdWVzdCwgdGFyZ2V0QnJhbmNoZXMpO1xuICB9XG5cbiAgLyoqIENsZWFucyB1cCB0aGUgcHVsbCByZXF1ZXN0IG1lcmdlLiBlLmcuIGRlbGV0aW5nIHRlbXBvcmFyeSBsb2NhbCBicmFuY2hlcy4gKi9cbiAgYXN5bmMgY2xlYW51cChwdWxsUmVxdWVzdDogUHVsbFJlcXVlc3QpIHtcbiAgICAvLyBEZWxldGUgYWxsIHRlbXBvcmFyeSB0YXJnZXQgYnJhbmNoZXMuXG4gICAgcHVsbFJlcXVlc3QudGFyZ2V0QnJhbmNoZXMuZm9yRWFjaCgoYnJhbmNoTmFtZSkgPT5cbiAgICAgIHRoaXMuZ2l0LnJ1bihbJ2JyYW5jaCcsICctRCcsIHRoaXMuZ2V0TG9jYWxUYXJnZXRCcmFuY2hOYW1lKGJyYW5jaE5hbWUpXSksXG4gICAgKTtcblxuICAgIC8vIERlbGV0ZSB0ZW1wb3JhcnkgYnJhbmNoIGZvciB0aGUgcHVsbCByZXF1ZXN0IGhlYWQuXG4gICAgdGhpcy5naXQucnVuKFsnYnJhbmNoJywgJy1EJywgVEVNUF9QUl9IRUFEX0JSQU5DSF0pO1xuICB9XG5cbiAgLyoqIEdldHMgYSBkZXRlcm1pbmlzdGljIGxvY2FsIGJyYW5jaCBuYW1lIGZvciBhIGdpdmVuIGJyYW5jaC4gKi9cbiAgcHJvdGVjdGVkIGdldExvY2FsVGFyZ2V0QnJhbmNoTmFtZSh0YXJnZXRCcmFuY2g6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGBtZXJnZV9wcl90YXJnZXRfJHt0YXJnZXRCcmFuY2gucmVwbGFjZSgvXFwvL2csICdfJyl9YDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVycnktcGlja3MgdGhlIGdpdmVuIHJldmlzaW9uIHJhbmdlIGludG8gdGhlIHNwZWNpZmllZCB0YXJnZXQgYnJhbmNoZXMuXG4gICAqIEByZXR1cm5zIEEgbGlzdCBvZiBicmFuY2hlcyBmb3Igd2hpY2ggdGhlIHJldmlzaW9ucyBjb3VsZCBub3QgYmUgY2hlcnJ5LXBpY2tlZCBpbnRvLlxuICAgKi9cbiAgcHJvdGVjdGVkIGNoZXJyeVBpY2tJbnRvVGFyZ2V0QnJhbmNoZXMoXG4gICAgcmV2aXNpb25SYW5nZTogc3RyaW5nLFxuICAgIHRhcmdldEJyYW5jaGVzOiBzdHJpbmdbXSxcbiAgICBvcHRpb25zOiB7XG4gICAgICBkcnlSdW4/OiBib29sZWFuO1xuICAgICAgbGlua1RvT3JpZ2luYWxDb21taXRzPzogYm9vbGVhbjtcbiAgICB9ID0ge30sXG4gICkge1xuICAgIGNvbnN0IGNoZXJyeVBpY2tBcmdzID0gW3JldmlzaW9uUmFuZ2VdO1xuICAgIGNvbnN0IGZhaWxlZEJyYW5jaGVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgY29uc3QgcmV2aXNpb25Db3VudE91dHB1dCA9IHRoaXMuZ2l0LnJ1bihbJ3Jldi1saXN0JywgJy0tY291bnQnLCByZXZpc2lvblJhbmdlXSk7XG4gICAgY29uc3QgcmV2aXNpb25Db3VudCA9IE51bWJlcihyZXZpc2lvbkNvdW50T3V0cHV0LnN0ZG91dC50cmltKCkpO1xuICAgIGlmIChpc05hTihyZXZpc2lvbkNvdW50KSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsTWVyZ2VUb29sRXJyb3IoXG4gICAgICAgICdVbmV4cGVjdGVkIHJldmlzaW9uIHJhbmdlIGZvciBjaGVycnktcGlja2luZy4gTm8gY29tbWl0IGNvdW50IGNvdWxkIGJlIGRldGVybWluZWQuJyxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMubGlua1RvT3JpZ2luYWxDb21taXRzKSB7XG4gICAgICAvLyBXZSBhZGQgYC14YCB3aGVuIGNoZXJyeS1waWNraW5nIGFzIHRoYXQgd2lsbCBhbGxvdyB1cyB0byBlYXNpbHkganVtcCB0byBvcmlnaW5hbFxuICAgICAgLy8gY29tbWl0cyBmb3IgY2hlcnJ5LXBpY2tlZCBjb21taXRzLiBXaXRoIHRoYXQgZmxhZyBzZXQsIEdpdCB3aWxsIGF1dG9tYXRpY2FsbHkgYXBwZW5kXG4gICAgICAvLyB0aGUgb3JpZ2luYWwgU0hBL3JldmlzaW9uIHRvIHRoZSBjb21taXQgbWVzc2FnZS4gZS5nLiBgKGNoZXJyeSBwaWNrZWQgZnJvbSBjb21taXQgPC4uPilgLlxuICAgICAgLy8gaHR0cHM6Ly9naXQtc2NtLmNvbS9kb2NzL2dpdC1jaGVycnktcGljayNEb2N1bWVudGF0aW9uL2dpdC1jaGVycnktcGljay50eHQtLXguXG4gICAgICBjaGVycnlQaWNrQXJncy5wdXNoKCcteCcpO1xuICAgIH1cblxuICAgIC8vIENoZXJyeS1waWNrIHRoZSByZWZzcGVjIGludG8gYWxsIGRldGVybWluZWQgdGFyZ2V0IGJyYW5jaGVzLlxuICAgIGZvciAoY29uc3QgYnJhbmNoTmFtZSBvZiB0YXJnZXRCcmFuY2hlcykge1xuICAgICAgY29uc3QgbG9jYWxUYXJnZXRCcmFuY2ggPSB0aGlzLmdldExvY2FsVGFyZ2V0QnJhbmNoTmFtZShicmFuY2hOYW1lKTtcbiAgICAgIC8vIENoZWNrb3V0IHRoZSBsb2NhbCB0YXJnZXQgYnJhbmNoLlxuICAgICAgdGhpcy5naXQucnVuKFsnY2hlY2tvdXQnLCBsb2NhbFRhcmdldEJyYW5jaF0pO1xuICAgICAgLy8gQ2hlcnJ5LXBpY2sgdGhlIHJlZnNwZWMgaW50byB0aGUgdGFyZ2V0IGJyYW5jaC5cbiAgICAgIGNvbnN0IGNoZXJyeVBpY2tSZXN1bHQgPSB0aGlzLmdpdC5ydW5HcmFjZWZ1bChbJ2NoZXJyeS1waWNrJywgLi4uY2hlcnJ5UGlja0FyZ3NdKTtcbiAgICAgIGlmIChjaGVycnlQaWNrUmVzdWx0LnN0YXR1cyAhPT0gMCkge1xuICAgICAgICAvLyBBYm9ydCB0aGUgZmFpbGVkIGNoZXJyeS1waWNrLiBXZSBkbyB0aGlzIGJlY2F1c2UgR2l0IHBlcnNpc3RzIHRoZSBmYWlsZWRcbiAgICAgICAgLy8gY2hlcnJ5LXBpY2sgc3RhdGUgZ2xvYmFsbHkgaW4gdGhlIHJlcG9zaXRvcnkuIFRoaXMgY291bGQgcHJldmVudCBmdXR1cmVcbiAgICAgICAgLy8gcHVsbCByZXF1ZXN0IG1lcmdlcyBhcyBhIEdpdCB0aGlua3MgYSBjaGVycnktcGljayBpcyBzdGlsbCBpbiBwcm9ncmVzcy5cbiAgICAgICAgdGhpcy5naXQucnVuR3JhY2VmdWwoWydjaGVycnktcGljaycsICctLWFib3J0J10pO1xuICAgICAgICBmYWlsZWRCcmFuY2hlcy5wdXNoKGJyYW5jaE5hbWUpO1xuICAgICAgfVxuICAgICAgLy8gSWYgd2UgcnVuIHdpdGggZHJ5IHJ1biBtb2RlLCB3ZSByZXNldCB0aGUgbG9jYWwgdGFyZ2V0IGJyYW5jaCBzbyB0aGF0IGFsbCBkcnktcnVuXG4gICAgICAvLyBjaGVycnktcGljayBjaGFuZ2VzIGFyZSBkaXNjYXJkLiBDaGFuZ2VzIGFyZSBhcHBsaWVkIHRvIHRoZSB3b3JraW5nIHRyZWUgYW5kIGluZGV4LlxuICAgICAgaWYgKG9wdGlvbnMuZHJ5UnVuKSB7XG4gICAgICAgIHRoaXMuZ2l0LnJ1bihbJ3Jlc2V0JywgJy0taGFyZCcsIGBIRUFEfiR7cmV2aXNpb25Db3VudH1gXSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWlsZWRCcmFuY2hlcztcbiAgfVxuXG4gIC8qKlxuICAgKiBGZXRjaGVzIHRoZSBnaXZlbiB0YXJnZXQgYnJhbmNoZXMuIEFsc28gYWNjZXB0cyBhIGxpc3Qgb2YgYWRkaXRpb25hbCByZWZzcGVjcyB0aGF0XG4gICAqIHNob3VsZCBiZSBmZXRjaGVkLiBUaGlzIGlzIGhlbHBmdWwgYXMgbXVsdGlwbGUgc2xvdyBmZXRjaGVzIGNvdWxkIGJlIGF2b2lkZWQuXG4gICAqL1xuICBwcm90ZWN0ZWQgZmV0Y2hUYXJnZXRCcmFuY2hlcyhuYW1lczogc3RyaW5nW10sIC4uLmV4dHJhUmVmc3BlY3M6IHN0cmluZ1tdKSB7XG4gICAgY29uc3QgZmV0Y2hSZWZzcGVjcyA9IG5hbWVzLm1hcCgodGFyZ2V0QnJhbmNoKSA9PiB7XG4gICAgICBjb25zdCBsb2NhbFRhcmdldEJyYW5jaCA9IHRoaXMuZ2V0TG9jYWxUYXJnZXRCcmFuY2hOYW1lKHRhcmdldEJyYW5jaCk7XG4gICAgICByZXR1cm4gYHJlZnMvaGVhZHMvJHt0YXJnZXRCcmFuY2h9OiR7bG9jYWxUYXJnZXRCcmFuY2h9YDtcbiAgICB9KTtcbiAgICAvLyBGZXRjaCBhbGwgdGFyZ2V0IGJyYW5jaGVzIHdpdGggYSBzaW5nbGUgY29tbWFuZC4gV2UgZG9uJ3Qgd2FudCB0byBmZXRjaCB0aGVtXG4gICAgLy8gaW5kaXZpZHVhbGx5IGFzIHRoYXQgY291bGQgY2F1c2UgYW4gdW5uZWNlc3Nhcnkgc2xvdy1kb3duLlxuICAgIHRoaXMuZ2l0LnJ1bihbXG4gICAgICAnZmV0Y2gnLFxuICAgICAgJy1xJyxcbiAgICAgICctZicsXG4gICAgICB0aGlzLmdpdC5nZXRSZXBvR2l0VXJsKCksXG4gICAgICAuLi5mZXRjaFJlZnNwZWNzLFxuICAgICAgLi4uZXh0cmFSZWZzcGVjcyxcbiAgICBdKTtcbiAgfVxuXG4gIC8qKiBQdXNoZXMgdGhlIGdpdmVuIHRhcmdldCBicmFuY2hlcyB1cHN0cmVhbS4gKi9cbiAgcHJvdGVjdGVkIHB1c2hUYXJnZXRCcmFuY2hlc1Vwc3RyZWFtKG5hbWVzOiBzdHJpbmdbXSkge1xuICAgIGNvbnN0IHB1c2hSZWZzcGVjcyA9IG5hbWVzLm1hcCgodGFyZ2V0QnJhbmNoKSA9PiB7XG4gICAgICBjb25zdCBsb2NhbFRhcmdldEJyYW5jaCA9IHRoaXMuZ2V0TG9jYWxUYXJnZXRCcmFuY2hOYW1lKHRhcmdldEJyYW5jaCk7XG4gICAgICByZXR1cm4gYCR7bG9jYWxUYXJnZXRCcmFuY2h9OnJlZnMvaGVhZHMvJHt0YXJnZXRCcmFuY2h9YDtcbiAgICB9KTtcbiAgICAvLyBQdXNoIGFsbCB0YXJnZXQgYnJhbmNoZXMgd2l0aCBhIHNpbmdsZSBjb21tYW5kIGlmIHdlIGRvbid0IHJ1biBpbiBkcnktcnVuIG1vZGUuXG4gICAgLy8gV2UgZG9uJ3Qgd2FudCB0byBwdXNoIHRoZW0gaW5kaXZpZHVhbGx5IGFzIHRoYXQgY291bGQgY2F1c2UgYW4gdW5uZWNlc3Nhcnkgc2xvdy1kb3duLlxuICAgIHRoaXMuZ2l0LnJ1bihbJ3B1c2gnLCAnLS1hdG9taWMnLCB0aGlzLmdpdC5nZXRSZXBvR2l0VXJsKCksIC4uLnB1c2hSZWZzcGVjc10pO1xuICB9XG5cbiAgLyoqIEFzc2VydHMgdGhhdCBnaXZlbiBwdWxsIHJlcXVlc3QgY291bGQgYmUgbWVyZ2VkIGludG8gdGhlIGdpdmVuIHRhcmdldCBicmFuY2hlcy4gKi9cbiAgcHJvdGVjdGVkIGFzeW5jIF9hc3NlcnRNZXJnZWFibGVPclRocm93KFxuICAgIHtyZXZpc2lvblJhbmdlfTogUHVsbFJlcXVlc3QsXG4gICAgdGFyZ2V0QnJhbmNoZXM6IHN0cmluZ1tdLFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBmYWlsZWRCcmFuY2hlcyA9IHRoaXMuY2hlcnJ5UGlja0ludG9UYXJnZXRCcmFuY2hlcyhyZXZpc2lvblJhbmdlLCB0YXJnZXRCcmFuY2hlcywge1xuICAgICAgZHJ5UnVuOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgaWYgKGZhaWxlZEJyYW5jaGVzLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IE1lcmdlQ29uZmxpY3RzRmF0YWxFcnJvcihmYWlsZWRCcmFuY2hlcyk7XG4gICAgfVxuICB9XG59XG4iXX0=