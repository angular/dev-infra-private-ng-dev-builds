import { getCommitsInRange } from '../../commit-message/utils.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { addTokenToGitHttpsUrl } from '../../utils/git/github-urls.js';
import { Log } from '../../utils/logging.js';
import { Prompt } from '../../utils/prompt.js';
import { fetchPullRequestFromGithub } from '../common/fetch-pull-request.js';
export async function rebasePr(prNumber, interactive = false) {
    const git = await AuthenticatedGitClient.get();
    if (git.hasUncommittedChanges()) {
        Log.error('Cannot perform rebase of PR with local changes.');
        return 1;
    }
    const previousBranchOrRevision = git.getCurrentBranchOrRevision();
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
    const forceWithLeaseFlag = `--force-with-lease=${headRefName}:${pr.headRefOid}`;
    if (!pr.maintainerCanModify && !pr.viewerDidAuthor) {
        Log.error(`Cannot rebase as you did not author the PR and the PR does not allow maintainers` +
            `to modify the PR`);
        return 1;
    }
    try {
        Log.info(`Checking out PR #${prNumber} from ${fullHeadRef}`);
        git.run(['fetch', '-q', headRefUrl, headRefName, '--deepen=500']);
        git.run(['checkout', '-q', '--detach', 'FETCH_HEAD']);
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
        const env = squashFixups && !interactive ? { ...process.env, GIT_SEQUENCE_EDITOR: 'true' } : undefined;
        let flags = [];
        if (squashFixups || interactive) {
            flags.push('--interactive');
        }
        if (squashFixups) {
            flags.push('--autosquash');
        }
        const rebaseResult = git.runGraceful(['rebase', ...flags, 'FETCH_HEAD'], { env: env });
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
    Log.info(`Rebase was unable to complete automatically without conflicts.`);
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
//# sourceMappingURL=index.js.map