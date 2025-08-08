import { GitClient } from '../../utils/git/git-client.js';
export type PullRequestState = 'merged' | 'unknown';
export declare function isPullRequestMerged(api: GitClient, id: number): Promise<boolean>;
