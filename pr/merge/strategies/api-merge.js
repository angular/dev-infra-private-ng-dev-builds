import { parseCommitMessage } from '../../../commit-message/parse.js';
import { MergeStrategy } from './strategy.js';
import { isGithubApiError } from '../../../utils/git/github.js';
import { FatalMergeToolError, MergeConflictsFatalError } from '../failures.js';
import { Prompt } from '../../../utils/prompt.js';
const COMMIT_HEADER_SEPARATOR = '\n\n';
export class GithubApiMergeStrategy extends MergeStrategy {
    constructor(git, _config) {
        super(git);
        this._config = _config;
    }
    async merge(pullRequest) {
        const { githubTargetBranch, prNumber, needsCommitMessageFixup, targetBranches } = pullRequest;
        const method = this._getMergeActionFromPullRequest(pullRequest);
        const cherryPickTargetBranches = targetBranches.filter((b) => b !== githubTargetBranch);
        const mergeOptions = {
            pull_number: prNumber,
            merge_method: method,
            ...this.git.remoteParams,
        };
        if (needsCommitMessageFixup) {
            if (method !== 'squash') {
                throw new FatalMergeToolError(`Unable to fixup commit message of pull request. Commit message can only be ` +
                    `modified if the PR is merged using squash.`);
            }
            await this._promptCommitMessageEdit(pullRequest, mergeOptions);
        }
        let mergeStatusCode;
        let mergeResponseMessage;
        let targetSha;
        try {
            const result = await this.git.github.pulls.merge(mergeOptions);
            mergeStatusCode = result.status;
            mergeResponseMessage = result.data.message;
            targetSha = result.data.sha;
        }
        catch (e) {
            if (isGithubApiError(e) && (e.status === 403 || e.status === 404)) {
                throw new FatalMergeToolError('Insufficient Github API permissions to merge pull request.');
            }
            throw e;
        }
        if (mergeStatusCode === 405) {
            throw new MergeConflictsFatalError([githubTargetBranch]);
        }
        if (mergeStatusCode !== 200) {
            throw new FatalMergeToolError(`Unexpected merge status code: ${mergeStatusCode}: ${mergeResponseMessage}`);
        }
        if (!cherryPickTargetBranches.length) {
            return;
        }
        this.fetchTargetBranches([githubTargetBranch]);
        const targetCommitsCount = method === 'squash' ? 1 : pullRequest.commitCount;
        const failedBranches = await this.cherryPickIntoTargetBranches(`${targetSha}~${targetCommitsCount}..${targetSha}`, cherryPickTargetBranches, {
            linkToOriginalCommits: true,
        });
        if (failedBranches.length) {
            throw new MergeConflictsFatalError(failedBranches);
        }
        this.pushTargetBranchesUpstream(cherryPickTargetBranches);
        await this.git.github.issues.createComment({
            ...this.git.remoteParams,
            issue_number: pullRequest.prNumber,
            body: `The changes were merged into the following branches: ${targetBranches.join(', ')}`,
        });
    }
    async _promptCommitMessageEdit(pullRequest, mergeOptions) {
        const commitMessage = await this._getDefaultSquashCommitMessage(pullRequest);
        const result = await Prompt.editor({
            message: 'Please update the commit message',
            default: commitMessage,
        });
        const [newTitle, ...newMessage] = result.split(COMMIT_HEADER_SEPARATOR);
        mergeOptions.commit_title = `${newTitle} (#${pullRequest.prNumber})`;
        mergeOptions.commit_message = newMessage.join(COMMIT_HEADER_SEPARATOR);
    }
    async _getDefaultSquashCommitMessage(pullRequest) {
        const commits = (await this._getPullRequestCommitMessages(pullRequest)).map((message) => ({
            message,
            parsed: parseCommitMessage(message),
        }));
        const messageBase = `${pullRequest.title}${COMMIT_HEADER_SEPARATOR}`;
        if (commits.length <= 1) {
            return `${messageBase}${commits[0].parsed.body}`;
        }
        const joinedMessages = commits.map((c) => `* ${c.message}`).join(COMMIT_HEADER_SEPARATOR);
        return `${messageBase}${joinedMessages}`;
    }
    async _getPullRequestCommitMessages({ prNumber }) {
        const allCommits = await this.git.github.paginate(this.git.github.pulls.listCommits, {
            ...this.git.remoteParams,
            pull_number: prNumber,
        });
        return allCommits.map(({ commit }) => commit.message);
    }
    _getMergeActionFromPullRequest({ labels }) {
        if (this._config.labels) {
            const matchingLabel = this._config.labels.find(({ pattern }) => labels.includes(pattern));
            if (matchingLabel !== undefined) {
                return matchingLabel.method;
            }
        }
        return this._config.default;
    }
}
//# sourceMappingURL=api-merge.js.map