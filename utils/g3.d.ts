/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CaretakerConfig, GithubConfig } from './config.js';
import { SyncFileMatchFn } from './g3-sync-config.js';
import { AuthenticatedGitClient } from './git/authenticated-git-client.js';
/** Information expressing the difference between the main and g3 branches */
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
    /**
     * Get git diff stats between main and g3, for all files and filtered to only g3 affecting
     * files.
     */
    static getDiffStats(git: AuthenticatedGitClient, g3Ref: string, mainRef: string, syncMatchFns: {
        ngMatchFn: SyncFileMatchFn;
        separateMatchFn: SyncFileMatchFn;
    }): G3StatsData;
    /** Fetch and retrieve the latest sha for a specific branch. */
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
