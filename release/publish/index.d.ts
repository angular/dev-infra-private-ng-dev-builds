import { GithubConfig } from '../../utils/config.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { ReleaseConfig } from '../config/index.js';
export declare enum CompletionState {
    SUCCESS = 0,
    FATAL_ERROR = 1,
    MANUALLY_ABORTED = 2
}
export interface ReleaseToolFlags {
    publishRegistry?: string;
}
export declare class ReleaseTool {
    protected _git: AuthenticatedGitClient;
    protected _github: GithubConfig;
    protected _projectRoot: string;
    private previousGitBranchOrRevision;
    protected _config: ReleaseConfig;
    constructor(_git: AuthenticatedGitClient, config: ReleaseConfig, _github: GithubConfig, _projectRoot: string, _flags: ReleaseToolFlags);
    run(): Promise<CompletionState>;
    private cleanup;
    private _promptForReleaseAction;
    private _verifyNoUncommittedChanges;
    private _verifyInReleaseMergeMode;
    private _verifyNoShallowRepository;
    private _verifyRunningFromNextBranch;
    private _verifyNpmLoginState;
}
