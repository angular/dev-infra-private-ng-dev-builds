import { ReleaseConfig } from '../config/index.js';
import { GithubConfig, NgDevConfig } from '../../utils/config.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
export interface PublishCiToolOptions {
    builtPackagesDir: string;
    expectedSha: string;
    dryRun?: boolean;
}
export declare class PublishCiTool {
    protected config: NgDevConfig<{
        release: ReleaseConfig;
        github: GithubConfig;
    }>;
    protected git: AuthenticatedGitClient;
    protected projectDir: string;
    protected options: PublishCiToolOptions;
    constructor(config: NgDevConfig<{
        release: ReleaseConfig;
        github: GithubConfig;
    }>, git: AuthenticatedGitClient, projectDir: string, options: PublishCiToolOptions);
    run(): Promise<void>;
    private assertExpectedSha;
    private getBeforeStagingSha;
    private getPreviousVersionTag;
    private createGithubReleaseAndTags;
    private publishAndDeprecatePackages;
}
