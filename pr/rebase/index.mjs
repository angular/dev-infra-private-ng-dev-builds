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
            : await Prompt.confirm({
                message: `PR #${prNumber} contains fixup commits, would you like to squash them during rebase?`,
                default: true,
            });
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
    const continueRebase = process.env['CI'] === undefined &&
        (await Prompt.confirm({ message: 'Manually complete rebase?' }));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvcmViYXNlL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVFBLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ2hFLE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLDZDQUE2QyxDQUFDO0FBQ25GLE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JFLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDN0MsT0FBTyxFQUFDLDBCQUEwQixFQUFDLE1BQU0saUNBQWlDLENBQUM7QUFFM0U7Ozs7O0dBS0c7QUFDSCxNQUFNLENBQUMsS0FBSyxVQUFVLFFBQVEsQ0FBQyxRQUFnQjtJQUM3Qyw4REFBOEQ7SUFDOUQsTUFBTSxHQUFHLEdBQUcsTUFBTSxzQkFBc0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUUvQyxJQUFJLEdBQUcsQ0FBQyxxQkFBcUIsRUFBRSxFQUFFLENBQUM7UUFDaEMsR0FBRyxDQUFDLEtBQUssQ0FBQyxpREFBaUQsQ0FBQyxDQUFDO1FBQzdELE9BQU8sQ0FBQyxDQUFDO0lBQ1gsQ0FBQztJQUVEOzs7T0FHRztJQUNILE1BQU0sd0JBQXdCLEdBQUcsR0FBRyxDQUFDLDBCQUEwQixFQUFFLENBQUM7SUFDbEUseUNBQXlDO0lBQ3pDLE1BQU0sRUFBRSxHQUFHLE1BQU0sMEJBQTBCLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBRTNELElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDO1FBQ2hCLEdBQUcsQ0FBQyxLQUFLLENBQUMsd0NBQXdDLENBQUMsQ0FBQztRQUNwRCxPQUFPLENBQUMsQ0FBQztJQUNYLENBQUM7SUFFRCxNQUFNLFdBQVcsR0FBRyxF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QUFpRjtJQUNqRixnQ0FBZ0M7SUFDaEMsTUFBTSxjQUFjLEdBQ2xCLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUztRQUMvQixDQUFDLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFDLE9BQU8sRUFBRSwyQkFBMkIsRUFBQyxDQUFDLENBQUMsQ0FBQztJQUVqRSxJQUFJLGNBQWMsRUFBRSxDQUFDO1FBQ25CLEdBQUcsQ0FBQyxJQUFJLENBQ04sNkVBQTZFLFFBQVEsR0FBRyxDQUN6RixDQUFDO1FBQ0YsR0FBRyxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsU0FBUyxXQUFXLElBQUksa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO1FBQy9GLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNYLEdBQUcsQ0FBQyxJQUFJLENBQUMsbUZBQW1GLENBQUMsQ0FBQztRQUM5RixHQUFHLENBQUMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLENBQUM7UUFDdkMsR0FBRyxDQUFDLElBQUksQ0FDTiw2REFBNkQsd0JBQXdCLEVBQUUsQ0FDeEYsQ0FBQztRQUNGLE9BQU8sQ0FBQyxDQUFDO0lBQ1gsQ0FBQztTQUFNLENBQUM7UUFDTixHQUFHLENBQUMsSUFBSSxDQUFDLHNEQUFzRCxDQUFDLENBQUM7SUFDbkUsQ0FBQztJQUVELEdBQUcsQ0FBQyxRQUFRLENBQUMsd0JBQXdCLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDN0MsT0FBTyxDQUFDLENBQUM7QUFDWCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge0NvbW1pdH0gZnJvbSAnLi4vLi4vY29tbWl0LW1lc3NhZ2UvcGFyc2UuanMnO1xuaW1wb3J0IHtnZXRDb21taXRzSW5SYW5nZX0gZnJvbSAnLi4vLi4vY29tbWl0LW1lc3NhZ2UvdXRpbHMuanMnO1xuaW1wb3J0IHtBdXRoZW50aWNhdGVkR2l0Q2xpZW50fSBmcm9tICcuLi8uLi91dGlscy9naXQvYXV0aGVudGljYXRlZC1naXQtY2xpZW50LmpzJztcbmltcG9ydCB7YWRkVG9rZW5Ub0dpdEh0dHBzVXJsfSBmcm9tICcuLi8uLi91dGlscy9naXQvZ2l0aHViLXVybHMuanMnO1xuaW1wb3J0IHtMb2d9IGZyb20gJy4uLy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuaW1wb3J0IHtQcm9tcHR9IGZyb20gJy4uLy4uL3V0aWxzL3Byb21wdC5qcyc7XG5pbXBvcnQge2ZldGNoUHVsbFJlcXVlc3RGcm9tR2l0aHVifSBmcm9tICcuLi9jb21tb24vZmV0Y2gtcHVsbC1yZXF1ZXN0LmpzJztcblxuLyoqXG4gKiBSZWJhc2UgdGhlIHByb3ZpZGVkIFBSIG9udG8gaXRzIG1lcmdlIHRhcmdldCBicmFuY2gsIGFuZCBwdXNoIHVwIHRoZSByZXN1bHRpbmdcbiAqIGNvbW1pdCB0byB0aGUgUFJzIHJlcG9zaXRvcnkuXG4gKlxuICogQHJldHVybnMgYSBzdGF0dXMgY29kZSBpbmRpY2F0aW5nIHdoZXRoZXIgdGhlIHJlYmFzZSB3YXMgc3VjY2Vzc2Z1bC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYmFzZVByKHByTnVtYmVyOiBudW1iZXIpOiBQcm9taXNlPG51bWJlcj4ge1xuICAvKiogVGhlIHNpbmdsZXRvbiBpbnN0YW5jZSBvZiB0aGUgYXV0aGVudGljYXRlZCBnaXQgY2xpZW50LiAqL1xuICBjb25zdCBnaXQgPSBhd2FpdCBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LmdldCgpO1xuXG4gIGlmIChnaXQuaGFzVW5jb21taXR0ZWRDaGFuZ2VzKCkpIHtcbiAgICBMb2cuZXJyb3IoJ0Nhbm5vdCBwZXJmb3JtIHJlYmFzZSBvZiBQUiB3aXRoIGxvY2FsIGNoYW5nZXMuJyk7XG4gICAgcmV0dXJuIDE7XG4gIH1cblxuICAvKipcbiAgICogVGhlIGJyYW5jaCBvciByZXZpc2lvbiBvcmlnaW5hbGx5IGNoZWNrZWQgb3V0IGJlZm9yZSB0aGlzIG1ldGhvZCBwZXJmb3JtZWRcbiAgICogYW55IEdpdCBvcGVyYXRpb25zIHRoYXQgbWF5IGNoYW5nZSB0aGUgd29ya2luZyBicmFuY2guXG4gICAqL1xuICBjb25zdCBwcmV2aW91c0JyYW5jaE9yUmV2aXNpb24gPSBnaXQuZ2V0Q3VycmVudEJyYW5jaE9yUmV2aXNpb24oKTtcbiAgLyogR2V0IHRoZSBQUiBpbmZvcm1hdGlvbiBmcm9tIEdpdGh1Yi4gKi9cbiAgY29uc3QgcHIgPSBhd2FpdCBmZXRjaFB1bGxSZXF1ZXN0RnJvbUdpdGh1YihnaXQsIHByTnVtYmVyKTtcblxuICBpZiAocHIgPT09IG51bGwpIHtcbiAgICBMb2cuZXJyb3IoYFNwZWNpZmllZCBwdWxsIHJlcXVlc3QgZG9lcyBub3QgZXhpc3QuYCk7XG4gICAgcmV0dXJuIDE7XG4gIH1cblxuICBjb25zdCBoZWFkUmVmTmFtZSA9IHByLmhlYWRSZWYubmFtZTtcbiAgY29uc3QgYmFzZVJlZk5hbWUgPSBwci5iYXNlUmVmLm5hbWU7XG4gIGNvbnN0IGZ1bGxIZWFkUmVmID0gYCR7cHIuaGVhZFJlZi5yZXBvc2l0b3J5Lm5hbWVXaXRoT3duZXJ9OiR7aGVhZFJlZk5hbWV9YDtcbiAgY29uc3QgZnVsbEJhc2VSZWYgPSBgJHtwci5iYXNlUmVmLnJlcG9zaXRvcnkubmFtZVdpdGhPd25lcn06JHtiYXNlUmVmTmFtZX1gO1xuICBjb25zdCBoZWFkUmVmVXJsID0gYWRkVG9rZW5Ub0dpdEh0dHBzVXJsKHByLmhlYWRSZWYucmVwb3NpdG9yeS51cmwsIGdpdC5naXRodWJUb2tlbik7XG4gIGNvbnN0IGJhc2VSZWZVcmwgPSBhZGRUb2tlblRvR2l0SHR0cHNVcmwocHIuYmFzZVJlZi5yZXBvc2l0b3J5LnVybCwgZ2l0LmdpdGh1YlRva2VuKTtcblxuICAvLyBOb3RlOiBTaW5jZSB3ZSB1c2UgYSBkZXRhY2hlZCBoZWFkIGZvciByZWJhc2luZyB0aGUgUFIgYW5kIHRoZXJlZm9yZSBkbyBub3QgaGF2ZVxuICAvLyByZW1vdGUtdHJhY2tpbmcgYnJhbmNoZXMgY29uZmlndXJlZCwgd2UgbmVlZCB0byBzZXQgb3VyIGV4cGVjdGVkIHJlZiBhbmQgU0hBLiBUaGlzXG4gIC8vIGFsbG93cyB1cyB0byB1c2UgYC0tZm9yY2Utd2l0aC1sZWFzZWAgZm9yIHRoZSBkZXRhY2hlZCBoZWFkIHdoaWxlIGVuc3VyaW5nIHRoYXQgd2VcbiAgLy8gbmV2ZXIgYWNjaWRlbnRhbGx5IG92ZXJyaWRlIHVwc3RyZWFtIGNoYW5nZXMgdGhhdCBoYXZlIGJlZW4gcHVzaGVkIGluIHRoZSBtZWFud2hpbGUuXG4gIC8vIFNlZTpcbiAgLy8gaHR0cHM6Ly9naXQtc2NtLmNvbS9kb2NzL2dpdC1wdXNoI0RvY3VtZW50YXRpb24vZ2l0LXB1c2gudHh0LS0tZm9yY2Utd2l0aC1sZWFzZWx0cmVmbmFtZWd0bHRleHBlY3RndFxuICBjb25zdCBmb3JjZVdpdGhMZWFzZUZsYWcgPSBgLS1mb3JjZS13aXRoLWxlYXNlPSR7aGVhZFJlZk5hbWV9OiR7cHIuaGVhZFJlZk9pZH1gO1xuXG4gIC8vIElmIHRoZSBQUiBkb2VzIG5vdCBhbGxvdyBtYWludGFpbmVycyB0byBtb2RpZnkgaXQsIGV4aXQgYXMgdGhlIHJlYmFzZWQgUFIgY2Fubm90XG4gIC8vIGJlIHB1c2hlZCB1cC5cbiAgaWYgKCFwci5tYWludGFpbmVyQ2FuTW9kaWZ5ICYmICFwci52aWV3ZXJEaWRBdXRob3IpIHtcbiAgICBMb2cuZXJyb3IoXG4gICAgICBgQ2Fubm90IHJlYmFzZSBhcyB5b3UgZGlkIG5vdCBhdXRob3IgdGhlIFBSIGFuZCB0aGUgUFIgZG9lcyBub3QgYWxsb3cgbWFpbnRhaW5lcnNgICtcbiAgICAgICAgYHRvIG1vZGlmeSB0aGUgUFJgLFxuICAgICk7XG4gICAgcmV0dXJuIDE7XG4gIH1cblxuICB0cnkge1xuICAgIC8vIEZldGNoZXMgYXJlIGRvbmUgd2l0aCAtLWRlZXBlbj01MDAgaW5jcmVhc2UgdGhlIGxpa2VsaWhvb2Qgb2YgZmluZGluZyBhIGNvbW1vbiBhbmNlc3RvciB3aGVuXG4gICAgLy8gYSBzaGFsbG93IGNsb25lIGlzIGJlaW5nIHVzZWQuXG5cbiAgICAvLyBGZXRjaCB0aGUgYnJhbmNoIGF0IHRoZSBjb21taXQgb2YgdGhlIFBSLCBhbmQgY2hlY2sgaXQgb3V0IGluIGEgZGV0YWNoZWQgc3RhdGUuXG4gICAgTG9nLmluZm8oYENoZWNraW5nIG91dCBQUiAjJHtwck51bWJlcn0gZnJvbSAke2Z1bGxIZWFkUmVmfWApO1xuICAgIGdpdC5ydW4oWydmZXRjaCcsICctcScsIGhlYWRSZWZVcmwsIGhlYWRSZWZOYW1lLCAnLS1kZWVwZW49NTAwJ10pO1xuICAgIGdpdC5ydW4oWydjaGVja291dCcsICctcScsICctLWRldGFjaCcsICdGRVRDSF9IRUFEJ10pO1xuICAgIC8vIEZldGNoIHRoZSBQUnMgdGFyZ2V0IGJyYW5jaCBhbmQgcmViYXNlIG9udG8gaXQuXG4gICAgTG9nLmluZm8oYEZldGNoaW5nICR7ZnVsbEJhc2VSZWZ9IHRvIHJlYmFzZSAjJHtwck51bWJlcn0gb25gKTtcbiAgICBnaXQucnVuKFsnZmV0Y2gnLCAnLXEnLCBiYXNlUmVmVXJsLCBiYXNlUmVmTmFtZSwgJy0tZGVlcGVuPTUwMCddKTtcblxuICAgIGNvbnN0IGNvbW1vbkFuY2VzdG9yU2hhID0gZ2l0LnJ1bihbJ21lcmdlLWJhc2UnLCAnSEVBRCcsICdGRVRDSF9IRUFEJ10pLnN0ZG91dC50cmltKCk7XG5cbiAgICBjb25zdCBjb21taXRzID0gYXdhaXQgZ2V0Q29tbWl0c0luUmFuZ2UoY29tbW9uQW5jZXN0b3JTaGEsICdIRUFEJyk7XG5cbiAgICBsZXQgc3F1YXNoRml4dXBzID1cbiAgICAgIHByb2Nlc3MuZW52WydDSSddICE9PSB1bmRlZmluZWQgfHxcbiAgICAgIGNvbW1pdHMuZmlsdGVyKChjb21taXQ6IENvbW1pdCkgPT4gY29tbWl0LmlzRml4dXApLmxlbmd0aCA9PT0gMFxuICAgICAgICA/IGZhbHNlXG4gICAgICAgIDogYXdhaXQgUHJvbXB0LmNvbmZpcm0oe1xuICAgICAgICAgICAgbWVzc2FnZTogYFBSICMke3ByTnVtYmVyfSBjb250YWlucyBmaXh1cCBjb21taXRzLCB3b3VsZCB5b3UgbGlrZSB0byBzcXVhc2ggdGhlbSBkdXJpbmcgcmViYXNlP2AsXG4gICAgICAgICAgICBkZWZhdWx0OiB0cnVlLFxuICAgICAgICAgIH0pO1xuXG4gICAgTG9nLmluZm8oYEF0dGVtcHRpbmcgdG8gcmViYXNlIFBSICMke3ByTnVtYmVyfSBvbiAke2Z1bGxCYXNlUmVmfWApO1xuXG4gICAgLyoqXG4gICAgICogVHVwbGUgb2YgZmxhZ3MgdG8gYmUgYWRkZWQgdG8gdGhlIHJlYmFzZSBjb21tYW5kIGFuZCBlbnYgb2JqZWN0IHRvIHJ1biB0aGUgZ2l0IGNvbW1hbmQuXG4gICAgICpcbiAgICAgKiBBZGRpdGlvbmFsIGZsYWdzIHRvIHBlcmZvcm0gdGhlIGF1dG9zcXVhc2hpbmcgYXJlIGFkZGVkIHdoZW4gdGhlIHVzZXIgY29uZmlybSBzcXVhc2hpbmcgb2ZcbiAgICAgKiBmaXh1cCBjb21taXRzIHNob3VsZCBvY2N1ci5cbiAgICAgKi9cbiAgICBjb25zdCBbZmxhZ3MsIGVudl0gPSBzcXVhc2hGaXh1cHNcbiAgICAgID8gW1snLS1pbnRlcmFjdGl2ZScsICctLWF1dG9zcXVhc2gnXSwgey4uLnByb2Nlc3MuZW52LCBHSVRfU0VRVUVOQ0VfRURJVE9SOiAndHJ1ZSd9XVxuICAgICAgOiBbW10sIHVuZGVmaW5lZF07XG4gICAgY29uc3QgcmViYXNlUmVzdWx0ID0gZ2l0LnJ1bkdyYWNlZnVsKFsncmViYXNlJywgLi4uZmxhZ3MsICdGRVRDSF9IRUFEJ10sIHtlbnY6IGVudn0pO1xuXG4gICAgLy8gSWYgdGhlIHJlYmFzZSB3YXMgY2xlYW4sIHB1c2ggdGhlIHJlYmFzZWQgUFIgdXAgdG8gdGhlIGF1dGhvcnMgZm9yay5cbiAgICBpZiAocmViYXNlUmVzdWx0LnN0YXR1cyA9PT0gMCkge1xuICAgICAgTG9nLmluZm8oYFJlYmFzZSB3YXMgYWJsZSB0byBjb21wbGV0ZSBhdXRvbWF0aWNhbGx5IHdpdGhvdXQgY29uZmxpY3RzYCk7XG4gICAgICBMb2cuaW5mbyhgUHVzaGluZyByZWJhc2VkIFBSICMke3ByTnVtYmVyfSB0byAke2Z1bGxIZWFkUmVmfWApO1xuICAgICAgZ2l0LnJ1bihbJ3B1c2gnLCBoZWFkUmVmVXJsLCBgSEVBRDoke2hlYWRSZWZOYW1lfWAsIGZvcmNlV2l0aExlYXNlRmxhZ10pO1xuICAgICAgTG9nLmluZm8oYFJlYmFzZWQgYW5kIHVwZGF0ZWQgUFIgIyR7cHJOdW1iZXJ9YCk7XG4gICAgICBnaXQuY2hlY2tvdXQocHJldmlvdXNCcmFuY2hPclJldmlzaW9uLCB0cnVlKTtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgTG9nLmVycm9yKGVycik7XG4gICAgZ2l0LmNoZWNrb3V0KHByZXZpb3VzQnJhbmNoT3JSZXZpc2lvbiwgdHJ1ZSk7XG4gICAgcmV0dXJuIDE7XG4gIH1cblxuICAvLyBPbiBhdXRvbWF0aWMgcmViYXNlIGZhaWx1cmVzLCBwcm9tcHQgdG8gY2hvb3NlIGlmIHRoZSByZWJhc2Ugc2hvdWxkIGJlIGNvbnRpbnVlZFxuICAvLyBtYW51YWxseSBvciBhYm9ydGVkIG5vdy5cbiAgTG9nLmluZm8oYFJlYmFzZSB3YXMgdW5hYmxlIHRvIGNvbXBsZXRlIGF1dG9tYXRpY2FsbHkgd2l0aG91dCBjb25mbGljdHMuYCk7XG4gIC8vIElmIHRoZSBjb21tYW5kIGlzIHJ1biBpbiBhIG5vbi1DSSBlbnZpcm9ubWVudCwgcHJvbXB0IHRvIGFsbG93IGZvciB0aGUgdXNlciB0b1xuICAvLyBtYW51YWxseSBjb21wbGV0ZSB0aGUgcmViYXNlLlxuICBjb25zdCBjb250aW51ZVJlYmFzZSA9XG4gICAgcHJvY2Vzcy5lbnZbJ0NJJ10gPT09IHVuZGVmaW5lZCAmJlxuICAgIChhd2FpdCBQcm9tcHQuY29uZmlybSh7bWVzc2FnZTogJ01hbnVhbGx5IGNvbXBsZXRlIHJlYmFzZT8nfSkpO1xuXG4gIGlmIChjb250aW51ZVJlYmFzZSkge1xuICAgIExvZy5pbmZvKFxuICAgICAgYEFmdGVyIG1hbnVhbGx5IGNvbXBsZXRpbmcgcmViYXNlLCBydW4gdGhlIGZvbGxvd2luZyBjb21tYW5kIHRvIHVwZGF0ZSBQUiAjJHtwck51bWJlcn06YCxcbiAgICApO1xuICAgIExvZy5pbmZvKGAgJCBnaXQgcHVzaCAke3ByLmhlYWRSZWYucmVwb3NpdG9yeS51cmx9IEhFQUQ6JHtoZWFkUmVmTmFtZX0gJHtmb3JjZVdpdGhMZWFzZUZsYWd9YCk7XG4gICAgTG9nLmluZm8oKTtcbiAgICBMb2cuaW5mbyhgVG8gYWJvcnQgdGhlIHJlYmFzZSBhbmQgcmV0dXJuIHRvIHRoZSBzdGF0ZSBvZiB0aGUgcmVwb3NpdG9yeSBiZWZvcmUgdGhpcyBjb21tYW5kYCk7XG4gICAgTG9nLmluZm8oYHJ1biB0aGUgZm9sbG93aW5nIGNvbW1hbmQ6YCk7XG4gICAgTG9nLmluZm8oXG4gICAgICBgICQgZ2l0IHJlYmFzZSAtLWFib3J0ICYmIGdpdCByZXNldCAtLWhhcmQgJiYgZ2l0IGNoZWNrb3V0ICR7cHJldmlvdXNCcmFuY2hPclJldmlzaW9ufWAsXG4gICAgKTtcbiAgICByZXR1cm4gMTtcbiAgfSBlbHNlIHtcbiAgICBMb2cuaW5mbyhgQ2xlYW5pbmcgdXAgZ2l0IHN0YXRlLCBhbmQgcmVzdG9yaW5nIHByZXZpb3VzIHN0YXRlLmApO1xuICB9XG5cbiAgZ2l0LmNoZWNrb3V0KHByZXZpb3VzQnJhbmNoT3JSZXZpc2lvbiwgdHJ1ZSk7XG4gIHJldHVybiAxO1xufVxuIl19