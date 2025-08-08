import { CaretakerConfig, GithubConfig } from './config.js';
import { SyncFileMatchFn } from './g3-sync-config.js';
import { AuthenticatedGitClient } from './git/authenticated-git-client.js';
export interface G3StatsData {
    insertions: number;
    deletions: number;
    files: number;
    separateFiles: number;
    commits: number;
}
export declare class G3Stats {
    static retrieveDiffStats(git: AuthenticatedGitClient, config: {
        caretaker: CaretakerConfig;
        github: GithubConfig;
    }): Promise<G3StatsData | undefined>;
    static getDiffStats(git: AuthenticatedGitClient, g3Ref: string, mainRef: string, syncMatchFns: {
        ngMatchFn: SyncFileMatchFn;
        separateMatchFn: SyncFileMatchFn;
    }): G3StatsData;
    static getShaForBranchLatest(git: AuthenticatedGitClient, branch: string): string | null;
    static getG3SyncFileMatchFns(git: AuthenticatedGitClient, configs: {
        caretaker: CaretakerConfig;
        github: GithubConfig;
    }): Promise<null | {
        ngMatchFn: SyncFileMatchFn;
        separateMatchFn: SyncFileMatchFn;
    }>;
    static getLatestShas(git: AuthenticatedGitClient): {
        g3: string;
        main: string;
    } | null;
}
