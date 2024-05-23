/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MergeStrategy, TEMP_PR_HEAD_BRANCH } from './strategy.js';
import { MergeConflictsFatalError } from '../failures.js';
/**
 * Merge strategy that does not use the Github API for merging. Instead, it fetches
 * all target branches and the PR locally. The PR is then cherry-picked with autosquash
 * enabled into the target branches. The benefit is the support for fixup and squash commits.
 * A notable downside though is that Github does not show the PR as `Merged` due to non
 * fast-forward merges
 */
export class AutosquashMergeStrategy extends MergeStrategy {
    /**
     * Merges the specified pull request into the target branches and pushes the target
     * branches upstream. This method requires the temporary target branches to be fetched
     * already as we don't want to fetch the target branches per pull request merge. This
     * would causes unnecessary multiple fetch requests when multiple PRs are merged.
     *
     * @throws {GitCommandError} An unknown Git command error occurred that is not
     *   specific to the pull request merge.
     * @throws {FatalMergeToolError} A fatal error if the merge could not be performed.
     */
    async merge(pullRequest) {
        const { githubTargetBranch, targetBranches, revisionRange, needsCommitMessageFixup, baseSha, prNumber, } = pullRequest;
        // We always rebase the pull request so that fixup or squash commits are automatically
        // collapsed. Git's autosquash functionality does only work in interactive rebases, so
        // our rebase is always interactive. In reality though, unless a commit message fixup
        // is desired, we set the `GIT_SEQUENCE_EDITOR` environment variable to `true` so that
        // the rebase seems interactive to Git, while it's not interactive to the user.
        // See: https://github.com/git/git/commit/891d4a0313edc03f7e2ecb96edec5d30dc182294.
        const branchOrRevisionBeforeRebase = this.git.getCurrentBranchOrRevision();
        const rebaseEnv = needsCommitMessageFixup
            ? undefined
            : { ...process.env, GIT_SEQUENCE_EDITOR: 'true' };
        this.git.run(['rebase', '--interactive', '--autosquash', baseSha, TEMP_PR_HEAD_BRANCH], {
            stdio: 'inherit',
            env: rebaseEnv,
        });
        // Update pull requests commits to reference the pull request. This matches what
        // Github does when pull requests are merged through the Web UI. The motivation is
        // that it should be easy to determine which pull request contained a given commit.
        // Note: The filter-branch command relies on the working tree, so we want to make sure
        // that we are on the initial branch or revision where the merge script has been invoked.
        this.git.run(['checkout', '-f', branchOrRevisionBeforeRebase]);
        this.git.run([
            'filter-branch',
            '-f',
            '--msg-filter',
            `${getCommitMessageFilterScriptPath()} ${prNumber}`,
            revisionRange, // Range still captures the squashed commits (`base..PR_HEAD`).
        ]);
        // Perform the actual cherry picking into target branches.
        // Note: Range still captures the squashed commits (`base..PR_HEAD`).
        const failedBranches = this.cherryPickIntoTargetBranches(revisionRange, targetBranches);
        // We already checked whether the PR can be cherry-picked into the target branches,
        // but in case the cherry-pick somehow fails, we still handle the conflicts here. The
        // commits created through the Github API could be different (i.e. through squash).
        if (failedBranches.length) {
            throw new MergeConflictsFatalError(failedBranches);
        }
        // Push the cherry picked branches upstream.
        this.pushTargetBranchesUpstream(targetBranches);
        /** The local branch name of the github targeted branch. */
        const localBranch = this.getLocalTargetBranchName(githubTargetBranch);
        /** The SHA of the commit pushed to github which represents closing the PR. */
        const sha = this.git.run(['rev-parse', localBranch]).stdout.trim();
        // Allow user to set an amount of time to wait to account for rate limiting of the token usage
        // during merge otherwise just waits 0 seconds.
        await new Promise((resolve) => setTimeout(resolve, parseInt(process.env['AUTOSQUASH_TIMEOUT'] || '0')));
        // Github automatically closes PRs whose commits are merged into the main branch on Github.
        // However, it does not note them as merged using the purple merge badge as occurs when done via
        // the UI. To inform users that the PR was in fact merged, add a comment expressing the fact
        // that the PR is merged and what branches the changes were merged into.
        await this.git.github.issues.createComment({
            ...this.git.remoteParams,
            issue_number: pullRequest.prNumber,
            body: `This PR was merged into the repository by commit ${sha}.\n\n` +
                `The changes were merged into the following branches: ${targetBranches.join(', ')}`,
        });
        // For PRs which do not target the `main` branch on Github, Github does not automatically
        // close the PR when its commit is pushed into the repository. To ensure these PRs are
        // correctly marked as closed, we must detect this situation and close the PR via the API after
        // the upstream pushes are completed.
        if (githubTargetBranch !== this.git.mainBranchName) {
            await this.git.github.pulls.update({
                ...this.git.remoteParams,
                pull_number: pullRequest.prNumber,
                state: 'closed',
            });
        }
    }
}
/** Gets the absolute file path to the commit-message filter script. */
function getCommitMessageFilterScriptPath() {
    // This file is getting bundled and ends up in `<pkg-root>/bundles/<chunk>`. We also
    // bundle the commit-message-filter script as another entry-point and can reference
    // it relatively as the path is preserved inside `bundles/`.
    // *Note*: Relying on package resolution is problematic within ESM and with `local-dev.sh`
    const bundlesDir = dirname(fileURLToPath(import.meta.url));
    return join(bundlesDir, './pr/merge/strategies/commit-message-filter.mjs');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0b3NxdWFzaC1tZXJnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9wci9tZXJnZS9zdHJhdGVnaWVzL2F1dG9zcXVhc2gtbWVyZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFDbkMsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLEtBQUssQ0FBQztBQUVsQyxPQUFPLEVBQUMsYUFBYSxFQUFFLG1CQUFtQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQ2pFLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBRXhEOzs7Ozs7R0FNRztBQUNILE1BQU0sT0FBTyx1QkFBd0IsU0FBUSxhQUFhO0lBQ3hEOzs7Ozs7Ozs7T0FTRztJQUNNLEtBQUssQ0FBQyxLQUFLLENBQUMsV0FBd0I7UUFDM0MsTUFBTSxFQUNKLGtCQUFrQixFQUNsQixjQUFjLEVBQ2QsYUFBYSxFQUNiLHVCQUF1QixFQUN2QixPQUFPLEVBQ1AsUUFBUSxHQUNULEdBQUcsV0FBVyxDQUFDO1FBRWhCLHNGQUFzRjtRQUN0RixzRkFBc0Y7UUFDdEYscUZBQXFGO1FBQ3JGLHNGQUFzRjtRQUN0RiwrRUFBK0U7UUFDL0UsbUZBQW1GO1FBQ25GLE1BQU0sNEJBQTRCLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsRUFBRSxDQUFDO1FBQzNFLE1BQU0sU0FBUyxHQUFHLHVCQUF1QjtZQUN2QyxDQUFDLENBQUMsU0FBUztZQUNYLENBQUMsQ0FBQyxFQUFDLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLEVBQUMsQ0FBQztRQUNsRCxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxlQUFlLEVBQUUsY0FBYyxFQUFFLE9BQU8sRUFB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QUFDN0UsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2Rpcm5hbWUsIGpvaW59IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtmaWxlVVJMVG9QYXRofSBmcm9tICd1cmwnO1xuaW1wb3J0IHtQdWxsUmVxdWVzdH0gZnJvbSAnLi4vcHVsbC1yZXF1ZXN0LmpzJztcbmltcG9ydCB7TWVyZ2VTdHJhdGVneSwgVEVNUF9QUl9IRUFEX0JSQU5DSH0gZnJvbSAnLi9zdHJhdGVneS5qcyc7XG5pbXBvcnQge01lcmdlQ29uZmxpY3RzRmF0YWxFcnJvcn0gZnJvbSAnLi4vZmFpbHVyZXMuanMnO1xuXG4vKipcbiAqIE1lcmdlIHN0cmF0ZWd5IHRoYXQgZG9lcyBub3QgdXNlIHRoZSBHaXRodWIgQVBJIGZvciBtZXJnaW5nLiBJbnN0ZWFkLCBpdCBmZXRjaGVzXG4gKiBhbGwgdGFyZ2V0IGJyYW5jaGVzIGFuZCB0aGUgUFIgbG9jYWxseS4gVGhlIFBSIGlzIHRoZW4gY2hlcnJ5LXBpY2tlZCB3aXRoIGF1dG9zcXVhc2hcbiAqIGVuYWJsZWQgaW50byB0aGUgdGFyZ2V0IGJyYW5jaGVzLiBUaGUgYmVuZWZpdCBpcyB0aGUgc3VwcG9ydCBmb3IgZml4dXAgYW5kIHNxdWFzaCBjb21taXRzLlxuICogQSBub3RhYmxlIGRvd25zaWRlIHRob3VnaCBpcyB0aGF0IEdpdGh1YiBkb2VzIG5vdCBzaG93IHRoZSBQUiBhcyBgTWVyZ2VkYCBkdWUgdG8gbm9uXG4gKiBmYXN0LWZvcndhcmQgbWVyZ2VzXG4gKi9cbmV4cG9ydCBjbGFzcyBBdXRvc3F1YXNoTWVyZ2VTdHJhdGVneSBleHRlbmRzIE1lcmdlU3RyYXRlZ3kge1xuICAvKipcbiAgICogTWVyZ2VzIHRoZSBzcGVjaWZpZWQgcHVsbCByZXF1ZXN0IGludG8gdGhlIHRhcmdldCBicmFuY2hlcyBhbmQgcHVzaGVzIHRoZSB0YXJnZXRcbiAgICogYnJhbmNoZXMgdXBzdHJlYW0uIFRoaXMgbWV0aG9kIHJlcXVpcmVzIHRoZSB0ZW1wb3JhcnkgdGFyZ2V0IGJyYW5jaGVzIHRvIGJlIGZldGNoZWRcbiAgICogYWxyZWFkeSBhcyB3ZSBkb24ndCB3YW50IHRvIGZldGNoIHRoZSB0YXJnZXQgYnJhbmNoZXMgcGVyIHB1bGwgcmVxdWVzdCBtZXJnZS4gVGhpc1xuICAgKiB3b3VsZCBjYXVzZXMgdW5uZWNlc3NhcnkgbXVsdGlwbGUgZmV0Y2ggcmVxdWVzdHMgd2hlbiBtdWx0aXBsZSBQUnMgYXJlIG1lcmdlZC5cbiAgICpcbiAgICogQHRocm93cyB7R2l0Q29tbWFuZEVycm9yfSBBbiB1bmtub3duIEdpdCBjb21tYW5kIGVycm9yIG9jY3VycmVkIHRoYXQgaXMgbm90XG4gICAqICAgc3BlY2lmaWMgdG8gdGhlIHB1bGwgcmVxdWVzdCBtZXJnZS5cbiAgICogQHRocm93cyB7RmF0YWxNZXJnZVRvb2xFcnJvcn0gQSBmYXRhbCBlcnJvciBpZiB0aGUgbWVyZ2UgY291bGQgbm90IGJlIHBlcmZvcm1lZC5cbiAgICovXG4gIG92ZXJyaWRlIGFzeW5jIG1lcmdlKHB1bGxSZXF1ZXN0OiBQdWxsUmVxdWVzdCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHtcbiAgICAgIGdpdGh1YlRhcmdldEJyYW5jaCxcbiAgICAgIHRhcmdldEJyYW5jaGVzLFxuICAgICAgcmV2aXNpb25SYW5nZSxcbiAgICAgIG5lZWRzQ29tbWl0TWVzc2FnZUZpeHVwLFxuICAgICAgYmFzZVNoYSxcbiAgICAgIHByTnVtYmVyLFxuICAgIH0gPSBwdWxsUmVxdWVzdDtcblxuICAgIC8vIFdlIGFsd2F5cyByZWJhc2UgdGhlIHB1bGwgcmVxdWVzdCBzbyB0aGF0IGZpeHVwIG9yIHNxdWFzaCBjb21taXRzIGFyZSBhdXRvbWF0aWNhbGx5XG4gICAgLy8gY29sbGFwc2VkLiBHaXQncyBhdXRvc3F1YXNoIGZ1bmN0aW9uYWxpdHkgZG9lcyBvbmx5IHdvcmsgaW4gaW50ZXJhY3RpdmUgcmViYXNlcywgc29cbiAgICAvLyBvdXIgcmViYXNlIGlzIGFsd2F5cyBpbnRlcmFjdGl2ZS4gSW4gcmVhbGl0eSB0aG91Z2gsIHVubGVzcyBhIGNvbW1pdCBtZXNzYWdlIGZpeHVwXG4gICAgLy8gaXMgZGVzaXJlZCwgd2Ugc2V0IHRoZSBgR0lUX1NFUVVFTkNFX0VESVRPUmAgZW52aXJvbm1lbnQgdmFyaWFibGUgdG8gYHRydWVgIHNvIHRoYXRcbiAgICAvLyB0aGUgcmViYXNlIHNlZW1zIGludGVyYWN0aXZlIHRvIEdpdCwgd2hpbGUgaXQncyBub3QgaW50ZXJhY3RpdmUgdG8gdGhlIHVzZXIuXG4gICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZ2l0L2dpdC9jb21taXQvODkxZDRhMDMxM2VkYzAzZjdlMmVjYjk2ZWRlYzVkMzBkYzE4MjI5NC5cbiAgICBjb25zdCBicmFuY2hPclJldmlzaW9uQmVmb3JlUmViYXNlID0gdGhpcy5naXQuZ2V0Q3VycmVudEJyYW5jaE9yUmV2aXNpb24oKTtcbiAgICBjb25zdCByZWJhc2VFbnYgPSBuZWVkc0NvbW1pdE1lc3NhZ2VGaXh1cFxuICAgICAgPyB1bmRlZmluZWRcbiAgICAgIDogey4uLnByb2Nlc3MuZW52LCBHSVRfU0VRVUVOQ0VfRURJVE9SOiAndHJ1ZSd9O1xuICAgIHRoaXMuZ2l0LnJ1bihbJ3JlYmFzZScsICctLWludGVyYWN0aXZlJywgJy0tYXV0b3NxdWFzaCcsIGJhc2VTaGEsIFRFTVBfUFJfSEVBRF9CUkFOQ0hdLCB7XG4gICAgICBzdGRpbzogJ2luaGVyaXQnLFxuICAgICAgZW52OiByZWJhc2VFbnYsXG4gICAgfSk7XG5cbiAgICAvLyBVcGRhdGUgcHVsbCByZXF1ZXN0cyBjb21taXRzIHRvIHJlZmVyZW5jZSB0aGUgcHVsbCByZXF1ZXN0LiBUaGlzIG1hdGNoZXMgd2hhdFxuICAgIC8vIEdpdGh1YiBkb2VzIHdoZW4gcHVsbCByZXF1ZXN0cyBhcmUgbWVyZ2VkIHRocm91Z2ggdGhlIFdlYiBVSS4gVGhlIG1vdGl2YXRpb24gaXNcbiAgICAvLyB0aGF0IGl0IHNob3VsZCBiZSBlYXN5IHRvIGRldGVybWluZSB3aGljaCBwdWxsIHJlcXVlc3QgY29udGFpbmVkIGEgZ2l2ZW4gY29tbWl0LlxuICAgIC8vIE5vdGU6IFRoZSBmaWx0ZXItYnJhbmNoIGNvbW1hbmQgcmVsaWVzIG9uIHRoZSB3b3JraW5nIHRyZWUsIHNvIHdlIHdhbnQgdG8gbWFrZSBzdXJlXG4gICAgLy8gdGhhdCB3ZSBhcmUgb24gdGhlIGluaXRpYWwgYnJhbmNoIG9yIHJldmlzaW9uIHdoZXJlIHRoZSBtZXJnZSBzY3JpcHQgaGFzIGJlZW4gaW52b2tlZC5cbiAgICB0aGlzLmdpdC5ydW4oWydjaGVja291dCcsICctZicsIGJyYW5jaE9yUmV2aXNpb25CZWZvcmVSZWJhc2VdKTtcbiAgICB0aGlzLmdpdC5ydW4oW1xuICAgICAgJ2ZpbHRlci1icmFuY2gnLFxuICAgICAgJy1mJyxcbiAgICAgICctLW1zZy1maWx0ZXInLFxuICAgICAgYCR7Z2V0Q29tbWl0TWVzc2FnZUZpbHRlclNjcmlwdFBhdGgoKX0gJHtwck51bWJlcn1gLFxuICAgICAgcmV2aXNpb25SYW5nZSwgLy8gUmFuZ2Ugc3RpbGwgY2FwdHVyZXMgdGhlIHNxdWFzaGVkIGNvbW1pdHMgKGBiYXNlLi5QUl9IRUFEYCkuXG4gICAgXSk7XG5cbiAgICAvLyBQZXJmb3JtIHRoZSBhY3R1YWwgY2hlcnJ5IHBpY2tpbmcgaW50byB0YXJnZXQgYnJhbmNoZXMuXG4gICAgLy8gTm90ZTogUmFuZ2Ugc3RpbGwgY2FwdHVyZXMgdGhlIHNxdWFzaGVkIGNvbW1pdHMgKGBiYXNlLi5QUl9IRUFEYCkuXG4gICAgY29uc3QgZmFpbGVkQnJhbmNoZXMgPSB0aGlzLmNoZXJyeVBpY2tJbnRvVGFyZ2V0QnJhbmNoZXMocmV2aXNpb25SYW5nZSwgdGFyZ2V0QnJhbmNoZXMpO1xuXG4gICAgLy8gV2UgYWxyZWFkeSBjaGVja2VkIHdoZXRoZXIgdGhlIFBSIGNhbiBiZSBjaGVycnktcGlja2VkIGludG8gdGhlIHRhcmdldCBicmFuY2hlcyxcbiAgICAvLyBidXQgaW4gY2FzZSB0aGUgY2hlcnJ5LXBpY2sgc29tZWhvdyBmYWlscywgd2Ugc3RpbGwgaGFuZGxlIHRoZSBjb25mbGljdHMgaGVyZS4gVGhlXG4gICAgLy8gY29tbWl0cyBjcmVhdGVkIHRocm91Z2ggdGhlIEdpdGh1YiBBUEkgY291bGQgYmUgZGlmZmVyZW50IChpLmUuIHRocm91Z2ggc3F1YXNoKS5cbiAgICBpZiAoZmFpbGVkQnJhbmNoZXMubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgTWVyZ2VDb25mbGljdHNGYXRhbEVycm9yKGZhaWxlZEJyYW5jaGVzKTtcbiAgICB9XG5cbiAgICAvLyBQdXNoIHRoZSBjaGVycnkgcGlja2VkIGJyYW5jaGVzIHVwc3RyZWFtLlxuICAgIHRoaXMucHVzaFRhcmdldEJyYW5jaGVzVXBzdHJlYW0odGFyZ2V0QnJhbmNoZXMpO1xuXG4gICAgLyoqIFRoZSBsb2NhbCBicmFuY2ggbmFtZSBvZiB0aGUgZ2l0aHViIHRhcmdldGVkIGJyYW5jaC4gKi9cbiAgICBjb25zdCBsb2NhbEJyYW5jaCA9IHRoaXMuZ2V0TG9jYWxUYXJnZXRCcmFuY2hOYW1lKGdpdGh1YlRhcmdldEJyYW5jaCk7XG4gICAgLyoqIFRoZSBTSEEgb2YgdGhlIGNvbW1pdCBwdXNoZWQgdG8gZ2l0aHViIHdoaWNoIHJlcHJlc2VudHMgY2xvc2luZyB0aGUgUFIuICovXG4gICAgY29uc3Qgc2hhID0gdGhpcy5naXQucnVuKFsncmV2LXBhcnNlJywgbG9jYWxCcmFuY2hdKS5zdGRvdXQudHJpbSgpO1xuICAgIC8vIEFsbG93IHVzZXIgdG8gc2V0IGFuIGFtb3VudCBvZiB0aW1lIHRvIHdhaXQgdG8gYWNjb3VudCBmb3IgcmF0ZSBsaW1pdGluZyBvZiB0aGUgdG9rZW4gdXNhZ2VcbiAgICAvLyBkdXJpbmcgbWVyZ2Ugb3RoZXJ3aXNlIGp1c3Qgd2FpdHMgMCBzZWNvbmRzLlxuICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PlxuICAgICAgc2V0VGltZW91dChyZXNvbHZlLCBwYXJzZUludChwcm9jZXNzLmVudlsnQVVUT1NRVUFTSF9USU1FT1VUJ10gfHwgJzAnKSksXG4gICAgKTtcbiAgICAvLyBHaXRodWIgYXV0b21hdGljYWxseSBjbG9zZXMgUFJzIHdob3NlIGNvbW1pdHMgYXJlIG1lcmdlZCBpbnRvIHRoZSBtYWluIGJyYW5jaCBvbiBHaXRodWIuXG4gICAgLy8gSG93ZXZlciwgaXQgZG9lcyBub3Qgbm90ZSB0aGVtIGFzIG1lcmdlZCB1c2luZyB0aGUgcHVycGxlIG1lcmdlIGJhZGdlIGFzIG9jY3VycyB3aGVuIGRvbmUgdmlhXG4gICAgLy8gdGhlIFVJLiBUbyBpbmZvcm0gdXNlcnMgdGhhdCB0aGUgUFIgd2FzIGluIGZhY3QgbWVyZ2VkLCBhZGQgYSBjb21tZW50IGV4cHJlc3NpbmcgdGhlIGZhY3RcbiAgICAvLyB0aGF0IHRoZSBQUiBpcyBtZXJnZWQgYW5kIHdoYXQgYnJhbmNoZXMgdGhlIGNoYW5nZXMgd2VyZSBtZXJnZWQgaW50by5cbiAgICBhd2FpdCB0aGlzLmdpdC5naXRodWIuaXNzdWVzLmNyZWF0ZUNvbW1lbnQoe1xuICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgaXNzdWVfbnVtYmVyOiBwdWxsUmVxdWVzdC5wck51bWJlcixcbiAgICAgIGJvZHk6XG4gICAgICAgIGBUaGlzIFBSIHdhcyBtZXJnZWQgaW50byB0aGUgcmVwb3NpdG9yeSBieSBjb21taXQgJHtzaGF9LlxcblxcbmAgK1xuICAgICAgICBgVGhlIGNoYW5nZXMgd2VyZSBtZXJnZWQgaW50byB0aGUgZm9sbG93aW5nIGJyYW5jaGVzOiAke3RhcmdldEJyYW5jaGVzLmpvaW4oJywgJyl9YCxcbiAgICB9KTtcblxuICAgIC8vIEZvciBQUnMgd2hpY2ggZG8gbm90IHRhcmdldCB0aGUgYG1haW5gIGJyYW5jaCBvbiBHaXRodWIsIEdpdGh1YiBkb2VzIG5vdCBhdXRvbWF0aWNhbGx5XG4gICAgLy8gY2xvc2UgdGhlIFBSIHdoZW4gaXRzIGNvbW1pdCBpcyBwdXNoZWQgaW50byB0aGUgcmVwb3NpdG9yeS4gVG8gZW5zdXJlIHRoZXNlIFBScyBhcmVcbiAgICAvLyBjb3JyZWN0bHkgbWFya2VkIGFzIGNsb3NlZCwgd2UgbXVzdCBkZXRlY3QgdGhpcyBzaXR1YXRpb24gYW5kIGNsb3NlIHRoZSBQUiB2aWEgdGhlIEFQSSBhZnRlclxuICAgIC8vIHRoZSB1cHN0cmVhbSBwdXNoZXMgYXJlIGNvbXBsZXRlZC5cbiAgICBpZiAoZ2l0aHViVGFyZ2V0QnJhbmNoICE9PSB0aGlzLmdpdC5tYWluQnJhbmNoTmFtZSkge1xuICAgICAgYXdhaXQgdGhpcy5naXQuZ2l0aHViLnB1bGxzLnVwZGF0ZSh7XG4gICAgICAgIC4uLnRoaXMuZ2l0LnJlbW90ZVBhcmFtcyxcbiAgICAgICAgcHVsbF9udW1iZXI6IHB1bGxSZXF1ZXN0LnByTnVtYmVyLFxuICAgICAgICBzdGF0ZTogJ2Nsb3NlZCcsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cblxuLyoqIEdldHMgdGhlIGFic29sdXRlIGZpbGUgcGF0aCB0byB0aGUgY29tbWl0LW1lc3NhZ2UgZmlsdGVyIHNjcmlwdC4gKi9cbmZ1bmN0aW9uIGdldENvbW1pdE1lc3NhZ2VGaWx0ZXJTY3JpcHRQYXRoKCk6IHN0cmluZyB7XG4gIC8vIFRoaXMgZmlsZSBpcyBnZXR0aW5nIGJ1bmRsZWQgYW5kIGVuZHMgdXAgaW4gYDxwa2ctcm9vdD4vYnVuZGxlcy88Y2h1bms+YC4gV2UgYWxzb1xuICAvLyBidW5kbGUgdGhlIGNvbW1pdC1tZXNzYWdlLWZpbHRlciBzY3JpcHQgYXMgYW5vdGhlciBlbnRyeS1wb2ludCBhbmQgY2FuIHJlZmVyZW5jZVxuICAvLyBpdCByZWxhdGl2ZWx5IGFzIHRoZSBwYXRoIGlzIHByZXNlcnZlZCBpbnNpZGUgYGJ1bmRsZXMvYC5cbiAgLy8gKk5vdGUqOiBSZWx5aW5nIG9uIHBhY2thZ2UgcmVzb2x1dGlvbiBpcyBwcm9ibGVtYXRpYyB3aXRoaW4gRVNNIGFuZCB3aXRoIGBsb2NhbC1kZXYuc2hgXG4gIGNvbnN0IGJ1bmRsZXNEaXIgPSBkaXJuYW1lKGZpbGVVUkxUb1BhdGgoaW1wb3J0Lm1ldGEudXJsKSk7XG4gIHJldHVybiBqb2luKGJ1bmRsZXNEaXIsICcuL3ByL21lcmdlL3N0cmF0ZWdpZXMvY29tbWl0LW1lc3NhZ2UtZmlsdGVyLm1qcycpO1xufVxuIl19