import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { PullRequest } from './actions.js';
export declare function promptToInitiatePullRequestMerge(git: AuthenticatedGitClient, { id, url }: PullRequest): Promise<void>;
