import { GithubConfig, GoogleSyncConfig, NgDevConfig } from '../../../utils/config.js';
import { AuthenticatedGitClient } from '../../../utils/git/authenticated-git-client.js';
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
    loadPullRequestFiles(): Promise<string[]>;
    pullRequestHasSeparateFiles(): Promise<boolean>;
    static create(git: AuthenticatedGitClient, prNumber: number, config: GoogleSyncConfig): PullRequestFiles;
}
