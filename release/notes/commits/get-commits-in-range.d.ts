import { GitClient } from '../../../utils/git/git-client.js';
import { CommitFromGitLog } from '../../../commit-message/parse.js';
export declare function getCommitsForRangeWithDeduping(client: GitClient, baseRef: string, headRef: string): CommitFromGitLog[];
