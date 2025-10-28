import { GithubConfig, NgDevConfig } from '../../utils/config.js';
export type GithubApiMergeMethod = 'merge' | 'squash' | 'rebase' | 'auto';
export interface GithubApiMergeStrategyConfig {
    default: GithubApiMergeMethod;
    labels?: {
        pattern: string;
        method: GithubApiMergeMethod;
    }[];
}
export interface PullRequestConfig {
    remote?: GithubConfig;
    requiredBaseCommits?: {
        [branchName: string]: string;
    };
    requiredStatuses?: {
        type: 'check' | 'status';
        name: string;
    }[];
    githubApiMerge: false | GithubApiMergeStrategyConfig;
    targetLabelExemptScopes?: string[];
    validators?: PullRequestValidationConfig;
    __noTargetLabeling?: boolean;
}
export declare function assertValidPullRequestConfig<T extends NgDevConfig>(config: T & Partial<{
    pullRequest: PullRequestConfig;
}>): asserts config is T & {
    pullRequest: PullRequestConfig;
};
export interface PullRequestValidationConfig {
    [key: `assert${string}`]: boolean;
}
