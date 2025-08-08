import { PullRequestMergeFlags } from './merge-tool.js';
export declare function mergePullRequest(prNumber: number, flags: PullRequestMergeFlags): Promise<void>;
export declare function parsePrNumber(prUrlOrNumber: string): number;
