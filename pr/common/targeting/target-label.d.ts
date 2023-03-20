/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { PullRequestConfig } from '../../config/index.js';
import { GithubConfig, NgDevConfig } from '../../../utils/config.js';
import { GithubClient } from '../../../utils/git/github.js';
import { ActiveReleaseTrains } from '../../../release/versioning/index.js';
import { TargetLabel } from '../labels/target.js';
/** Type describing the determined target of a pull request. */
export interface PullRequestTarget {
    /** Branches which the pull request targets. */
    branches: string[];
    /** Target label applied to the pull request. */
    label: TargetLabel;
}
/**
 * Configuration for a target label. The config is responsible for
 * mapping a label to its branches.
 */
export interface TargetLabelConfig {
    /** Target label for which the config applies to. */
    label: TargetLabel;
    /**
     * List of branches a pull request with this target label should be merged into.
     * Can also be wrapped in a function that accepts the target branch specified in the
     * Github Web UI. This is useful for supporting labels like `target: development-branch`.
     *
     * @throws {InvalidTargetLabelError} Invalid label has been applied to pull request.
     * @throws {InvalidTargetBranchError} Invalid Github target branch has been selected.
     */
    branches: (githubTargetBranch: string) => string[] | Promise<string[]>;
}
/**
 * Unique error that will be thrown if an invalid branch is targeted.
 */
export declare class InvalidTargetBranchError {
    failureMessage: string;
    constructor(failureMessage: string);
}
/**
 * Unique error that will be thrown if an invalid label has been
 * applied to a pull request.
 */
export declare class InvalidTargetLabelError {
    failureMessage: string;
    constructor(failureMessage: string);
}
/**
 * Gets the matching target label config based on pull request labels.
 *
 * @throws {InvalidTargetLabelError} An invalid target label error is thrown
 *   if no single valid target label is applied.
 */
export declare function getMatchingTargetLabelConfigForPullRequest(labelsOnPullRequest: string[], labelConfigs: TargetLabelConfig[]): Promise<TargetLabelConfig>;
/**
 * Gets the target branches and label of the given pull request.
 *
 * @throws {InvalidTargetLabelError} An invalid target label error is thrown
 *   if no single valid target label is applied.
 */
export declare function getTargetBranchesAndLabelForPullRequest(activeReleaseTrains: ActiveReleaseTrains, github: GithubClient, config: NgDevConfig<{
    pullRequest: PullRequestConfig;
    github: GithubConfig;
}>, labelsOnPullRequest: string[], githubTargetBranch: string): Promise<PullRequestTarget>;
/**
 * Gets the branches for the specified target label config.
 *
 * @throws {InvalidTargetLabelError} Invalid label has been applied to pull request.
 * @throws {InvalidTargetBranchError} Invalid Github target branch has been selected.
 */
export declare function getBranchesForTargetLabel(labelConfig: TargetLabelConfig, githubTargetBranch: string): Promise<string[]>;
