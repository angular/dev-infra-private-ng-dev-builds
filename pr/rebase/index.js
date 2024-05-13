import { getCommitsInRange } from '../../commit-message/utils.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { addTokenToGitHttpsUrl } from '../../utils/git/github-urls.js';
import { Log } from '../../utils/logging.js';
import { Prompt } from '../../utils/prompt.js';
import { fetchPullRequestFromGithub } from '../common/fetch-pull-request.js';
/**
 * Rebase the provided PR onto its merge target branch, and push up the resulting
 * commit to the PRs repository.
 *
 * @returns a status code indicating whether the rebase was successful.
 */
export async function rebasePr(prNumber) {
    /** The singleton instance of the authenticated git client. */
    const git = await AuthenticatedGitClient.get();
    if (git.hasUncommittedChanges()) {
        Log.error('Cannot perform rebase of PR with local changes.');
        return 1;
    }
    /**
     * The branch or revision originally checked out before this method performed
     * any Git operations that may change the working branch.
     */
    const previousBranchOrRevision = git.getCurrentBranchOrRevision();
    /* Get the PR information from Github. */
    const pr = await fetchPullRequestFromGithub(git, prNumber);
    if (pr === null) {
        Log.error(`Specified pull request does not exist.`);
        return 1;
    }
    const headRefName = pr.headRef.name;
    const baseRefName = pr.baseRef.name;
    const fullHeadRef = `${pr.headRef.repository.nameWithOwner}:${headRefName}`;
    const fullBaseRef = `${pr.baseRef.repository.nameWithOwner}:${baseRefName}`;
    const headRefUrl = addTokenToGitHttpsUrl(pr.headRef.repository.url, git.githubToken);
    const baseRefUrl = addTokenToGitHttpsUrl(pr.baseRef.repository.url, git.githubToken);
    // Note: Since we use a detached head for rebasing the PR and therefore do not have
    // remote-tracking branches configured, we need to set our expected ref and SHA. This
    // allows us to use `--force-with-lease` for the detached head while ensuring that we
    // never accidentally override upstream changes that have been pushed in the meanwhile.
    // See:
    // https://git-scm.com/docs/git-push#Documentation/git-push.txt---force-with-leaseltrefnamegtltexpectgt
    const forceWithLeaseFlag = `--force-with-lease=${headRefName}:${pr.headRefOid}`;
    // If the PR does not allow maintainers to modify it, exit as the rebased PR cannot
    // be pushed up.
    if (!pr.maintainerCanModify && !pr.viewerDidAuthor) {
        Log.error(`Cannot rebase as you did not author the PR and the PR does not allow maintainers` +
            `to modify the PR`);
        return 1;
    }
    try {
        // Fetches are done with --deepen=500 increase the likelihood of finding a common ancestor when
        // a shallow clone is being used.
        // Fetch the branch at the commit of the PR, and check it out in a detached state.
        Log.info(`Checking out PR #${prNumber} from ${fullHeadRef}`);
        git.run(['fetch', '-q', headRefUrl, headRefName, '--deepen=500']);
        git.run(['checkout', '-q', '--detach', 'FETCH_HEAD']);
        // Fetch the PRs target branch and rebase onto it.
        Log.info(`Fetching ${fullBaseRef} to rebase #${prNumber} on`);
        git.run(['fetch', '-q', baseRefUrl, baseRefName, '--deepen=500']);
        const commonAncestorSha = git.run(['merge-base', 'HEAD', 'FETCH_HEAD']).stdout.trim();
        const commits = await getCommitsInRange(commonAncestorSha, 'HEAD');
        let squashFixups = process.env['CI'] !== undefined ||
            commits.filter((commit) => commit.isFixup).length === 0
            ? false
            : await Prompt.confirm(`PR #${prNumber} contains fixup commits, would you like to squash them during rebase?`, true);
        Log.info(`Attempting to rebase PR #${prNumber} on ${fullBaseRef}`);
        /**
         * Tuple of flags to be added to the rebase command and env object to run the git command.
         *
         * Additional flags to perform the autosquashing are added when the user confirm squashing of
         * fixup commits should occur.
         */
        const [flags, env] = squashFixups
            ? [['--interactive', '--autosquash'], { ...process.env, GIT_SEQUENCE_EDITOR: 'true' }]
            : [[], undefined];
        const rebaseResult = git.runGraceful(['rebase', ...flags, 'FETCH_HEAD'], { env: env });
        // If the rebase was clean, push the rebased PR up to the authors fork.
        if (rebaseResult.status === 0) {
            Log.info(`Rebase was able to complete automatically without conflicts`);
            Log.info(`Pushing rebased PR #${prNumber} to ${fullHeadRef}`);
            git.run(['push', headRefUrl, `HEAD:${headRefName}`, forceWithLeaseFlag]);
            Log.info(`Rebased and updated PR #${prNumber}`);
            git.checkout(previousBranchOrRevision, true);
            return 0;
        }
    }
    catch (err) {
        Log.error(err);
        git.checkout(previousBranchOrRevision, true);
        return 1;
    }
    // On automatic rebase failures, prompt to choose if the rebase should be continued
    // manually or aborted now.
    Log.info(`Rebase was unable to complete automatically without conflicts.`);
    // If the command is run in a non-CI environment, prompt to allow for the user to
    // manually complete the rebase.
    const continueRebase = process.env['CI'] === undefined && (await Prompt.confirm('Manually complete rebase?'));
    if (continueRebase) {
        Log.info(`After manually completing rebase, run the following command to update PR #${prNumber}:`);
        Log.info(` $ git push ${pr.headRef.repository.url} HEAD:${headRefName} ${forceWithLeaseFlag}`);
        Log.info();
        Log.info(`To abort the rebase and return to the state of the repository before this command`);
        Log.info(`run the following command:`);
        Log.info(` $ git rebase --abort && git reset --hard && git checkout ${previousBranchOrRevision}`);
        return 1;
    }
    else {
        Log.info(`Cleaning up git state, and restoring previous state.`);
    }
    git.checkout(previousBranchOrRevision, true);
    return 1;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvcmViYXNlL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVFBLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ2hFLE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLDZDQUE2QyxDQUFDO0FBQ25GLE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JFLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDN0MsT0FBTyxFQUFDLDBCQUEwQixFQUFDLE1BQU0saUNBQWlDLENBQUM7QUFFM0U7Ozs7O0dBS0c7QUFDSCxNQUFNLENBQUMsS0FBSyxVQUFVLFFBQVEsQ0FBQyxRQUFnQjtJQUM3Qyw4REFBOEQ7SUFDOUQsTUFBTSxHQUFHLEdBQUcsTUFBTSxzQkFBc0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUUvQyxJQUFJLEdBQUcsQ0FBQyxxQkFBcUIsRUFBRSxFQUFFLENBQUM7UUFDaEMsR0FBRyxDQUFDLEtBQUssQ0FBQyxpREFBaUQsQ0FBQyxDQUFDO1FBQzdELE9BQU8sQ0FBQyxDQUFDO0lBQ1gsQ0FBQztJQUVEOzs7T0FHRztJQUNILE1BQU0sd0JBQXdCLEdBQUcsR0FBRyxDQUFDLDBCQUEwQixFQUFFLENBQUM7SUFDbEUseUNBQXlDO0lBQ3pDLE1BQU0sRUFBRSxHQUFHLE1BQU0sMEJBQTBCLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBRTNELElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDO1FBQ2hCLEdBQUcsQ0FBQyxLQUFLLENBQUMsd0NBQXdDLENBQUMsQ0FBQztRQUNwRCxPQUFPLENBQUMsQ0FBQztJQUNYLENBQUM7SUFFRCxNQUFNLFdBQVcsR0FBRyxF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YyxHQUNsQixPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsSUFBSSxDQUFDLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQywyQkFBMkIsQ0FBQyxDQUFDLENBQUM7SUFFekYsSUFBSSxjQUFjLEVBQUUsQ0FBQztRQUNuQixHQUFHLENBQUMsSUFBSSxDQUNOLDZFQUE2RSxRQUFRLEdBQUcsQ0FDekYsQ0FBQztRQUNGLEdBQUcsQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLFNBQVMsV0FBVyxJQUFJLGtCQUFrQixFQUFFLENBQUMsQ0FBQztRQUMvRixHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDWCxHQUFHLENBQUMsSUFBSSxDQUFDLG1GQUFtRixDQUFDLENBQUM7UUFDOUYsR0FBRyxDQUFDLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO1FBQ3ZDLEdBQUcsQ0FBQyxJQUFJLENBQ04sNkRBQTZELHdCQUF3QixFQUFFLENBQ3hGLENBQUM7UUFDRixPQUFPLENBQUMsQ0FBQztJQUNYLENBQUM7U0FBTSxDQUFDO1FBQ04sR0FBRyxDQUFDLElBQUksQ0FBQyxzREFBc0QsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFFRCxHQUFHLENBQUMsUUFBUSxDQUFDLHdCQUF3QixFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzdDLE9BQU8sQ0FBQyxDQUFDO0FBQ1gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtDb21taXR9IGZyb20gJy4uLy4uL2NvbW1pdC1tZXNzYWdlL3BhcnNlLmpzJztcbmltcG9ydCB7Z2V0Q29tbWl0c0luUmFuZ2V9IGZyb20gJy4uLy4uL2NvbW1pdC1tZXNzYWdlL3V0aWxzLmpzJztcbmltcG9ydCB7QXV0aGVudGljYXRlZEdpdENsaWVudH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2F1dGhlbnRpY2F0ZWQtZ2l0LWNsaWVudC5qcyc7XG5pbXBvcnQge2FkZFRva2VuVG9HaXRIdHRwc1VybH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi11cmxzLmpzJztcbmltcG9ydCB7TG9nfSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7UHJvbXB0fSBmcm9tICcuLi8uLi91dGlscy9wcm9tcHQuanMnO1xuaW1wb3J0IHtmZXRjaFB1bGxSZXF1ZXN0RnJvbUdpdGh1Yn0gZnJvbSAnLi4vY29tbW9uL2ZldGNoLXB1bGwtcmVxdWVzdC5qcyc7XG5cbi8qKlxuICogUmViYXNlIHRoZSBwcm92aWRlZCBQUiBvbnRvIGl0cyBtZXJnZSB0YXJnZXQgYnJhbmNoLCBhbmQgcHVzaCB1cCB0aGUgcmVzdWx0aW5nXG4gKiBjb21taXQgdG8gdGhlIFBScyByZXBvc2l0b3J5LlxuICpcbiAqIEByZXR1cm5zIGEgc3RhdHVzIGNvZGUgaW5kaWNhdGluZyB3aGV0aGVyIHRoZSByZWJhc2Ugd2FzIHN1Y2Nlc3NmdWwuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWJhc2VQcihwck51bWJlcjogbnVtYmVyKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgLyoqIFRoZSBzaW5nbGV0b24gaW5zdGFuY2Ugb2YgdGhlIGF1dGhlbnRpY2F0ZWQgZ2l0IGNsaWVudC4gKi9cbiAgY29uc3QgZ2l0ID0gYXdhaXQgQXV0aGVudGljYXRlZEdpdENsaWVudC5nZXQoKTtcblxuICBpZiAoZ2l0Lmhhc1VuY29tbWl0dGVkQ2hhbmdlcygpKSB7XG4gICAgTG9nLmVycm9yKCdDYW5ub3QgcGVyZm9ybSByZWJhc2Ugb2YgUFIgd2l0aCBsb2NhbCBjaGFuZ2VzLicpO1xuICAgIHJldHVybiAxO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBicmFuY2ggb3IgcmV2aXNpb24gb3JpZ2luYWxseSBjaGVja2VkIG91dCBiZWZvcmUgdGhpcyBtZXRob2QgcGVyZm9ybWVkXG4gICAqIGFueSBHaXQgb3BlcmF0aW9ucyB0aGF0IG1heSBjaGFuZ2UgdGhlIHdvcmtpbmcgYnJhbmNoLlxuICAgKi9cbiAgY29uc3QgcHJldmlvdXNCcmFuY2hPclJldmlzaW9uID0gZ2l0LmdldEN1cnJlbnRCcmFuY2hPclJldmlzaW9uKCk7XG4gIC8qIEdldCB0aGUgUFIgaW5mb3JtYXRpb24gZnJvbSBHaXRodWIuICovXG4gIGNvbnN0IHByID0gYXdhaXQgZmV0Y2hQdWxsUmVxdWVzdEZyb21HaXRodWIoZ2l0LCBwck51bWJlcik7XG5cbiAgaWYgKHByID09PSBudWxsKSB7XG4gICAgTG9nLmVycm9yKGBTcGVjaWZpZWQgcHVsbCByZXF1ZXN0IGRvZXMgbm90IGV4aXN0LmApO1xuICAgIHJldHVybiAxO1xuICB9XG5cbiAgY29uc3QgaGVhZFJlZk5hbWUgPSBwci5oZWFkUmVmLm5hbWU7XG4gIGNvbnN0IGJhc2VSZWZOYW1lID0gcHIuYmFzZVJlZi5uYW1lO1xuICBjb25zdCBmdWxsSGVhZFJlZiA9IGAke3ByLmhlYWRSZWYucmVwb3NpdG9yeS5uYW1lV2l0aE93bmVyfToke2hlYWRSZWZOYW1lfWA7XG4gIGNvbnN0IGZ1bGxCYXNlUmVmID0gYCR7cHIuYmFzZVJlZi5yZXBvc2l0b3J5Lm5hbWVXaXRoT3duZXJ9OiR7YmFzZVJlZk5hbWV9YDtcbiAgY29uc3QgaGVhZFJlZlVybCA9IGFkZFRva2VuVG9HaXRIdHRwc1VybChwci5oZWFkUmVmLnJlcG9zaXRvcnkudXJsLCBnaXQuZ2l0aHViVG9rZW4pO1xuICBjb25zdCBiYXNlUmVmVXJsID0gYWRkVG9rZW5Ub0dpdEh0dHBzVXJsKHByLmJhc2VSZWYucmVwb3NpdG9yeS51cmwsIGdpdC5naXRodWJUb2tlbik7XG5cbiAgLy8gTm90ZTogU2luY2Ugd2UgdXNlIGEgZGV0YWNoZWQgaGVhZCBmb3IgcmViYXNpbmcgdGhlIFBSIGFuZCB0aGVyZWZvcmUgZG8gbm90IGhhdmVcbiAgLy8gcmVtb3RlLXRyYWNraW5nIGJyYW5jaGVzIGNvbmZpZ3VyZWQsIHdlIG5lZWQgdG8gc2V0IG91ciBleHBlY3RlZCByZWYgYW5kIFNIQS4gVGhpc1xuICAvLyBhbGxvd3MgdXMgdG8gdXNlIGAtLWZvcmNlLXdpdGgtbGVhc2VgIGZvciB0aGUgZGV0YWNoZWQgaGVhZCB3aGlsZSBlbnN1cmluZyB0aGF0IHdlXG4gIC8vIG5ldmVyIGFjY2lkZW50YWxseSBvdmVycmlkZSB1cHN0cmVhbSBjaGFuZ2VzIHRoYXQgaGF2ZSBiZWVuIHB1c2hlZCBpbiB0aGUgbWVhbndoaWxlLlxuICAvLyBTZWU6XG4gIC8vIGh0dHBzOi8vZ2l0LXNjbS5jb20vZG9jcy9naXQtcHVzaCNEb2N1bWVudGF0aW9uL2dpdC1wdXNoLnR4dC0tLWZvcmNlLXdpdGgtbGVhc2VsdHJlZm5hbWVndGx0ZXhwZWN0Z3RcbiAgY29uc3QgZm9yY2VXaXRoTGVhc2VGbGFnID0gYC0tZm9yY2Utd2l0aC1sZWFzZT0ke2hlYWRSZWZOYW1lfToke3ByLmhlYWRSZWZPaWR9YDtcblxuICAvLyBJZiB0aGUgUFIgZG9lcyBub3QgYWxsb3cgbWFpbnRhaW5lcnMgdG8gbW9kaWZ5IGl0LCBleGl0IGFzIHRoZSByZWJhc2VkIFBSIGNhbm5vdFxuICAvLyBiZSBwdXNoZWQgdXAuXG4gIGlmICghcHIubWFpbnRhaW5lckNhbk1vZGlmeSAmJiAhcHIudmlld2VyRGlkQXV0aG9yKSB7XG4gICAgTG9nLmVycm9yKFxuICAgICAgYENhbm5vdCByZWJhc2UgYXMgeW91IGRpZCBub3QgYXV0aG9yIHRoZSBQUiBhbmQgdGhlIFBSIGRvZXMgbm90IGFsbG93IG1haW50YWluZXJzYCArXG4gICAgICAgIGB0byBtb2RpZnkgdGhlIFBSYCxcbiAgICApO1xuICAgIHJldHVybiAxO1xuICB9XG5cbiAgdHJ5IHtcbiAgICAvLyBGZXRjaGVzIGFyZSBkb25lIHdpdGggLS1kZWVwZW49NTAwIGluY3JlYXNlIHRoZSBsaWtlbGlob29kIG9mIGZpbmRpbmcgYSBjb21tb24gYW5jZXN0b3Igd2hlblxuICAgIC8vIGEgc2hhbGxvdyBjbG9uZSBpcyBiZWluZyB1c2VkLlxuXG4gICAgLy8gRmV0Y2ggdGhlIGJyYW5jaCBhdCB0aGUgY29tbWl0IG9mIHRoZSBQUiwgYW5kIGNoZWNrIGl0IG91dCBpbiBhIGRldGFjaGVkIHN0YXRlLlxuICAgIExvZy5pbmZvKGBDaGVja2luZyBvdXQgUFIgIyR7cHJOdW1iZXJ9IGZyb20gJHtmdWxsSGVhZFJlZn1gKTtcbiAgICBnaXQucnVuKFsnZmV0Y2gnLCAnLXEnLCBoZWFkUmVmVXJsLCBoZWFkUmVmTmFtZSwgJy0tZGVlcGVuPTUwMCddKTtcbiAgICBnaXQucnVuKFsnY2hlY2tvdXQnLCAnLXEnLCAnLS1kZXRhY2gnLCAnRkVUQ0hfSEVBRCddKTtcbiAgICAvLyBGZXRjaCB0aGUgUFJzIHRhcmdldCBicmFuY2ggYW5kIHJlYmFzZSBvbnRvIGl0LlxuICAgIExvZy5pbmZvKGBGZXRjaGluZyAke2Z1bGxCYXNlUmVmfSB0byByZWJhc2UgIyR7cHJOdW1iZXJ9IG9uYCk7XG4gICAgZ2l0LnJ1bihbJ2ZldGNoJywgJy1xJywgYmFzZVJlZlVybCwgYmFzZVJlZk5hbWUsICctLWRlZXBlbj01MDAnXSk7XG5cbiAgICBjb25zdCBjb21tb25BbmNlc3RvclNoYSA9IGdpdC5ydW4oWydtZXJnZS1iYXNlJywgJ0hFQUQnLCAnRkVUQ0hfSEVBRCddKS5zdGRvdXQudHJpbSgpO1xuXG4gICAgY29uc3QgY29tbWl0cyA9IGF3YWl0IGdldENvbW1pdHNJblJhbmdlKGNvbW1vbkFuY2VzdG9yU2hhLCAnSEVBRCcpO1xuXG4gICAgbGV0IHNxdWFzaEZpeHVwcyA9XG4gICAgICBwcm9jZXNzLmVudlsnQ0knXSAhPT0gdW5kZWZpbmVkIHx8XG4gICAgICBjb21taXRzLmZpbHRlcigoY29tbWl0OiBDb21taXQpID0+IGNvbW1pdC5pc0ZpeHVwKS5sZW5ndGggPT09IDBcbiAgICAgICAgPyBmYWxzZVxuICAgICAgICA6IGF3YWl0IFByb21wdC5jb25maXJtKFxuICAgICAgICAgICAgYFBSICMke3ByTnVtYmVyfSBjb250YWlucyBmaXh1cCBjb21taXRzLCB3b3VsZCB5b3UgbGlrZSB0byBzcXVhc2ggdGhlbSBkdXJpbmcgcmViYXNlP2AsXG4gICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICk7XG5cbiAgICBMb2cuaW5mbyhgQXR0ZW1wdGluZyB0byByZWJhc2UgUFIgIyR7cHJOdW1iZXJ9IG9uICR7ZnVsbEJhc2VSZWZ9YCk7XG5cbiAgICAvKipcbiAgICAgKiBUdXBsZSBvZiBmbGFncyB0byBiZSBhZGRlZCB0byB0aGUgcmViYXNlIGNvbW1hbmQgYW5kIGVudiBvYmplY3QgdG8gcnVuIHRoZSBnaXQgY29tbWFuZC5cbiAgICAgKlxuICAgICAqIEFkZGl0aW9uYWwgZmxhZ3MgdG8gcGVyZm9ybSB0aGUgYXV0b3NxdWFzaGluZyBhcmUgYWRkZWQgd2hlbiB0aGUgdXNlciBjb25maXJtIHNxdWFzaGluZyBvZlxuICAgICAqIGZpeHVwIGNvbW1pdHMgc2hvdWxkIG9jY3VyLlxuICAgICAqL1xuICAgIGNvbnN0IFtmbGFncywgZW52XSA9IHNxdWFzaEZpeHVwc1xuICAgICAgPyBbWyctLWludGVyYWN0aXZlJywgJy0tYXV0b3NxdWFzaCddLCB7Li4ucHJvY2Vzcy5lbnYsIEdJVF9TRVFVRU5DRV9FRElUT1I6ICd0cnVlJ31dXG4gICAgICA6IFtbXSwgdW5kZWZpbmVkXTtcbiAgICBjb25zdCByZWJhc2VSZXN1bHQgPSBnaXQucnVuR3JhY2VmdWwoWydyZWJhc2UnLCAuLi5mbGFncywgJ0ZFVENIX0hFQUQnXSwge2VudjogZW52fSk7XG5cbiAgICAvLyBJZiB0aGUgcmViYXNlIHdhcyBjbGVhbiwgcHVzaCB0aGUgcmViYXNlZCBQUiB1cCB0byB0aGUgYXV0aG9ycyBmb3JrLlxuICAgIGlmIChyZWJhc2VSZXN1bHQuc3RhdHVzID09PSAwKSB7XG4gICAgICBMb2cuaW5mbyhgUmViYXNlIHdhcyBhYmxlIHRvIGNvbXBsZXRlIGF1dG9tYXRpY2FsbHkgd2l0aG91dCBjb25mbGljdHNgKTtcbiAgICAgIExvZy5pbmZvKGBQdXNoaW5nIHJlYmFzZWQgUFIgIyR7cHJOdW1iZXJ9IHRvICR7ZnVsbEhlYWRSZWZ9YCk7XG4gICAgICBnaXQucnVuKFsncHVzaCcsIGhlYWRSZWZVcmwsIGBIRUFEOiR7aGVhZFJlZk5hbWV9YCwgZm9yY2VXaXRoTGVhc2VGbGFnXSk7XG4gICAgICBMb2cuaW5mbyhgUmViYXNlZCBhbmQgdXBkYXRlZCBQUiAjJHtwck51bWJlcn1gKTtcbiAgICAgIGdpdC5jaGVja291dChwcmV2aW91c0JyYW5jaE9yUmV2aXNpb24sIHRydWUpO1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBMb2cuZXJyb3IoZXJyKTtcbiAgICBnaXQuY2hlY2tvdXQocHJldmlvdXNCcmFuY2hPclJldmlzaW9uLCB0cnVlKTtcbiAgICByZXR1cm4gMTtcbiAgfVxuXG4gIC8vIE9uIGF1dG9tYXRpYyByZWJhc2UgZmFpbHVyZXMsIHByb21wdCB0byBjaG9vc2UgaWYgdGhlIHJlYmFzZSBzaG91bGQgYmUgY29udGludWVkXG4gIC8vIG1hbnVhbGx5IG9yIGFib3J0ZWQgbm93LlxuICBMb2cuaW5mbyhgUmViYXNlIHdhcyB1bmFibGUgdG8gY29tcGxldGUgYXV0b21hdGljYWxseSB3aXRob3V0IGNvbmZsaWN0cy5gKTtcbiAgLy8gSWYgdGhlIGNvbW1hbmQgaXMgcnVuIGluIGEgbm9uLUNJIGVudmlyb25tZW50LCBwcm9tcHQgdG8gYWxsb3cgZm9yIHRoZSB1c2VyIHRvXG4gIC8vIG1hbnVhbGx5IGNvbXBsZXRlIHRoZSByZWJhc2UuXG4gIGNvbnN0IGNvbnRpbnVlUmViYXNlID1cbiAgICBwcm9jZXNzLmVudlsnQ0knXSA9PT0gdW5kZWZpbmVkICYmIChhd2FpdCBQcm9tcHQuY29uZmlybSgnTWFudWFsbHkgY29tcGxldGUgcmViYXNlPycpKTtcblxuICBpZiAoY29udGludWVSZWJhc2UpIHtcbiAgICBMb2cuaW5mbyhcbiAgICAgIGBBZnRlciBtYW51YWxseSBjb21wbGV0aW5nIHJlYmFzZSwgcnVuIHRoZSBmb2xsb3dpbmcgY29tbWFuZCB0byB1cGRhdGUgUFIgIyR7cHJOdW1iZXJ9OmAsXG4gICAgKTtcbiAgICBMb2cuaW5mbyhgICQgZ2l0IHB1c2ggJHtwci5oZWFkUmVmLnJlcG9zaXRvcnkudXJsfSBIRUFEOiR7aGVhZFJlZk5hbWV9ICR7Zm9yY2VXaXRoTGVhc2VGbGFnfWApO1xuICAgIExvZy5pbmZvKCk7XG4gICAgTG9nLmluZm8oYFRvIGFib3J0IHRoZSByZWJhc2UgYW5kIHJldHVybiB0byB0aGUgc3RhdGUgb2YgdGhlIHJlcG9zaXRvcnkgYmVmb3JlIHRoaXMgY29tbWFuZGApO1xuICAgIExvZy5pbmZvKGBydW4gdGhlIGZvbGxvd2luZyBjb21tYW5kOmApO1xuICAgIExvZy5pbmZvKFxuICAgICAgYCAkIGdpdCByZWJhc2UgLS1hYm9ydCAmJiBnaXQgcmVzZXQgLS1oYXJkICYmIGdpdCBjaGVja291dCAke3ByZXZpb3VzQnJhbmNoT3JSZXZpc2lvbn1gLFxuICAgICk7XG4gICAgcmV0dXJuIDE7XG4gIH0gZWxzZSB7XG4gICAgTG9nLmluZm8oYENsZWFuaW5nIHVwIGdpdCBzdGF0ZSwgYW5kIHJlc3RvcmluZyBwcmV2aW91cyBzdGF0ZS5gKTtcbiAgfVxuXG4gIGdpdC5jaGVja291dChwcmV2aW91c0JyYW5jaE9yUmV2aXNpb24sIHRydWUpO1xuICByZXR1cm4gMTtcbn1cbiJdfQ==