import { types as graphqlTypes } from 'typed-graphqlify';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { addTokenToGitHttpsUrl } from '../../utils/git/github-urls.js';
import { getPr } from '../../utils/github.js';
const PR_SCHEMA = {
    author: {
        login: graphqlTypes.string,
    },
    state: graphqlTypes.string,
    maintainerCanModify: graphqlTypes.boolean,
    viewerDidAuthor: graphqlTypes.boolean,
    headRefOid: graphqlTypes.string,
    headRef: {
        name: graphqlTypes.string,
        repository: {
            url: graphqlTypes.string,
            nameWithOwner: graphqlTypes.string,
        },
    },
    baseRefOid: graphqlTypes.string,
    baseRef: {
        name: graphqlTypes.string,
        repository: {
            url: graphqlTypes.string,
            nameWithOwner: graphqlTypes.string,
        },
    },
};
export class UnexpectedLocalChangesError extends Error {
}
export class PullRequestNotFoundError extends Error {
}
export class MaintainerModifyAccessError extends Error {
}
export async function checkOutPullRequestLocally(prNumber, opts = {}) {
    const git = await AuthenticatedGitClient.get();
    if (git.hasUncommittedChanges()) {
        throw new UnexpectedLocalChangesError('Unable to checkout PR due to uncommitted changes.');
    }
    const previousBranchOrRevision = git.getCurrentBranchOrRevision();
    const pr = await getPr(PR_SCHEMA, prNumber, git);
    if (pr === null) {
        throw new PullRequestNotFoundError(`Pull request #${prNumber} could not be found.`);
    }
    const headRefName = pr.headRef.name;
    const headRefUrl = addTokenToGitHttpsUrl(pr.headRef.repository.url, git.githubToken);
    const forceWithLeaseFlag = `--force-with-lease=${headRefName}:${pr.headRefOid}`;
    if (!pr.maintainerCanModify && !pr.viewerDidAuthor && !opts.allowIfMaintainerCannotModify) {
        throw new MaintainerModifyAccessError('PR is not set to allow maintainers to modify the PR');
    }
    try {
        git.run(['fetch', '-q', headRefUrl, headRefName]);
        git.run(['checkout', '--detach', 'FETCH_HEAD']);
    }
    catch (e) {
        git.checkout(previousBranchOrRevision, true);
        throw e;
    }
    return {
        pushToUpstream: () => {
            git.run(['push', headRefUrl, `HEAD:${headRefName}`, forceWithLeaseFlag]);
            return true;
        },
        resetGitState: () => {
            return git.checkout(previousBranchOrRevision, true);
        },
        pushToUpstreamCommand: `git push ${pr.headRef.repository.url} HEAD:${headRefName} ${forceWithLeaseFlag}`,
        resetGitStateCommand: `git rebase --abort && git reset --hard && git checkout ${previousBranchOrRevision}`,
        pullRequest: pr,
    };
}
//# sourceMappingURL=checkout-pr.js.map