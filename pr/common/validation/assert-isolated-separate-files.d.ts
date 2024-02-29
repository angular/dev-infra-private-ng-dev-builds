/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { GithubConfig, GoogleSyncConfig, NgDevConfig } from '../../../utils/config.js';
import { AuthenticatedGitClient } from '../../../utils/git/authenticated-git-client.js';
/** Assert the pull request has passing enforced statuses. */
export declare const isolatedSeparateFilesValidation: {
    run(validationConfig: import("../../config/index.js").PullRequestValidationConfig, config: NgDevConfig<{
        github: GithubConfig;
    }>, prNumber: number, gitClient: AuthenticatedGitClient): Promise<import("./validation-failure.js").PullRequestValidationFailure | null>;
};
export declare class PullRequestFiles {
    private git;
    private prNumber;
    private config;
    constructor(git: AuthenticatedGitClient, prNumber: number, config: GoogleSyncConfig);
    /**
     * Loads the files from a given pull request.
     */
    loadPullRequestFiles(): Promise<string[]>;
    /**
     * checks for separate files against the pull request files
     */
    pullRequestHasSeparateFiles(): Promise<boolean>;
    static create(git: AuthenticatedGitClient, prNumber: number, config: GoogleSyncConfig): PullRequestFiles;
}
