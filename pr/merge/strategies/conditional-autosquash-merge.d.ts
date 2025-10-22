import { AuthenticatedGitClient } from '../../../utils/git/authenticated-git-client.js';
import { GithubApiMergeStrategyConfig } from '../../config/index.js';
import { PullRequest } from '../pull-request.js';
import { MergeStrategy } from './strategy.js';
export declare class ConditionalAutosquashMergeStrategy extends MergeStrategy {
    private config;
    private readonly githubApiMergeStrategy;
    constructor(git: AuthenticatedGitClient, config: GithubApiMergeStrategyConfig);
    merge(pullRequest: PullRequest): Promise<void>;
    private hasFixupOrSquashCommits;
}
