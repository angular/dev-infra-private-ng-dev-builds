import { AuthenticatedGitClient } from '../../../utils/git/authenticated-git-client.js';
import { GithubApiMergeStrategyConfig } from '../../config/index.js';
import { PullRequest } from '../pull-request.js';
import { AutosquashMergeStrategy } from './autosquash-merge.js';
export declare class GithubApiMergeStrategy extends AutosquashMergeStrategy {
    private config;
    constructor(git: AuthenticatedGitClient, config: GithubApiMergeStrategyConfig);
    merge(pullRequest: PullRequest): Promise<void>;
    private _promptCommitMessageEdit;
    private _getDefaultSquashCommitMessage;
    private getMergeActionFromPullRequest;
    private hasFixupOrSquashCommits;
}
