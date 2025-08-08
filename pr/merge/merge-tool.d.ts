import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { PullRequestConfig, PullRequestValidationConfig } from '../config/index.js';
import { GithubConfig, NgDevConfig } from '../../utils/config.js';
export interface PullRequestMergeFlags {
    branchPrompt: boolean;
    forceManualBranches: boolean;
    dryRun: boolean;
    ignorePendingReviews: boolean;
}
export declare class MergeTool {
    config: NgDevConfig<{
        pullRequest: PullRequestConfig;
        github: GithubConfig;
    }>;
    git: AuthenticatedGitClient;
    private flags;
    constructor(config: NgDevConfig<{
        pullRequest: PullRequestConfig;
        github: GithubConfig;
    }>, git: AuthenticatedGitClient, flags: Partial<PullRequestMergeFlags>);
    merge(prNumber: number, partialValidationConfig: PullRequestValidationConfig): Promise<void>;
    private updatePullRequestTargetedBranchesFromPrompt;
    confirmMergeAccess(): Promise<void>;
}
