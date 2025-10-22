import { GithubConfig, NgDevConfig } from '../../utils/config.js';
export type GithubApiMergeMethod = 'merge' | 'squash' | 'rebase';
export interface GithubApiMergeStrategyConfig {
    default: GithubApiMergeMethod;
    labels?: {
        pattern: string;
        method: GithubApiMergeMethod;
    }[];
}
export type PullRequestConfig = {
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
} & {
    conditionalAutosquashMerge?: boolean;
    githubApiMerge: GithubApiMergeStrategyConfig;
};
export declare function assertValidPullRequestConfig<T extends NgDevConfig>(config: T & Partial<{
    pullRequest: PullRequestConfig;
}>): asserts config is T & {
    pullRequest: PullRequestConfig;
};
export interface PullRequestValidationConfig {
    [key: `assert${string}`]: boolean;
}
