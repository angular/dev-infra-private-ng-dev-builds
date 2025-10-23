import { AuthenticatedGitClient } from '../../../utils/git/authenticated-git-client.js';
import { GithubApiMergeStrategyConfig } from '../../config/index.js';
import { PullRequest } from '../pull-request.js';
import { AutosquashMergeStrategy } from './autosquash-merge.js';
import { Commit } from '../../../commit-message/parse.js';
interface PullRequestCommit {
    message: string;
    parsed: Commit;
}
export declare class GithubApiMergeStrategy extends AutosquashMergeStrategy {
    private config;
    constructor(git: AuthenticatedGitClient, config: GithubApiMergeStrategyConfig);
    merge(pullRequest: PullRequest): Promise<void>;
    private _promptCommitMessageEdit;
    private getDefaultSquashCommitMessage;
    private getMergeActionFromPullRequest;
    private getCommitsInfo;
    private commits;
    protected getPullRequestCommits({ prNumber }: PullRequest): Promise<PullRequestCommit[]>;
}
export {};
