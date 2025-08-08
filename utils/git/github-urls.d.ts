import { GithubConfig } from '../config.js';
import { GitClient } from './git-client.js';
export declare const GITHUB_TOKEN_SETTINGS_URL = "https://github.com/settings/tokens";
export declare const GITHUB_TOKEN_GENERATE_URL = "https://github.com/settings/tokens/new";
export declare function addTokenToGitHttpsUrl(githubHttpsUrl: string, token: string): string;
export declare function getRepositoryGitUrl(config: Pick<GithubConfig, 'name' | 'owner' | 'useSsh'>, githubToken?: string): string;
export declare function getListCommitsInBranchUrl(client: GitClient, branchName: string): string;
export declare function getFileContentsUrl(client: GitClient, ref: string, relativeFilePath: string): string;
