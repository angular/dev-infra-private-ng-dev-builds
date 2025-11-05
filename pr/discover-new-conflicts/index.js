import { Bar } from 'cli-progress';
import { Log } from '../../utils/logging.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { GitCommandError } from '../../utils/git/git-client.js';
import { fetchPendingPullRequestsFromGithub, } from '../common/fetch-pull-request.js';
const tempWorkingBranch = '__NgDevRepoBaseAfterChange__';
export async function discoverNewConflictsForPr(newPrNumber, updatedAfter) {
    const git = await AuthenticatedGitClient.get();
    if (git.hasUncommittedChanges()) {
        Log.error('Cannot run with local changes. Please make sure there are no local changes.');
        process.exit(1);
    }
    const previousBranchOrRevision = git.getCurrentBranchOrRevision();
    const progressBar = new Bar({ format: `[{bar}] ETA: {eta}s | {value}/{total}` });
    const conflicts = [];
    Log.info(`Requesting pending PRs from Github`);
    const allPendingPRs = await fetchPendingPullRequestsFromGithub(git);
    if (allPendingPRs === null) {
        Log.error('Unable to find any pending PRs in the repository');
        process.exit(1);
    }
    const requestedPr = allPendingPRs.find((pr) => pr.number === newPrNumber);
    if (requestedPr === undefined) {
        Log.error(`The request PR, #${newPrNumber} was not found as a pending PR on github, please confirm`);
        Log.error(`the PR number is correct and is an open PR`);
        process.exit(1);
    }
    const pendingPrs = allPendingPRs.filter((pr) => {
        return (pr.baseRef.name === requestedPr.baseRef.name &&
            pr.mergeable !== 'CONFLICTING' &&
            new Date(pr.updatedAt).getTime() >= updatedAfter);
    });
    Log.info(`Retrieved ${allPendingPRs.length} total pending PRs`);
    Log.info(`Checking ${pendingPrs.length} PRs for conflicts after a merge of #${newPrNumber}`);
    git.run(['fetch', '-q', requestedPr.headRef.repository.url, requestedPr.headRef.name]);
    git.run(['checkout', '-q', '-B', tempWorkingBranch, 'FETCH_HEAD']);
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
    progressBar.start(pendingPrs.length, 0);
    for (const pr of pendingPrs) {
        git.run(['fetch', '-q', pr.headRef.repository.url, pr.headRef.name]);
        git.run(['checkout', '-q', '--detach', 'FETCH_HEAD']);
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
        git.runGraceful(['rebase', '--abort'], { stdio: 'ignore' });
        progressBar.increment(1);
    }
    progressBar.stop();
    Log.info();
    Log.info(`Result:`);
    git.checkout(previousBranchOrRevision, true);
    if (conflicts.length === 0) {
        Log.info(`No new conflicting PRs found after #${newPrNumber} merging`);
        process.exit(0);
    }
    Log.error(`${conflicts.length} PR(s) which conflict(s) after #${newPrNumber} merges:`);
    for (const pr of conflicts) {
        Log.error(`  - #${pr.number}: ${pr.title}`);
    }
    process.exit(1);
}
//# sourceMappingURL=index.js.map