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
        // that the PR is merged
        await this.git.github.issues.createComment({
            ...this.git.remoteParams,
            issue_number: pullRequest.prNumber,
            body: `This PR was merged into the repository by commit ${sha}.`,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0b3NxdWFzaC1tZXJnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9wci9tZXJnZS9zdHJhdGVnaWVzL2F1dG9zcXVhc2gtbWVyZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFDbkMsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLEtBQUssQ0FBQztBQUVsQyxPQUFPLEVBQUMsYUFBYSxFQUFFLG1CQUFtQixFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQ2pFLE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBRXhEOzs7Ozs7R0FNRztBQUNILE1BQU0sT0FBTyx1QkFBd0IsU0FBUSxhQUFhO0lBQ3hEOzs7Ozs7Ozs7T0FTRztJQUNNLEtBQUssQ0FBQyxLQUFLLENBQUMsV0FBd0I7UUFDM0MsTUFBTSxFQUNKLGtCQUFrQixFQUNsQixjQUFjLEVBQ2QsYUFBYSxFQUNiLHVCQUF1QixFQUN2QixPQUFPLEVBQ1AsUUFBUSxHQUNULEdBQUcsV0FBVyxDQUFDO1FBRWhCLHNGQUFzRjtRQUN0RixzRkFBc0Y7UUFDdEYscUZBQXFGO1FBQ3JGLHNGQUFzRjtRQUN0RiwrRUFBK0U7UUFDL0UsbUZBQW1GO1FBQ25GLE1BQU0sNEJBQTRCLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsRUFBRSxDQUFDO1FBQzNFLE1BQU0sU0FBUyxHQUFHLHVCQUF1QjtZQUN2QyxDQUFDLENBQUMsU0FBUztZQUNYLENBQUMsQ0FBQyxFQUFDLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLEVBQUMsQ0FBQztRQUNsRCxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxlQUFlLEVBQUUsY0FBYyxFQUFFLE9BQU8sRUFB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ICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7ZGlybmFtZSwgam9pbn0gZnJvbSAncGF0aCc7XG5pbXBvcnQge2ZpbGVVUkxUb1BhdGh9IGZyb20gJ3VybCc7XG5pbXBvcnQge1B1bGxSZXF1ZXN0fSBmcm9tICcuLi9wdWxsLXJlcXVlc3QuanMnO1xuaW1wb3J0IHtNZXJnZVN0cmF0ZWd5LCBURU1QX1BSX0hFQURfQlJBTkNIfSBmcm9tICcuL3N0cmF0ZWd5LmpzJztcbmltcG9ydCB7TWVyZ2VDb25mbGljdHNGYXRhbEVycm9yfSBmcm9tICcuLi9mYWlsdXJlcy5qcyc7XG5cbi8qKlxuICogTWVyZ2Ugc3RyYXRlZ3kgdGhhdCBkb2VzIG5vdCB1c2UgdGhlIEdpdGh1YiBBUEkgZm9yIG1lcmdpbmcuIEluc3RlYWQsIGl0IGZldGNoZXNcbiAqIGFsbCB0YXJnZXQgYnJhbmNoZXMgYW5kIHRoZSBQUiBsb2NhbGx5LiBUaGUgUFIgaXMgdGhlbiBjaGVycnktcGlja2VkIHdpdGggYXV0b3NxdWFzaFxuICogZW5hYmxlZCBpbnRvIHRoZSB0YXJnZXQgYnJhbmNoZXMuIFRoZSBiZW5lZml0IGlzIHRoZSBzdXBwb3J0IGZvciBmaXh1cCBhbmQgc3F1YXNoIGNvbW1pdHMuXG4gKiBBIG5vdGFibGUgZG93bnNpZGUgdGhvdWdoIGlzIHRoYXQgR2l0aHViIGRvZXMgbm90IHNob3cgdGhlIFBSIGFzIGBNZXJnZWRgIGR1ZSB0byBub25cbiAqIGZhc3QtZm9yd2FyZCBtZXJnZXNcbiAqL1xuZXhwb3J0IGNsYXNzIEF1dG9zcXVhc2hNZXJnZVN0cmF0ZWd5IGV4dGVuZHMgTWVyZ2VTdHJhdGVneSB7XG4gIC8qKlxuICAgKiBNZXJnZXMgdGhlIHNwZWNpZmllZCBwdWxsIHJlcXVlc3QgaW50byB0aGUgdGFyZ2V0IGJyYW5jaGVzIGFuZCBwdXNoZXMgdGhlIHRhcmdldFxuICAgKiBicmFuY2hlcyB1cHN0cmVhbS4gVGhpcyBtZXRob2QgcmVxdWlyZXMgdGhlIHRlbXBvcmFyeSB0YXJnZXQgYnJhbmNoZXMgdG8gYmUgZmV0Y2hlZFxuICAgKiBhbHJlYWR5IGFzIHdlIGRvbid0IHdhbnQgdG8gZmV0Y2ggdGhlIHRhcmdldCBicmFuY2hlcyBwZXIgcHVsbCByZXF1ZXN0IG1lcmdlLiBUaGlzXG4gICAqIHdvdWxkIGNhdXNlcyB1bm5lY2Vzc2FyeSBtdWx0aXBsZSBmZXRjaCByZXF1ZXN0cyB3aGVuIG11bHRpcGxlIFBScyBhcmUgbWVyZ2VkLlxuICAgKlxuICAgKiBAdGhyb3dzIHtHaXRDb21tYW5kRXJyb3J9IEFuIHVua25vd24gR2l0IGNvbW1hbmQgZXJyb3Igb2NjdXJyZWQgdGhhdCBpcyBub3RcbiAgICogICBzcGVjaWZpYyB0byB0aGUgcHVsbCByZXF1ZXN0IG1lcmdlLlxuICAgKiBAdGhyb3dzIHtGYXRhbE1lcmdlVG9vbEVycm9yfSBBIGZhdGFsIGVycm9yIGlmIHRoZSBtZXJnZSBjb3VsZCBub3QgYmUgcGVyZm9ybWVkLlxuICAgKi9cbiAgb3ZlcnJpZGUgYXN5bmMgbWVyZ2UocHVsbFJlcXVlc3Q6IFB1bGxSZXF1ZXN0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qge1xuICAgICAgZ2l0aHViVGFyZ2V0QnJhbmNoLFxuICAgICAgdGFyZ2V0QnJhbmNoZXMsXG4gICAgICByZXZpc2lvblJhbmdlLFxuICAgICAgbmVlZHNDb21taXRNZXNzYWdlRml4dXAsXG4gICAgICBiYXNlU2hhLFxuICAgICAgcHJOdW1iZXIsXG4gICAgfSA9IHB1bGxSZXF1ZXN0O1xuXG4gICAgLy8gV2UgYWx3YXlzIHJlYmFzZSB0aGUgcHVsbCByZXF1ZXN0IHNvIHRoYXQgZml4dXAgb3Igc3F1YXNoIGNvbW1pdHMgYXJlIGF1dG9tYXRpY2FsbHlcbiAgICAvLyBjb2xsYXBzZWQuIEdpdCdzIGF1dG9zcXVhc2ggZnVuY3Rpb25hbGl0eSBkb2VzIG9ubHkgd29yayBpbiBpbnRlcmFjdGl2ZSByZWJhc2VzLCBzb1xuICAgIC8vIG91ciByZWJhc2UgaXMgYWx3YXlzIGludGVyYWN0aXZlLiBJbiByZWFsaXR5IHRob3VnaCwgdW5sZXNzIGEgY29tbWl0IG1lc3NhZ2UgZml4dXBcbiAgICAvLyBpcyBkZXNpcmVkLCB3ZSBzZXQgdGhlIGBHSVRfU0VRVUVOQ0VfRURJVE9SYCBlbnZpcm9ubWVudCB2YXJpYWJsZSB0byBgdHJ1ZWAgc28gdGhhdFxuICAgIC8vIHRoZSByZWJhc2Ugc2VlbXMgaW50ZXJhY3RpdmUgdG8gR2l0LCB3aGlsZSBpdCdzIG5vdCBpbnRlcmFjdGl2ZSB0byB0aGUgdXNlci5cbiAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9naXQvZ2l0L2NvbW1pdC84OTFkNGEwMzEzZWRjMDNmN2UyZWNiOTZlZGVjNWQzMGRjMTgyMjk0LlxuICAgIGNvbnN0IGJyYW5jaE9yUmV2aXNpb25CZWZvcmVSZWJhc2UgPSB0aGlzLmdpdC5nZXRDdXJyZW50QnJhbmNoT3JSZXZpc2lvbigpO1xuICAgIGNvbnN0IHJlYmFzZUVudiA9IG5lZWRzQ29tbWl0TWVzc2FnZUZpeHVwXG4gICAgICA/IHVuZGVmaW5lZFxuICAgICAgOiB7Li4ucHJvY2Vzcy5lbnYsIEdJVF9TRVFVRU5DRV9FRElUT1I6ICd0cnVlJ307XG4gICAgdGhpcy5naXQucnVuKFsncmViYXNlJywgJy0taW50ZXJhY3RpdmUnLCAnLS1hdXRvc3F1YXNoJywgYmFzZVNoYSwgVEVNUF9QUl9IRUFEX0JSQU5DSF0sIHtcbiAgICAgIHN0ZGlvOiAnaW5oZXJpdCcsXG4gICAgICBlbnY6IHJlYmFzZUVudixcbiAgICB9KTtcblxuICAgIC8vIFVwZGF0ZSBwdWxsIHJlcXVlc3RzIGNvbW1pdHMgdG8gcmVmZXJlbmNlIHRoZSBwdWxsIHJlcXVlc3QuIFRoaXMgbWF0Y2hlcyB3aGF0XG4gICAgLy8gR2l0aHViIGRvZXMgd2hlbiBwdWxsIHJlcXVlc3RzIGFyZSBtZXJnZWQgdGhyb3VnaCB0aGUgV2ViIFVJLiBUaGUgbW90aXZhdGlvbiBpc1xuICAgIC8vIHRoYXQgaXQgc2hvdWxkIGJlIGVhc3kgdG8gZGV0ZXJtaW5lIHdoaWNoIHB1bGwgcmVxdWVzdCBjb250YWluZWQgYSBnaXZlbiBjb21taXQuXG4gICAgLy8gTm90ZTogVGhlIGZpbHRlci1icmFuY2ggY29tbWFuZCByZWxpZXMgb24gdGhlIHdvcmtpbmcgdHJlZSwgc28gd2Ugd2FudCB0byBtYWtlIHN1cmVcbiAgICAvLyB0aGF0IHdlIGFyZSBvbiB0aGUgaW5pdGlhbCBicmFuY2ggb3IgcmV2aXNpb24gd2hlcmUgdGhlIG1lcmdlIHNjcmlwdCBoYXMgYmVlbiBpbnZva2VkLlxuICAgIHRoaXMuZ2l0LnJ1bihbJ2NoZWNrb3V0JywgJy1mJywgYnJhbmNoT3JSZXZpc2lvbkJlZm9yZVJlYmFzZV0pO1xuICAgIHRoaXMuZ2l0LnJ1bihbXG4gICAgICAnZmlsdGVyLWJyYW5jaCcsXG4gICAgICAnLWYnLFxuICAgICAgJy0tbXNnLWZpbHRlcicsXG4gICAgICBgJHtnZXRDb21taXRNZXNzYWdlRmlsdGVyU2NyaXB0UGF0aCgpfSAke3ByTnVtYmVyfWAsXG4gICAgICByZXZpc2lvblJhbmdlLCAvLyBSYW5nZSBzdGlsbCBjYXB0dXJlcyB0aGUgc3F1YXNoZWQgY29tbWl0cyAoYGJhc2UuLlBSX0hFQURgKS5cbiAgICBdKTtcblxuICAgIC8vIFBlcmZvcm0gdGhlIGFjdHVhbCBjaGVycnkgcGlja2luZyBpbnRvIHRhcmdldCBicmFuY2hlcy5cbiAgICAvLyBOb3RlOiBSYW5nZSBzdGlsbCBjYXB0dXJlcyB0aGUgc3F1YXNoZWQgY29tbWl0cyAoYGJhc2UuLlBSX0hFQURgKS5cbiAgICBjb25zdCBmYWlsZWRCcmFuY2hlcyA9IHRoaXMuY2hlcnJ5UGlja0ludG9UYXJnZXRCcmFuY2hlcyhyZXZpc2lvblJhbmdlLCB0YXJnZXRCcmFuY2hlcyk7XG5cbiAgICAvLyBXZSBhbHJlYWR5IGNoZWNrZWQgd2hldGhlciB0aGUgUFIgY2FuIGJlIGNoZXJyeS1waWNrZWQgaW50byB0aGUgdGFyZ2V0IGJyYW5jaGVzLFxuICAgIC8vIGJ1dCBpbiBjYXNlIHRoZSBjaGVycnktcGljayBzb21laG93IGZhaWxzLCB3ZSBzdGlsbCBoYW5kbGUgdGhlIGNvbmZsaWN0cyBoZXJlLiBUaGVcbiAgICAvLyBjb21taXRzIGNyZWF0ZWQgdGhyb3VnaCB0aGUgR2l0aHViIEFQSSBjb3VsZCBiZSBkaWZmZXJlbnQgKGkuZS4gdGhyb3VnaCBzcXVhc2gpLlxuICAgIGlmIChmYWlsZWRCcmFuY2hlcy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBNZXJnZUNvbmZsaWN0c0ZhdGFsRXJyb3IoZmFpbGVkQnJhbmNoZXMpO1xuICAgIH1cblxuICAgIC8vIFB1c2ggdGhlIGNoZXJyeSBwaWNrZWQgYnJhbmNoZXMgdXBzdHJlYW0uXG4gICAgdGhpcy5wdXNoVGFyZ2V0QnJhbmNoZXNVcHN0cmVhbSh0YXJnZXRCcmFuY2hlcyk7XG5cbiAgICAvKiogVGhlIGxvY2FsIGJyYW5jaCBuYW1lIG9mIHRoZSBnaXRodWIgdGFyZ2V0ZWQgYnJhbmNoLiAqL1xuICAgIGNvbnN0IGxvY2FsQnJhbmNoID0gdGhpcy5nZXRMb2NhbFRhcmdldEJyYW5jaE5hbWUoZ2l0aHViVGFyZ2V0QnJhbmNoKTtcbiAgICAvKiogVGhlIFNIQSBvZiB0aGUgY29tbWl0IHB1c2hlZCB0byBnaXRodWIgd2hpY2ggcmVwcmVzZW50cyBjbG9zaW5nIHRoZSBQUi4gKi9cbiAgICBjb25zdCBzaGEgPSB0aGlzLmdpdC5ydW4oWydyZXYtcGFyc2UnLCBsb2NhbEJyYW5jaF0pLnN0ZG91dC50cmltKCk7XG4gICAgLy8gQWxsb3cgdXNlciB0byBzZXQgYW4gYW1vdW50IG9mIHRpbWUgdG8gd2FpdCB0byBhY2NvdW50IGZvciByYXRlIGxpbWl0aW5nIG9mIHRoZSB0b2tlbiB1c2FnZVxuICAgIC8vIGR1cmluZyBtZXJnZSBvdGhlcndpc2UganVzdCB3YWl0cyAwIHNlY29uZHMuXG4gICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+XG4gICAgICBzZXRUaW1lb3V0KHJlc29sdmUsIHBhcnNlSW50KHByb2Nlc3MuZW52WydBVVRPU1FVQVNIX1RJTUVPVVQnXSB8fCAnMCcpKSxcbiAgICApO1xuICAgIC8vIEdpdGh1YiBhdXRvbWF0aWNhbGx5IGNsb3NlcyBQUnMgd2hvc2UgY29tbWl0cyBhcmUgbWVyZ2VkIGludG8gdGhlIG1haW4gYnJhbmNoIG9uIEdpdGh1Yi5cbiAgICAvLyBIb3dldmVyLCBpdCBkb2VzIG5vdCBub3RlIHRoZW0gYXMgbWVyZ2VkIHVzaW5nIHRoZSBwdXJwbGUgbWVyZ2UgYmFkZ2UgYXMgb2NjdXJzIHdoZW4gZG9uZSB2aWFcbiAgICAvLyB0aGUgVUkuIFRvIGluZm9ybSB1c2VycyB0aGF0IHRoZSBQUiB3YXMgaW4gZmFjdCBtZXJnZWQsIGFkZCBhIGNvbW1lbnQgZXhwcmVzc2luZyB0aGUgZmFjdFxuICAgIC8vIHRoYXQgdGhlIFBSIGlzIG1lcmdlZFxuICAgIGF3YWl0IHRoaXMuZ2l0LmdpdGh1Yi5pc3N1ZXMuY3JlYXRlQ29tbWVudCh7XG4gICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICBpc3N1ZV9udW1iZXI6IHB1bGxSZXF1ZXN0LnByTnVtYmVyLFxuICAgICAgYm9keTogYFRoaXMgUFIgd2FzIG1lcmdlZCBpbnRvIHRoZSByZXBvc2l0b3J5IGJ5IGNvbW1pdCAke3NoYX0uYCxcbiAgICB9KTtcblxuICAgIC8vIEZvciBQUnMgd2hpY2ggZG8gbm90IHRhcmdldCB0aGUgYG1haW5gIGJyYW5jaCBvbiBHaXRodWIsIEdpdGh1YiBkb2VzIG5vdCBhdXRvbWF0aWNhbGx5XG4gICAgLy8gY2xvc2UgdGhlIFBSIHdoZW4gaXRzIGNvbW1pdCBpcyBwdXNoZWQgaW50byB0aGUgcmVwb3NpdG9yeS4gVG8gZW5zdXJlIHRoZXNlIFBScyBhcmVcbiAgICAvLyBjb3JyZWN0bHkgbWFya2VkIGFzIGNsb3NlZCwgd2UgbXVzdCBkZXRlY3QgdGhpcyBzaXR1YXRpb24gYW5kIGNsb3NlIHRoZSBQUiB2aWEgdGhlIEFQSSBhZnRlclxuICAgIC8vIHRoZSB1cHN0cmVhbSBwdXNoZXMgYXJlIGNvbXBsZXRlZC5cbiAgICBpZiAoZ2l0aHViVGFyZ2V0QnJhbmNoICE9PSB0aGlzLmdpdC5tYWluQnJhbmNoTmFtZSkge1xuICAgICAgYXdhaXQgdGhpcy5naXQuZ2l0aHViLnB1bGxzLnVwZGF0ZSh7XG4gICAgICAgIC4uLnRoaXMuZ2l0LnJlbW90ZVBhcmFtcyxcbiAgICAgICAgcHVsbF9udW1iZXI6IHB1bGxSZXF1ZXN0LnByTnVtYmVyLFxuICAgICAgICBzdGF0ZTogJ2Nsb3NlZCcsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cblxuLyoqIEdldHMgdGhlIGFic29sdXRlIGZpbGUgcGF0aCB0byB0aGUgY29tbWl0LW1lc3NhZ2UgZmlsdGVyIHNjcmlwdC4gKi9cbmZ1bmN0aW9uIGdldENvbW1pdE1lc3NhZ2VGaWx0ZXJTY3JpcHRQYXRoKCk6IHN0cmluZyB7XG4gIC8vIFRoaXMgZmlsZSBpcyBnZXR0aW5nIGJ1bmRsZWQgYW5kIGVuZHMgdXAgaW4gYDxwa2ctcm9vdD4vYnVuZGxlcy88Y2h1bms+YC4gV2UgYWxzb1xuICAvLyBidW5kbGUgdGhlIGNvbW1pdC1tZXNzYWdlLWZpbHRlciBzY3JpcHQgYXMgYW5vdGhlciBlbnRyeS1wb2ludCBhbmQgY2FuIHJlZmVyZW5jZVxuICAvLyBpdCByZWxhdGl2ZWx5IGFzIHRoZSBwYXRoIGlzIHByZXNlcnZlZCBpbnNpZGUgYGJ1bmRsZXMvYC5cbiAgLy8gKk5vdGUqOiBSZWx5aW5nIG9uIHBhY2thZ2UgcmVzb2x1dGlvbiBpcyBwcm9ibGVtYXRpYyB3aXRoaW4gRVNNIGFuZCB3aXRoIGBsb2NhbC1kZXYuc2hgXG4gIGNvbnN0IGJ1bmRsZXNEaXIgPSBkaXJuYW1lKGZpbGVVUkxUb1BhdGgoaW1wb3J0Lm1ldGEudXJsKSk7XG4gIHJldHVybiBqb2luKGJ1bmRsZXNEaXIsICcuL3ByL21lcmdlL3N0cmF0ZWdpZXMvY29tbWl0LW1lc3NhZ2UtZmlsdGVyLm1qcycpO1xufVxuIl19