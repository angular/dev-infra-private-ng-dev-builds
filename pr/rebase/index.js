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
export async function rebasePr(prNumber, interactive = false) {
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
        // the env variable prevents the editor from showing in the case of fixup commits and not
        // interactively rebasing
        const env = squashFixups && !interactive ? { ...process.env, GIT_SEQUENCE_EDITOR: 'true' } : undefined;
        let flags = [];
        if (squashFixups || interactive) {
            flags.push('--interactive');
        }
        if (squashFixups) {
            flags.push('--autosquash');
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvcmViYXNlL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVFBLE9BQU8sRUFBQyxpQkFBaUIsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ2hFLE9BQU8sRUFBQyxzQkFBc0IsRUFBQyxNQUFNLDZDQUE2QyxDQUFDO0FBQ25GLE9BQU8sRUFBQyxxQkFBcUIsRUFBQyxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JFLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDN0MsT0FBTyxFQUFDLDBCQUEwQixFQUFDLE1BQU0saUNBQWlDLENBQUM7QUFFM0U7Ozs7O0dBS0c7QUFDSCxNQUFNLENBQUMsS0FBSyxVQUFVLFFBQVEsQ0FBQyxRQUFnQixFQUFFLGNBQXVCLEtBQUs7SUFDM0UsOERBQThEO0lBQzlELE1BQU0sR0FBRyxHQUFHLE1BQU0sc0JBQXNCLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFL0MsSUFBSSxHQUFHLENBQUMscUJBQXFCLEVBQUUsRUFBRSxDQUFDO1FBQ2hDLEdBQUcsQ0FBQyxLQUFLLENBQUMsaURBQWlELENBQUMsQ0FBQztRQUM3RCxPQUFPLENBQUMsQ0FBQztJQUNYLENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLHdCQUF3QixHQUFHLEdBQUcsQ0FBQywwQkFBMEIsRUFBRSxDQUFDO0lBQ2xFLHlDQUF5QztJQUN6QyxNQUFNLEVBQUUsR0FBRyxNQUFNLDBCQUEwQixDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUUzRCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUNoQixHQUFHLENBQUMsS0FBSyxDQUFDLHdDQUF3QyxDQUFDLENBQUM7UUFDcEQsT0FBTyxDQUFDLENBQUM7SUFDWCxDQUFDO0lBRUQs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b3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7Q29tbWl0fSBmcm9tICcuLi8uLi9jb21taXQtbWVzc2FnZS9wYXJzZS5qcyc7XG5pbXBvcnQge2dldENvbW1pdHNJblJhbmdlfSBmcm9tICcuLi8uLi9jb21taXQtbWVzc2FnZS91dGlscy5qcyc7XG5pbXBvcnQge0F1dGhlbnRpY2F0ZWRHaXRDbGllbnR9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQuanMnO1xuaW1wb3J0IHthZGRUb2tlblRvR2l0SHR0cHNVcmx9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9naXRodWItdXJscy5qcyc7XG5pbXBvcnQge0xvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge1Byb21wdH0gZnJvbSAnLi4vLi4vdXRpbHMvcHJvbXB0LmpzJztcbmltcG9ydCB7ZmV0Y2hQdWxsUmVxdWVzdEZyb21HaXRodWJ9IGZyb20gJy4uL2NvbW1vbi9mZXRjaC1wdWxsLXJlcXVlc3QuanMnO1xuXG4vKipcbiAqIFJlYmFzZSB0aGUgcHJvdmlkZWQgUFIgb250byBpdHMgbWVyZ2UgdGFyZ2V0IGJyYW5jaCwgYW5kIHB1c2ggdXAgdGhlIHJlc3VsdGluZ1xuICogY29tbWl0IHRvIHRoZSBQUnMgcmVwb3NpdG9yeS5cbiAqXG4gKiBAcmV0dXJucyBhIHN0YXR1cyBjb2RlIGluZGljYXRpbmcgd2hldGhlciB0aGUgcmViYXNlIHdhcyBzdWNjZXNzZnVsLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmViYXNlUHIocHJOdW1iZXI6IG51bWJlciwgaW50ZXJhY3RpdmU6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8bnVtYmVyPiB7XG4gIC8qKiBUaGUgc2luZ2xldG9uIGluc3RhbmNlIG9mIHRoZSBhdXRoZW50aWNhdGVkIGdpdCBjbGllbnQuICovXG4gIGNvbnN0IGdpdCA9IGF3YWl0IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQuZ2V0KCk7XG5cbiAgaWYgKGdpdC5oYXNVbmNvbW1pdHRlZENoYW5nZXMoKSkge1xuICAgIExvZy5lcnJvcignQ2Fubm90IHBlcmZvcm0gcmViYXNlIG9mIFBSIHdpdGggbG9jYWwgY2hhbmdlcy4nKTtcbiAgICByZXR1cm4gMTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgYnJhbmNoIG9yIHJldmlzaW9uIG9yaWdpbmFsbHkgY2hlY2tlZCBvdXQgYmVmb3JlIHRoaXMgbWV0aG9kIHBlcmZvcm1lZFxuICAgKiBhbnkgR2l0IG9wZXJhdGlvbnMgdGhhdCBtYXkgY2hhbmdlIHRoZSB3b3JraW5nIGJyYW5jaC5cbiAgICovXG4gIGNvbnN0IHByZXZpb3VzQnJhbmNoT3JSZXZpc2lvbiA9IGdpdC5nZXRDdXJyZW50QnJhbmNoT3JSZXZpc2lvbigpO1xuICAvKiBHZXQgdGhlIFBSIGluZm9ybWF0aW9uIGZyb20gR2l0aHViLiAqL1xuICBjb25zdCBwciA9IGF3YWl0IGZldGNoUHVsbFJlcXVlc3RGcm9tR2l0aHViKGdpdCwgcHJOdW1iZXIpO1xuXG4gIGlmIChwciA9PT0gbnVsbCkge1xuICAgIExvZy5lcnJvcihgU3BlY2lmaWVkIHB1bGwgcmVxdWVzdCBkb2VzIG5vdCBleGlzdC5gKTtcbiAgICByZXR1cm4gMTtcbiAgfVxuXG4gIGNvbnN0IGhlYWRSZWZOYW1lID0gcHIuaGVhZFJlZi5uYW1lO1xuICBjb25zdCBiYXNlUmVmTmFtZSA9IHByLmJhc2VSZWYubmFtZTtcbiAgY29uc3QgZnVsbEhlYWRSZWYgPSBgJHtwci5oZWFkUmVmLnJlcG9zaXRvcnkubmFtZVdpdGhPd25lcn06JHtoZWFkUmVmTmFtZX1gO1xuICBjb25zdCBmdWxsQmFzZVJlZiA9IGAke3ByLmJhc2VSZWYucmVwb3NpdG9yeS5uYW1lV2l0aE93bmVyfToke2Jhc2VSZWZOYW1lfWA7XG4gIGNvbnN0IGhlYWRSZWZVcmwgPSBhZGRUb2tlblRvR2l0SHR0cHNVcmwocHIuaGVhZFJlZi5yZXBvc2l0b3J5LnVybCwgZ2l0LmdpdGh1YlRva2VuKTtcbiAgY29uc3QgYmFzZVJlZlVybCA9IGFkZFRva2VuVG9HaXRIdHRwc1VybChwci5iYXNlUmVmLnJlcG9zaXRvcnkudXJsLCBnaXQuZ2l0aHViVG9rZW4pO1xuXG4gIC8vIE5vdGU6IFNpbmNlIHdlIHVzZSBhIGRldGFjaGVkIGhlYWQgZm9yIHJlYmFzaW5nIHRoZSBQUiBhbmQgdGhlcmVmb3JlIGRvIG5vdCBoYXZlXG4gIC8vIHJlbW90ZS10cmFja2luZyBicmFuY2hlcyBjb25maWd1cmVkLCB3ZSBuZWVkIHRvIHNldCBvdXIgZXhwZWN0ZWQgcmVmIGFuZCBTSEEuIFRoaXNcbiAgLy8gYWxsb3dzIHVzIHRvIHVzZSBgLS1mb3JjZS13aXRoLWxlYXNlYCBmb3IgdGhlIGRldGFjaGVkIGhlYWQgd2hpbGUgZW5zdXJpbmcgdGhhdCB3ZVxuICAvLyBuZXZlciBhY2NpZGVudGFsbHkgb3ZlcnJpZGUgdXBzdHJlYW0gY2hhbmdlcyB0aGF0IGhhdmUgYmVlbiBwdXNoZWQgaW4gdGhlIG1lYW53aGlsZS5cbiAgLy8gU2VlOlxuICAvLyBodHRwczovL2dpdC1zY20uY29tL2RvY3MvZ2l0LXB1c2gjRG9jdW1lbnRhdGlvbi9naXQtcHVzaC50eHQtLS1mb3JjZS13aXRoLWxlYXNlbHRyZWZuYW1lZ3RsdGV4cGVjdGd0XG4gIGNvbnN0IGZvcmNlV2l0aExlYXNlRmxhZyA9IGAtLWZvcmNlLXdpdGgtbGVhc2U9JHtoZWFkUmVmTmFtZX06JHtwci5oZWFkUmVmT2lkfWA7XG5cbiAgLy8gSWYgdGhlIFBSIGRvZXMgbm90IGFsbG93IG1haW50YWluZXJzIHRvIG1vZGlmeSBpdCwgZXhpdCBhcyB0aGUgcmViYXNlZCBQUiBjYW5ub3RcbiAgLy8gYmUgcHVzaGVkIHVwLlxuICBpZiAoIXByLm1haW50YWluZXJDYW5Nb2RpZnkgJiYgIXByLnZpZXdlckRpZEF1dGhvcikge1xuICAgIExvZy5lcnJvcihcbiAgICAgIGBDYW5ub3QgcmViYXNlIGFzIHlvdSBkaWQgbm90IGF1dGhvciB0aGUgUFIgYW5kIHRoZSBQUiBkb2VzIG5vdCBhbGxvdyBtYWludGFpbmVyc2AgK1xuICAgICAgICBgdG8gbW9kaWZ5IHRoZSBQUmAsXG4gICAgKTtcbiAgICByZXR1cm4gMTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgLy8gRmV0Y2hlcyBhcmUgZG9uZSB3aXRoIC0tZGVlcGVuPTUwMCBpbmNyZWFzZSB0aGUgbGlrZWxpaG9vZCBvZiBmaW5kaW5nIGEgY29tbW9uIGFuY2VzdG9yIHdoZW5cbiAgICAvLyBhIHNoYWxsb3cgY2xvbmUgaXMgYmVpbmcgdXNlZC5cblxuICAgIC8vIEZldGNoIHRoZSBicmFuY2ggYXQgdGhlIGNvbW1pdCBvZiB0aGUgUFIsIGFuZCBjaGVjayBpdCBvdXQgaW4gYSBkZXRhY2hlZCBzdGF0ZS5cbiAgICBMb2cuaW5mbyhgQ2hlY2tpbmcgb3V0IFBSICMke3ByTnVtYmVyfSBmcm9tICR7ZnVsbEhlYWRSZWZ9YCk7XG4gICAgZ2l0LnJ1bihbJ2ZldGNoJywgJy1xJywgaGVhZFJlZlVybCwgaGVhZFJlZk5hbWUsICctLWRlZXBlbj01MDAnXSk7XG4gICAgZ2l0LnJ1bihbJ2NoZWNrb3V0JywgJy1xJywgJy0tZGV0YWNoJywgJ0ZFVENIX0hFQUQnXSk7XG4gICAgLy8gRmV0Y2ggdGhlIFBScyB0YXJnZXQgYnJhbmNoIGFuZCByZWJhc2Ugb250byBpdC5cbiAgICBMb2cuaW5mbyhgRmV0Y2hpbmcgJHtmdWxsQmFzZVJlZn0gdG8gcmViYXNlICMke3ByTnVtYmVyfSBvbmApO1xuICAgIGdpdC5ydW4oWydmZXRjaCcsICctcScsIGJhc2VSZWZVcmwsIGJhc2VSZWZOYW1lLCAnLS1kZWVwZW49NTAwJ10pO1xuXG4gICAgY29uc3QgY29tbW9uQW5jZXN0b3JTaGEgPSBnaXQucnVuKFsnbWVyZ2UtYmFzZScsICdIRUFEJywgJ0ZFVENIX0hFQUQnXSkuc3Rkb3V0LnRyaW0oKTtcblxuICAgIGNvbnN0IGNvbW1pdHMgPSBhd2FpdCBnZXRDb21taXRzSW5SYW5nZShjb21tb25BbmNlc3RvclNoYSwgJ0hFQUQnKTtcblxuICAgIGxldCBzcXVhc2hGaXh1cHMgPVxuICAgICAgcHJvY2Vzcy5lbnZbJ0NJJ10gIT09IHVuZGVmaW5lZCB8fFxuICAgICAgY29tbWl0cy5maWx0ZXIoKGNvbW1pdDogQ29tbWl0KSA9PiBjb21taXQuaXNGaXh1cCkubGVuZ3RoID09PSAwXG4gICAgICAgID8gZmFsc2VcbiAgICAgICAgOiBhd2FpdCBQcm9tcHQuY29uZmlybSh7XG4gICAgICAgICAgICBtZXNzYWdlOiBgUFIgIyR7cHJOdW1iZXJ9IGNvbnRhaW5zIGZpeHVwIGNvbW1pdHMsIHdvdWxkIHlvdSBsaWtlIHRvIHNxdWFzaCB0aGVtIGR1cmluZyByZWJhc2U/YCxcbiAgICAgICAgICAgIGRlZmF1bHQ6IHRydWUsXG4gICAgICAgICAgfSk7XG5cbiAgICBMb2cuaW5mbyhgQXR0ZW1wdGluZyB0byByZWJhc2UgUFIgIyR7cHJOdW1iZXJ9IG9uICR7ZnVsbEJhc2VSZWZ9YCk7XG5cbiAgICAvKipcbiAgICAgKiBUdXBsZSBvZiBmbGFncyB0byBiZSBhZGRlZCB0byB0aGUgcmViYXNlIGNvbW1hbmQgYW5kIGVudiBvYmplY3QgdG8gcnVuIHRoZSBnaXQgY29tbWFuZC5cbiAgICAgKlxuICAgICAqIEFkZGl0aW9uYWwgZmxhZ3MgdG8gcGVyZm9ybSB0aGUgYXV0b3NxdWFzaGluZyBhcmUgYWRkZWQgd2hlbiB0aGUgdXNlciBjb25maXJtIHNxdWFzaGluZyBvZlxuICAgICAqIGZpeHVwIGNvbW1pdHMgc2hvdWxkIG9jY3VyLlxuICAgICAqL1xuXG4gICAgLy8gdGhlIGVudiB2YXJpYWJsZSBwcmV2ZW50cyB0aGUgZWRpdG9yIGZyb20gc2hvd2luZyBpbiB0aGUgY2FzZSBvZiBmaXh1cCBjb21taXRzIGFuZCBub3RcbiAgICAvLyBpbnRlcmFjdGl2ZWx5IHJlYmFzaW5nXG4gICAgY29uc3QgZW52ID1cbiAgICAgIHNxdWFzaEZpeHVwcyAmJiAhaW50ZXJhY3RpdmUgPyB7Li4ucHJvY2Vzcy5lbnYsIEdJVF9TRVFVRU5DRV9FRElUT1I6ICd0cnVlJ30gOiB1bmRlZmluZWQ7XG4gICAgbGV0IGZsYWdzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgaWYgKHNxdWFzaEZpeHVwcyB8fCBpbnRlcmFjdGl2ZSkge1xuICAgICAgZmxhZ3MucHVzaCgnLS1pbnRlcmFjdGl2ZScpO1xuICAgIH1cbiAgICBpZiAoc3F1YXNoRml4dXBzKSB7XG4gICAgICBmbGFncy5wdXNoKCctLWF1dG9zcXVhc2gnKTtcbiAgICB9XG5cbiAgICBjb25zdCByZWJhc2VSZXN1bHQgPSBnaXQucnVuR3JhY2VmdWwoWydyZWJhc2UnLCAuLi5mbGFncywgJ0ZFVENIX0hFQUQnXSwge2VudjogZW52fSk7XG5cbiAgICAvLyBJZiB0aGUgcmViYXNlIHdhcyBjbGVhbiwgcHVzaCB0aGUgcmViYXNlZCBQUiB1cCB0byB0aGUgYXV0aG9ycyBmb3JrLlxuICAgIGlmIChyZWJhc2VSZXN1bHQuc3RhdHVzID09PSAwKSB7XG4gICAgICBMb2cuaW5mbyhgUmViYXNlIHdhcyBhYmxlIHRvIGNvbXBsZXRlIGF1dG9tYXRpY2FsbHkgd2l0aG91dCBjb25mbGljdHNgKTtcbiAgICAgIExvZy5pbmZvKGBQdXNoaW5nIHJlYmFzZWQgUFIgIyR7cHJOdW1iZXJ9IHRvICR7ZnVsbEhlYWRSZWZ9YCk7XG4gICAgICBnaXQucnVuKFsncHVzaCcsIGhlYWRSZWZVcmwsIGBIRUFEOiR7aGVhZFJlZk5hbWV9YCwgZm9yY2VXaXRoTGVhc2VGbGFnXSk7XG4gICAgICBMb2cuaW5mbyhgUmViYXNlZCBhbmQgdXBkYXRlZCBQUiAjJHtwck51bWJlcn1gKTtcbiAgICAgIGdpdC5jaGVja291dChwcmV2aW91c0JyYW5jaE9yUmV2aXNpb24sIHRydWUpO1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBMb2cuZXJyb3IoZXJyKTtcbiAgICBnaXQuY2hlY2tvdXQocHJldmlvdXNCcmFuY2hPclJldmlzaW9uLCB0cnVlKTtcbiAgICByZXR1cm4gMTtcbiAgfVxuXG4gIC8vIE9uIGF1dG9tYXRpYyByZWJhc2UgZmFpbHVyZXMsIHByb21wdCB0byBjaG9vc2UgaWYgdGhlIHJlYmFzZSBzaG91bGQgYmUgY29udGludWVkXG4gIC8vIG1hbnVhbGx5IG9yIGFib3J0ZWQgbm93LlxuICBMb2cuaW5mbyhgUmViYXNlIHdhcyB1bmFibGUgdG8gY29tcGxldGUgYXV0b21hdGljYWxseSB3aXRob3V0IGNvbmZsaWN0cy5gKTtcbiAgLy8gSWYgdGhlIGNvbW1hbmQgaXMgcnVuIGluIGEgbm9uLUNJIGVudmlyb25tZW50LCBwcm9tcHQgdG8gYWxsb3cgZm9yIHRoZSB1c2VyIHRvXG4gIC8vIG1hbnVhbGx5IGNvbXBsZXRlIHRoZSByZWJhc2UuXG4gIGNvbnN0IGNvbnRpbnVlUmViYXNlID1cbiAgICBwcm9jZXNzLmVudlsnQ0knXSA9PT0gdW5kZWZpbmVkICYmXG4gICAgKGF3YWl0IFByb21wdC5jb25maXJtKHttZXNzYWdlOiAnTWFudWFsbHkgY29tcGxldGUgcmViYXNlPyd9KSk7XG5cbiAgaWYgKGNvbnRpbnVlUmViYXNlKSB7XG4gICAgTG9nLmluZm8oXG4gICAgICBgQWZ0ZXIgbWFudWFsbHkgY29tcGxldGluZyByZWJhc2UsIHJ1biB0aGUgZm9sbG93aW5nIGNvbW1hbmQgdG8gdXBkYXRlIFBSICMke3ByTnVtYmVyfTpgLFxuICAgICk7XG4gICAgTG9nLmluZm8oYCAkIGdpdCBwdXNoICR7cHIuaGVhZFJlZi5yZXBvc2l0b3J5LnVybH0gSEVBRDoke2hlYWRSZWZOYW1lfSAke2ZvcmNlV2l0aExlYXNlRmxhZ31gKTtcbiAgICBMb2cuaW5mbygpO1xuICAgIExvZy5pbmZvKGBUbyBhYm9ydCB0aGUgcmViYXNlIGFuZCByZXR1cm4gdG8gdGhlIHN0YXRlIG9mIHRoZSByZXBvc2l0b3J5IGJlZm9yZSB0aGlzIGNvbW1hbmRgKTtcbiAgICBMb2cuaW5mbyhgcnVuIHRoZSBmb2xsb3dpbmcgY29tbWFuZDpgKTtcbiAgICBMb2cuaW5mbyhcbiAgICAgIGAgJCBnaXQgcmViYXNlIC0tYWJvcnQgJiYgZ2l0IHJlc2V0IC0taGFyZCAmJiBnaXQgY2hlY2tvdXQgJHtwcmV2aW91c0JyYW5jaE9yUmV2aXNpb259YCxcbiAgICApO1xuICAgIHJldHVybiAxO1xuICB9IGVsc2Uge1xuICAgIExvZy5pbmZvKGBDbGVhbmluZyB1cCBnaXQgc3RhdGUsIGFuZCByZXN0b3JpbmcgcHJldmlvdXMgc3RhdGUuYCk7XG4gIH1cblxuICBnaXQuY2hlY2tvdXQocHJldmlvdXNCcmFuY2hPclJldmlzaW9uLCB0cnVlKTtcbiAgcmV0dXJuIDE7XG59XG4iXX0=