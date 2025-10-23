import { isGithubApiError } from '../../../utils/git/github.js';
import { FatalMergeToolError, MergeConflictsFatalError } from '../failures.js';
import { Prompt } from '../../../utils/prompt.js';
import { AutosquashMergeStrategy } from './autosquash-merge.js';
import { parseCommitMessage } from '../../../commit-message/parse.js';
import { TEMP_PR_HEAD_BRANCH } from './strategy.js';
const COMMIT_HEADER_SEPARATOR = '\n\n';
export class GithubApiMergeStrategy extends AutosquashMergeStrategy {
    constructor(git, config) {
        super(git);
        this.config = config;
    }
    async merge(pullRequest) {
        const { githubTargetBranch, prNumber, needsCommitMessageFixup, targetBranches } = pullRequest;
        const cherryPickTargetBranches = targetBranches.filter((b) => b !== githubTargetBranch);
        const commits = await this.getPullRequestCommits(pullRequest);
        const { squashCount, fixupCount, normalCommitsCount } = await this.getCommitsInfo(pullRequest);
        const method = this.getMergeActionFromPullRequest(pullRequest);
        const mergeOptions = {
            pull_number: prNumber,
            merge_method: method === 'auto' ? 'rebase' : method,
            ...this.git.remoteParams,
        };
        if (method === 'auto') {
            const hasFixUpOrSquashAndMultipleCommits = normalCommitsCount > 1 && (fixupCount > 0 || squashCount > 0);
            if (needsCommitMessageFixup || hasFixUpOrSquashAndMultipleCommits) {
                return super.merge(pullRequest);
            }
            const hasOnlyFixUpForOneCommit = normalCommitsCount === 1 && fixupCount > 0 && squashCount === 0;
            const hasOnlySquashForOneCommit = normalCommitsCount === 1 && squashCount > 1;
            if (hasOnlyFixUpForOneCommit) {
                mergeOptions.merge_method = 'squash';
                const [title, message = ''] = commits[0].message.split(COMMIT_HEADER_SEPARATOR);
                mergeOptions.commit_title = title;
                mergeOptions.commit_message = message;
            }
            else if (hasOnlySquashForOneCommit) {
                mergeOptions.merge_method = 'squash';
                await this._promptCommitMessageEdit(pullRequest, mergeOptions);
            }
        }
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
        this.git.run(['checkout', TEMP_PR_HEAD_BRANCH]);
        this.fetchTargetBranches([githubTargetBranch]);
        if (!cherryPickTargetBranches.length) {
            await this.createMergeComment(pullRequest, targetBranches);
            return;
        }
        const pullRequestCommitCount = mergeOptions.merge_method === 'rebase' ? pullRequest.commitCount : 1;
        const failedBranches = await this.cherryPickIntoTargetBranches(`${targetSha}~${pullRequestCommitCount}..${targetSha}`, cherryPickTargetBranches, {
            linkToOriginalCommits: true,
        });
        if (failedBranches.length) {
            throw new MergeConflictsFatalError(failedBranches);
        }
        this.pushTargetBranchesUpstream(cherryPickTargetBranches);
        await this.createMergeComment(pullRequest, targetBranches);
    }
    async _promptCommitMessageEdit(pullRequest, mergeOptions) {
        const commitMessage = await this.getDefaultSquashCommitMessage(pullRequest);
        const result = await Prompt.editor({
            message: 'Please update the commit message',
            default: commitMessage,
        });
        const [newTitle, ...newMessage] = result.split(COMMIT_HEADER_SEPARATOR);
        mergeOptions.commit_title = `${newTitle} (#${pullRequest.prNumber})`;
        mergeOptions.commit_message = newMessage.join(COMMIT_HEADER_SEPARATOR);
    }
    async getDefaultSquashCommitMessage(pullRequest) {
        const commits = await this.getPullRequestCommits(pullRequest);
        const messageBase = `${pullRequest.title}${COMMIT_HEADER_SEPARATOR}`;
        if (commits.length <= 1) {
            return `${messageBase}${commits[0].parsed.body}`;
        }
        const joinedMessages = commits.map((c) => `* ${c.message}`).join(COMMIT_HEADER_SEPARATOR);
        return `${messageBase}${joinedMessages}`;
    }
    getMergeActionFromPullRequest({ labels }) {
        if (this.config.labels) {
            const matchingLabel = this.config.labels.find(({ pattern }) => labels.includes(pattern));
            if (matchingLabel !== undefined) {
                return matchingLabel.method;
            }
        }
        return this.config.default;
    }
    async getCommitsInfo(pullRequest) {
        const commits = await this.getPullRequestCommits(pullRequest);
        const commitsInfo = {
            fixupCount: 0,
            squashCount: 0,
            normalCommitsCount: 1,
        };
        if (commits.length === 1) {
            return commitsInfo;
        }
        for (let index = 1; index < commits.length; index++) {
            const { parsed: { isFixup, isSquash }, } = commits[index];
            if (isFixup) {
                commitsInfo.fixupCount++;
            }
            else if (isSquash) {
                commitsInfo.squashCount++;
            }
            else {
                commitsInfo.normalCommitsCount++;
            }
        }
        return commitsInfo;
    }
    async getPullRequestCommits({ prNumber }) {
        if (this.commits) {
            return this.commits;
        }
        const allCommits = await this.git.github.paginate(this.git.github.pulls.listCommits, {
            ...this.git.remoteParams,
            pull_number: prNumber,
        });
        this.commits = allCommits.map(({ commit: { message } }) => ({
            message,
            parsed: parseCommitMessage(message),
        }));
        return this.commits;
    }
}
//# sourceMappingURL=api-merge.js.map