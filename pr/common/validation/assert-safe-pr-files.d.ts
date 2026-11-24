import { GitClient } from '../../../utils/git/git-client.js';
export declare class ForbiddenPullRequestPathsError extends Error {
    readonly forbiddenPaths: string[];
    constructor(forbiddenPaths: string[]);
}
export declare class MismatchedFetchedHeadShaError extends Error {
    readonly expectedSha: string;
    readonly actualSha: string;
    constructor(expectedSha: string, actualSha: string);
}
export declare function extractNodeModulesPaths(gitNulPathsOutput: string): string[];
export declare function assertNoNodeModulesInTree(git: GitClient, revision: string): void;
export declare function assertNoNodeModulesInCommitRange(git: GitClient, revisionRange: string): void;
export declare function ensureBaseCommitExistsLocally(git: GitClient, commitSha: string, fetchUrl: string, refName: string): void;
