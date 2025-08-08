import { AuthenticatedGitClient } from '../../../utils/git/authenticated-git-client.js';
import { GithubApiMergeStrategyConfig } from '../../config/index.js';
import { PullRequest } from '../pull-request.js';
import { MergeStrategy } from './strategy.js';
export declare class GithubApiMergeStrategy extends MergeStrategy {
    private _config;
    constructor(git: AuthenticatedGitClient, _config: GithubApiMergeStrategyConfig);
    merge(pullRequest: PullRequest): Promise<void>;
    private _promptCommitMessageEdit;
    private _getDefaultSquashCommitMessage;
    private _getPullRequestCommitMessages;
    private _getMergeActionFromPullRequest;
}
