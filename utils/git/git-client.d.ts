import { GithubConfig } from '../config.js';
import { SpawnSyncOptions, SpawnSyncReturns } from 'child_process';
import { GithubClient } from './github.js';
export declare class GitCommandError extends Error {
    constructor(client: GitClient, unsanitizedArgs: string[]);
}
type GitCommandRunOptions = SpawnSyncOptions;
export declare class GitClient {
    readonly baseDir: string;
    readonly remoteConfig: GithubConfig;
    readonly remoteParams: {
        owner: string;
        repo: string;
    };
    readonly mainBranchName: string;
    readonly github: GithubClient;
    readonly config: {
        github: GithubConfig;
    };
    readonly gitBinPath: string;
    constructor(config: {
        github: GithubConfig;
    }, baseDir?: string);
    run(args: string[], options?: GitCommandRunOptions): Omit<SpawnSyncReturns<string>, 'status'>;
    runGraceful(args: string[], options?: GitCommandRunOptions): SpawnSyncReturns<string>;
    getRepoGitUrl(): string;
    hasCommit(branchName: string, sha: string): boolean;
    isShallowRepo(): boolean;
    getCurrentBranchOrRevision(): string;
    hasUncommittedChanges(): boolean;
    checkout(branchOrRevision: string, cleanState: boolean): boolean;
    allChangesFilesSince(shaOrRef?: string): string[];
    allStagedFiles(): string[];
    allFiles(): string[];
    sanitizeConsoleOutput(value: string): string;
    private static _unauthenticatedInstance;
    static get(): Promise<GitClient>;
}
export {};
