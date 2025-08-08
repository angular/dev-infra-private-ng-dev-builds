import { CommitFromGitLog } from './parse.js';
export declare function getCommitsInRange(from: string, to?: string): Promise<CommitFromGitLog[]>;
