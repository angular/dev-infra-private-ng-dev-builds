import { PullRequestConfig } from '../../config/index.js';
import { GithubConfig, NgDevConfig } from '../../../utils/config.js';
import { GithubClient } from '../../../utils/git/github.js';
import { ActiveReleaseTrains } from '../../../release/versioning/index.js';
import { TargetLabel } from '../labels/target.js';
export interface PullRequestTarget {
    branches: string[];
    label: TargetLabel;
}
export interface TargetLabelConfig {
    label: TargetLabel;
    branches: (githubTargetBranch: string) => string[] | Promise<string[]>;
}
export declare class InvalidTargetBranchError {
    failureMessage: string;
    constructor(failureMessage: string);
}
export declare class InvalidTargetLabelError {
    failureMessage: string;
    constructor(failureMessage: string);
}
export declare function getMatchingTargetLabelConfigForPullRequest(labelsOnPullRequest: string[], labelConfigs: TargetLabelConfig[]): Promise<TargetLabelConfig>;
export declare function getTargetBranchesAndLabelForPullRequest(activeReleaseTrains: ActiveReleaseTrains, github: GithubClient, config: NgDevConfig<{
    pullRequest: PullRequestConfig;
    github: GithubConfig;
}>, labelsOnPullRequest: string[], githubTargetBranch: string): Promise<PullRequestTarget>;
export declare function getBranchesForTargetLabel(labelConfig: TargetLabelConfig, githubTargetBranch: string): Promise<string[]>;
