/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { PullRequestValidationConfig } from '../common/validation/validation-config.js';
import { PullRequestValidationFailure } from '../common/validation/validation-failure.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { GithubConfig, NgDevConfig } from '../../utils/config.js';
import { PullRequestConfig } from '../config/index.js';
/** Interface that describes a pull request. */
export interface PullRequest {
    /** URL to the pull request. */
    url: string;
    /** Number of the pull request. */
    prNumber: number;
    /** Title of the pull request. */
    title: string;
    /** Labels applied to the pull request. */
    labels: string[];
    /** List of branches this PR should be merged into. */
    targetBranches: string[];
    /** Branch that the PR targets in the Github UI. */
    githubTargetBranch: string;
    /** Count of commits in this pull request. */
    commitCount: number;
    /** Optional SHA that this pull request needs to be based on. */
    requiredBaseSha?: string;
    /** Whether the pull request commit message fixup. */
    needsCommitMessageFixup: boolean;
    /** Whether the pull request has a caretaker note. */
    hasCaretakerNote: boolean;
    /** The SHA for the first commit the pull request is based on. */
    baseSha: string;
    /** Git revision range that matches the pull request commits. */
    revisionRange: string;
    /** A list of validation failures found for the pull request, empty if no failures are discovered. */
    validationFailures: PullRequestValidationFailure[];
    /** The SHA for the latest commit in the pull request. */
    headSha: string;
}
/**
 * Loads and validates the specified pull request against the given configuration.
 * If the pull requests fails, a pull request failure is returned.
 *
 * @throws {FatalMergeToolError} A fatal error might be thrown when e.g. the pull request
 *   does not exist upstream.
 * @throws {InvalidTargetLabelError} Error thrown if an invalid target label is applied.
 * @throws {InvalidTargetBranchError} Error thrown if an invalid GitHub PR destination branch
 *   is selected.
 */
export declare function loadAndValidatePullRequest({ git, config, }: {
    git: AuthenticatedGitClient;
    config: NgDevConfig<{
        pullRequest: PullRequestConfig;
        github: GithubConfig;
    }>;
}, prNumber: number, validationConfig: PullRequestValidationConfig): Promise<PullRequest>;
