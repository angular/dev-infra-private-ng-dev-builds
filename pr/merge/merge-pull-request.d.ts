import { PullRequestMergeFlags } from './merge-tool.js';
export declare function mergePullRequests(prNumbers: number[], flags: PullRequestMergeFlags): Promise<void>;
export declare function mergePullRequest(prNumber: number, flags: PullRequestMergeFlags): Promise<void>;
export declare function handleMergeError(e: unknown): boolean;
export declare function parsePrNumber(prUrlOrNumber: string): number;
