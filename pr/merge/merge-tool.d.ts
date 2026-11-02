import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { PullRequestConfig, PullRequestValidationConfig } from '../config/index.js';
import { PullRequestMergeResult } from './messages.js';
import { PullRequest } from './pull-request.js';
import { MergeStrategy } from './strategies/strategy.js';
import { GithubConfig, NgDevConfig } from '../../utils/config.js';
export type { PullRequestMergeResult } from './messages.js';
export interface PullRequestMergeFlags {
    branchPrompt: boolean;
    forceManualBranches: boolean;
    dryRun: boolean;
    ignorePendingReviews: boolean;
    waitForValidations: boolean;
}
export declare function getErrorMessage(error: unknown): string;
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
    mergeMany(prNumbers: number[], partialValidationConfig: PullRequestValidationConfig): Promise<PullRequestMergeResult[]>;
    private updatePullRequestTargetedBranchesFromPrompt;
    checkCaretakerNoteConfirmation(pullRequest: PullRequest): Promise<void>;
    getCaretakerNote(pullRequest: PullRequest): Promise<string | undefined>;
    confirmMergeAccess(): Promise<void>;
    loadAndValidatePullRequest(prNumber: number, validationConfig: PullRequestValidationConfig): Promise<PullRequest>;
    assertPullRequestValidation(pullRequest: PullRequest): Promise<void>;
    getMergeStrategy(pullRequest: PullRequest): MergeStrategy;
}
