import { GithubConfig } from '../../utils/config.js';
import { ReleaseConfig } from '../config/index.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
export interface ReleaseRecoverCiPublishToolOptions {
    dryRun?: boolean;
    publishRegistry?: string;
}
export declare class ReleaseRecoverCiPublishTool {
    private git;
    private releaseConfig;
    private githubConfig;
    private runId;
    private options;
    constructor(git: AuthenticatedGitClient, releaseConfig: ReleaseConfig, githubConfig: GithubConfig, runId: number, options?: ReleaseRecoverCiPublishToolOptions);
    run(): Promise<void>;
    private _verifyNpmLoginState;
}
