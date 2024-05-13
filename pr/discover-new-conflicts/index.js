/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Bar } from 'cli-progress';
import { Log } from '../../utils/logging.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { GitCommandError } from '../../utils/git/git-client.js';
import { fetchPendingPullRequestsFromGithub, } from '../common/fetch-pull-request.js';
/** Name of a temporary local branch that is used for checking conflicts. **/
const tempWorkingBranch = '__NgDevRepoBaseAfterChange__';
/** Checks if the provided PR will cause new conflicts in other pending PRs. */
export async function discoverNewConflictsForPr(newPrNumber, updatedAfter) {
    /** The singleton instance of the authenticated git client. */
    const git = await AuthenticatedGitClient.get();
    // If there are any local changes in the current repository state, the
    // check cannot run as it needs to move between branches.
    if (git.hasUncommittedChanges()) {
        Log.error('Cannot run with local changes. Please make sure there are no local changes.');
        process.exit(1);
    }
    /** The active github branch or revision before we performed any Git commands. */
    const previousBranchOrRevision = git.getCurrentBranchOrRevision();
    /* Progress bar to indicate progress. */
    const progressBar = new Bar({ format: `[{bar}] ETA: {eta}s | {value}/{total}` });
    /* PRs which were found to be conflicting. */
    const conflicts = [];
    Log.info(`Requesting pending PRs from Github`);
    /** List of PRs from github currently known as mergable. */
    const allPendingPRs = await fetchPendingPullRequestsFromGithub(git);
    if (allPendingPRs === null) {
        Log.error('Unable to find any pending PRs in the repository');
        process.exit(1);
    }
    /** The PR which is being checked against. */
    const requestedPr = allPendingPRs.find((pr) => pr.number === newPrNumber);
    if (requestedPr === undefined) {
        Log.error(`The request PR, #${newPrNumber} was not found as a pending PR on github, please confirm`);
        Log.error(`the PR number is correct and is an open PR`);
        process.exit(1);
    }
    const pendingPrs = allPendingPRs.filter((pr) => {
        return (
        // PRs being merged into the same target branch as the requested PR
        pr.baseRef.name === requestedPr.baseRef.name &&
            // PRs which either have not been processed or are determined as mergable by Github
            pr.mergeable !== 'CONFLICTING' &&
            // PRs updated after the provided date
            new Date(pr.updatedAt).getTime() >= updatedAfter);
    });
    Log.info(`Retrieved ${allPendingPRs.length} total pending PRs`);
    Log.info(`Checking ${pendingPrs.length} PRs for conflicts after a merge of #${newPrNumber}`);
    // Fetch and checkout the PR being checked.
    git.run(['fetch', '-q', requestedPr.headRef.repository.url, requestedPr.headRef.name]);
    git.run(['checkout', '-q', '-B', tempWorkingBranch, 'FETCH_HEAD']);
    // Rebase the PR against the PRs target branch.
    git.run(['fetch', '-q', requestedPr.baseRef.repository.url, requestedPr.baseRef.name]);
    try {
        git.run(['rebase', 'FETCH_HEAD'], { stdio: 'ignore' });
    }
    catch (err) {
        if (err instanceof GitCommandError) {
            Log.error('The requested PR currently has conflicts');
            git.checkout(previousBranchOrRevision, true);
            process.exit(1);
        }
        throw err;
    }
    // Start the progress bar
    progressBar.start(pendingPrs.length, 0);
    // Check each PR to determine if it can merge cleanly into the repo after the target PR.
    for (const pr of pendingPrs) {
        // Fetch and checkout the next PR
        git.run(['fetch', '-q', pr.headRef.repository.url, pr.headRef.name]);
        git.run(['checkout', '-q', '--detach', 'FETCH_HEAD']);
        // Check if the PR cleanly rebases into the repo after the target PR.
        try {
            git.run(['rebase', tempWorkingBranch], { stdio: 'ignore' });
        }
        catch (err) {
            if (err instanceof GitCommandError) {
                conflicts.push(pr);
            }
            else {
                throw err;
            }
        }
        // Abort any outstanding rebase attempt.
        git.runGraceful(['rebase', '--abort'], { stdio: 'ignore' });
        progressBar.increment(1);
    }
    // End the progress bar as all PRs have been processed.
    progressBar.stop();
    Log.info();
    Log.info(`Result:`);
    git.checkout(previousBranchOrRevision, true);
    // If no conflicts are found, exit successfully.
    if (conflicts.length === 0) {
        Log.info(`No new conflicting PRs found after #${newPrNumber} merging`);
        process.exit(0);
    }
    // Inform about discovered conflicts, exit with failure.
    Log.error.group(`${conflicts.length} PR(s) which conflict(s) after #${newPrNumber} merges:`);
    for (const pr of conflicts) {
        Log.error(`  - #${pr.number}: ${pr.title}`);
    }
    Log.error.groupEnd();
    process.exit(1);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvZGlzY292ZXItbmV3LWNvbmZsaWN0cy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsR0FBRyxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBRWpDLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMsc0JBQXNCLEVBQUMsTUFBTSw2Q0FBNkMsQ0FBQztBQUNuRixPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sK0JBQStCLENBQUM7QUFDOUQsT0FBTyxFQUNMLGtDQUFrQyxHQUVuQyxNQUFNLGlDQUFpQyxDQUFDO0FBRXpDLDZFQUE2RTtBQUM3RSxNQUFNLGlCQUFpQixHQUFHLDhCQUE4QixDQUFDO0FBRXpELCtFQUErRTtBQUMvRSxNQUFNLENBQUMsS0FBSyxVQUFVLHlCQUF5QixDQUFDLFdBQW1CLEVBQUUsWUFBb0I7SUFDdkYsOERBQThEO0lBQzlELE1BQU0sR0FBRyxHQUFHLE1BQU0sc0JBQXNCLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFL0Msc0VBQXNFO0lBQ3RFLHlEQUF5RDtJQUN6RCxJQUFJLEdBQUcsQ0FBQyxxQkFBcUIsRUFBRSxFQUFFLENBQUM7UUFDaEMsR0FBRyxDQUFDLEtBQUssQ0FBQyw2RUFBNkUsQ0FBQyxDQUFDO1FBQ3pGLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEIsQ0FBQztJQUVELGlGQUFpRjtJQUNqRixNQUFNLHdCQUF3QixHQUFHLEdBQUcsQ0FBQywwQkFBMEIsRUFBRSxDQUFDO0lBQ2xFLHdDQUF3QztJQUN4QyxNQUFNLFdBQVcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxFQUFDLE1BQU0sRUFBRSx1Q0FBdUMsRUFBQyxDQUFDLENBQUM7SUFDL0UsNkNBQTZDO0lBQzdDLE1BQU0sU0FBUyxH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Z0RBQWdEO0lBQ2hELElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUMzQixHQUFHLENBQUMsSUFBSSxDQUFDLHVDQUF1QyxXQUFXLFVBQVUsQ0FBQyxDQUFDO1FBQ3ZFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEIsQ0FBQztJQUVELHdEQUF3RDtJQUN4RCxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLG1DQUFtQyxXQUFXLFVBQVUsQ0FBQyxDQUFDO0lBQzdGLEtBQUssTUFBTSxFQUFFLElBQUksU0FBUyxFQUFFLENBQUM7UUFDM0IsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxNQUFNLEtBQUssRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQUNELEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDckIsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QmFyfSBmcm9tICdjbGktcHJvZ3Jlc3MnO1xuXG5pbXBvcnQge0xvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge0F1dGhlbnRpY2F0ZWRHaXRDbGllbnR9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQuanMnO1xuaW1wb3J0IHtHaXRDb21tYW5kRXJyb3J9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9naXQtY2xpZW50LmpzJztcbmltcG9ydCB7XG4gIGZldGNoUGVuZGluZ1B1bGxSZXF1ZXN0c0Zyb21HaXRodWIsXG4gIFB1bGxSZXF1ZXN0RnJvbUdpdGh1Yixcbn0gZnJvbSAnLi4vY29tbW9uL2ZldGNoLXB1bGwtcmVxdWVzdC5qcyc7XG5cbi8qKiBOYW1lIG9mIGEgdGVtcG9yYXJ5IGxvY2FsIGJyYW5jaCB0aGF0IGlzIHVzZWQgZm9yIGNoZWNraW5nIGNvbmZsaWN0cy4gKiovXG5jb25zdCB0ZW1wV29ya2luZ0JyYW5jaCA9ICdfX05nRGV2UmVwb0Jhc2VBZnRlckNoYW5nZV9fJztcblxuLyoqIENoZWNrcyBpZiB0aGUgcHJvdmlkZWQgUFIgd2lsbCBjYXVzZSBuZXcgY29uZmxpY3RzIGluIG90aGVyIHBlbmRpbmcgUFJzLiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRpc2NvdmVyTmV3Q29uZmxpY3RzRm9yUHIobmV3UHJOdW1iZXI6IG51bWJlciwgdXBkYXRlZEFmdGVyOiBudW1iZXIpIHtcbiAgLyoqIFRoZSBzaW5nbGV0b24gaW5zdGFuY2Ugb2YgdGhlIGF1dGhlbnRpY2F0ZWQgZ2l0IGNsaWVudC4gKi9cbiAgY29uc3QgZ2l0ID0gYXdhaXQgQXV0aGVudGljYXRlZEdpdENsaWVudC5nZXQoKTtcblxuICAvLyBJZiB0aGVyZSBhcmUgYW55IGxvY2FsIGNoYW5nZXMgaW4gdGhlIGN1cnJlbnQgcmVwb3NpdG9yeSBzdGF0ZSwgdGhlXG4gIC8vIGNoZWNrIGNhbm5vdCBydW4gYXMgaXQgbmVlZHMgdG8gbW92ZSBiZXR3ZWVuIGJyYW5jaGVzLlxuICBpZiAoZ2l0Lmhhc1VuY29tbWl0dGVkQ2hhbmdlcygpKSB7XG4gICAgTG9nLmVycm9yKCdDYW5ub3QgcnVuIHdpdGggbG9jYWwgY2hhbmdlcy4gUGxlYXNlIG1ha2Ugc3VyZSB0aGVyZSBhcmUgbm8gbG9jYWwgY2hhbmdlcy4nKTtcbiAgICBwcm9jZXNzLmV4aXQoMSk7XG4gIH1cblxuICAvKiogVGhlIGFjdGl2ZSBnaXRodWIgYnJhbmNoIG9yIHJldmlzaW9uIGJlZm9yZSB3ZSBwZXJmb3JtZWQgYW55IEdpdCBjb21tYW5kcy4gKi9cbiAgY29uc3QgcHJldmlvdXNCcmFuY2hPclJldmlzaW9uID0gZ2l0LmdldEN1cnJlbnRCcmFuY2hPclJldmlzaW9uKCk7XG4gIC8qIFByb2dyZXNzIGJhciB0byBpbmRpY2F0ZSBwcm9ncmVzcy4gKi9cbiAgY29uc3QgcHJvZ3Jlc3NCYXIgPSBuZXcgQmFyKHtmb3JtYXQ6IGBbe2Jhcn1dIEVUQToge2V0YX1zIHwge3ZhbHVlfS97dG90YWx9YH0pO1xuICAvKiBQUnMgd2hpY2ggd2VyZSBmb3VuZCB0byBiZSBjb25mbGljdGluZy4gKi9cbiAgY29uc3QgY29uZmxpY3RzOiBBcnJheTxQdWxsUmVxdWVzdEZyb21HaXRodWI+ID0gW107XG5cbiAgTG9nLmluZm8oYFJlcXVlc3RpbmcgcGVuZGluZyBQUnMgZnJvbSBHaXRodWJgKTtcbiAgLyoqIExpc3Qgb2YgUFJzIGZyb20gZ2l0aHViIGN1cnJlbnRseSBrbm93biBhcyBtZXJnYWJsZS4gKi9cbiAgY29uc3QgYWxsUGVuZGluZ1BScyA9IGF3YWl0IGZldGNoUGVuZGluZ1B1bGxSZXF1ZXN0c0Zyb21HaXRodWIoZ2l0KTtcblxuICBpZiAoYWxsUGVuZGluZ1BScyA9PT0gbnVsbCkge1xuICAgIExvZy5lcnJvcignVW5hYmxlIHRvIGZpbmQgYW55IHBlbmRpbmcgUFJzIGluIHRoZSByZXBvc2l0b3J5Jyk7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xuICB9XG5cbiAgLyoqIFRoZSBQUiB3aGljaCBpcyBiZWluZyBjaGVja2VkIGFnYWluc3QuICovXG4gIGNvbnN0IHJlcXVlc3RlZFByID0gYWxsUGVuZGluZ1BScy5maW5kKChwcikgPT4gcHIubnVtYmVyID09PSBuZXdQck51bWJlcik7XG4gIGlmIChyZXF1ZXN0ZWRQciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgTG9nLmVycm9yKFxuICAgICAgYFRoZSByZXF1ZXN0IFBSLCAjJHtuZXdQck51bWJlcn0gd2FzIG5vdCBmb3VuZCBhcyBhIHBlbmRpbmcgUFIgb24gZ2l0aHViLCBwbGVhc2UgY29uZmlybWAsXG4gICAgKTtcbiAgICBMb2cuZXJyb3IoYHRoZSBQUiBudW1iZXIgaXMgY29ycmVjdCBhbmQgaXMgYW4gb3BlbiBQUmApO1xuICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgfVxuXG4gIGNvbnN0IHBlbmRpbmdQcnMgPSBhbGxQZW5kaW5nUFJzLmZpbHRlcigocHIpID0+IHtcbiAgICByZXR1cm4gKFxuICAgICAgLy8gUFJzIGJlaW5nIG1lcmdlZCBpbnRvIHRoZSBzYW1lIHRhcmdldCBicmFuY2ggYXMgdGhlIHJlcXVlc3RlZCBQUlxuICAgICAgcHIuYmFzZVJlZi5uYW1lID09PSByZXF1ZXN0ZWRQci5iYXNlUmVmLm5hbWUgJiZcbiAgICAgIC8vIFBScyB3aGljaCBlaXRoZXIgaGF2ZSBub3QgYmVlbiBwcm9jZXNzZWQgb3IgYXJlIGRldGVybWluZWQgYXMgbWVyZ2FibGUgYnkgR2l0aHViXG4gICAgICBwci5tZXJnZWFibGUgIT09ICdDT05GTElDVElORycgJiZcbiAgICAgIC8vIFBScyB1cGRhdGVkIGFmdGVyIHRoZSBwcm92aWRlZCBkYXRlXG4gICAgICBuZXcgRGF0ZShwci51cGRhdGVkQXQpLmdldFRpbWUoKSA+PSB1cGRhdGVkQWZ0ZXJcbiAgICApO1xuICB9KTtcbiAgTG9nLmluZm8oYFJldHJpZXZlZCAke2FsbFBlbmRpbmdQUnMubGVuZ3RofSB0b3RhbCBwZW5kaW5nIFBSc2ApO1xuICBMb2cuaW5mbyhgQ2hlY2tpbmcgJHtwZW5kaW5nUHJzLmxlbmd0aH0gUFJzIGZvciBjb25mbGljdHMgYWZ0ZXIgYSBtZXJnZSBvZiAjJHtuZXdQck51bWJlcn1gKTtcblxuICAvLyBGZXRjaCBhbmQgY2hlY2tvdXQgdGhlIFBSIGJlaW5nIGNoZWNrZWQuXG4gIGdpdC5ydW4oWydmZXRjaCcsICctcScsIHJlcXVlc3RlZFByLmhlYWRSZWYucmVwb3NpdG9yeS51cmwsIHJlcXVlc3RlZFByLmhlYWRSZWYubmFtZV0pO1xuICBnaXQucnVuKFsnY2hlY2tvdXQnLCAnLXEnLCAnLUInLCB0ZW1wV29ya2luZ0JyYW5jaCwgJ0ZFVENIX0hFQUQnXSk7XG5cbiAgLy8gUmViYXNlIHRoZSBQUiBhZ2FpbnN0IHRoZSBQUnMgdGFyZ2V0IGJyYW5jaC5cbiAgZ2l0LnJ1bihbJ2ZldGNoJywgJy1xJywgcmVxdWVzdGVkUHIuYmFzZVJlZi5yZXBvc2l0b3J5LnVybCwgcmVxdWVzdGVkUHIuYmFzZVJlZi5uYW1lXSk7XG4gIHRyeSB7XG4gICAgZ2l0LnJ1bihbJ3JlYmFzZScsICdGRVRDSF9IRUFEJ10sIHtzdGRpbzogJ2lnbm9yZSd9KTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKGVyciBpbnN0YW5jZW9mIEdpdENvbW1hbmRFcnJvcikge1xuICAgICAgTG9nLmVycm9yKCdUaGUgcmVxdWVzdGVkIFBSIGN1cnJlbnRseSBoYXMgY29uZmxpY3RzJyk7XG4gICAgICBnaXQuY2hlY2tvdXQocHJldmlvdXNCcmFuY2hPclJldmlzaW9uLCB0cnVlKTtcbiAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICB9XG4gICAgdGhyb3cgZXJyO1xuICB9XG5cbiAgLy8gU3RhcnQgdGhlIHByb2dyZXNzIGJhclxuICBwcm9ncmVzc0Jhci5zdGFydChwZW5kaW5nUHJzLmxlbmd0aCwgMCk7XG5cbiAgLy8gQ2hlY2sgZWFjaCBQUiB0byBkZXRlcm1pbmUgaWYgaXQgY2FuIG1lcmdlIGNsZWFubHkgaW50byB0aGUgcmVwbyBhZnRlciB0aGUgdGFyZ2V0IFBSLlxuICBmb3IgKGNvbnN0IHByIG9mIHBlbmRpbmdQcnMpIHtcbiAgICAvLyBGZXRjaCBhbmQgY2hlY2tvdXQgdGhlIG5leHQgUFJcbiAgICBnaXQucnVuKFsnZmV0Y2gnLCAnLXEnLCBwci5oZWFkUmVmLnJlcG9zaXRvcnkudXJsLCBwci5oZWFkUmVmLm5hbWVdKTtcbiAgICBnaXQucnVuKFsnY2hlY2tvdXQnLCAnLXEnLCAnLS1kZXRhY2gnLCAnRkVUQ0hfSEVBRCddKTtcbiAgICAvLyBDaGVjayBpZiB0aGUgUFIgY2xlYW5seSByZWJhc2VzIGludG8gdGhlIHJlcG8gYWZ0ZXIgdGhlIHRhcmdldCBQUi5cbiAgICB0cnkge1xuICAgICAgZ2l0LnJ1bihbJ3JlYmFzZScsIHRlbXBXb3JraW5nQnJhbmNoXSwge3N0ZGlvOiAnaWdub3JlJ30pO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIEdpdENvbW1hbmRFcnJvcikge1xuICAgICAgICBjb25mbGljdHMucHVzaChwcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIEFib3J0IGFueSBvdXRzdGFuZGluZyByZWJhc2UgYXR0ZW1wdC5cbiAgICBnaXQucnVuR3JhY2VmdWwoWydyZWJhc2UnLCAnLS1hYm9ydCddLCB7c3RkaW86ICdpZ25vcmUnfSk7XG5cbiAgICBwcm9ncmVzc0Jhci5pbmNyZW1lbnQoMSk7XG4gIH1cbiAgLy8gRW5kIHRoZSBwcm9ncmVzcyBiYXIgYXMgYWxsIFBScyBoYXZlIGJlZW4gcHJvY2Vzc2VkLlxuICBwcm9ncmVzc0Jhci5zdG9wKCk7XG4gIExvZy5pbmZvKCk7XG4gIExvZy5pbmZvKGBSZXN1bHQ6YCk7XG5cbiAgZ2l0LmNoZWNrb3V0KHByZXZpb3VzQnJhbmNoT3JSZXZpc2lvbiwgdHJ1ZSk7XG5cbiAgLy8gSWYgbm8gY29uZmxpY3RzIGFyZSBmb3VuZCwgZXhpdCBzdWNjZXNzZnVsbHkuXG4gIGlmIChjb25mbGljdHMubGVuZ3RoID09PSAwKSB7XG4gICAgTG9nLmluZm8oYE5vIG5ldyBjb25mbGljdGluZyBQUnMgZm91bmQgYWZ0ZXIgIyR7bmV3UHJOdW1iZXJ9IG1lcmdpbmdgKTtcbiAgICBwcm9jZXNzLmV4aXQoMCk7XG4gIH1cblxuICAvLyBJbmZvcm0gYWJvdXQgZGlzY292ZXJlZCBjb25mbGljdHMsIGV4aXQgd2l0aCBmYWlsdXJlLlxuICBMb2cuZXJyb3IuZ3JvdXAoYCR7Y29uZmxpY3RzLmxlbmd0aH0gUFIocykgd2hpY2ggY29uZmxpY3QocykgYWZ0ZXIgIyR7bmV3UHJOdW1iZXJ9IG1lcmdlczpgKTtcbiAgZm9yIChjb25zdCBwciBvZiBjb25mbGljdHMpIHtcbiAgICBMb2cuZXJyb3IoYCAgLSAjJHtwci5udW1iZXJ9OiAke3ByLnRpdGxlfWApO1xuICB9XG4gIExvZy5lcnJvci5ncm91cEVuZCgpO1xuICBwcm9jZXNzLmV4aXQoMSk7XG59XG4iXX0=