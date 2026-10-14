import { GithubConfig } from '../config.js';
import { GitClient } from './git-client.js';
import { AuthenticatedGithubClient, GithubRepo } from './github.js';
export type OAuthScopeTestFunction = (scopes: string[], missing: string[]) => void;
export type TokenEnvironmentVariable = 'GITHUB_TOKEN' | 'TOKEN';
type UserType = 'bot' | 'user';
export declare class AuthenticatedGitClient extends GitClient {
    readonly githubToken: string;
    readonly userType: UserType;
    readonly tokenEnvironmentVariable: TokenEnvironmentVariable | null;
    private readonly _githubTokenRegex;
    private _cachedOauthScopes;
    private _cachedForkRepositories;
    readonly github: AuthenticatedGithubClient;
    protected constructor(githubToken: string, userType: UserType, config: {
        github: GithubConfig;
    }, baseDir?: string, tokenEnvironmentVariable?: TokenEnvironmentVariable | null);
    sanitizeConsoleOutput(value: string): string;
    getRepoGitUrl(): string;
    hasOauthScopes(testFn: OAuthScopeTestFunction): Promise<true | {
        error: string;
    }>;
    getForkOfAuthenticatedUser(): Promise<GithubRepo>;
    getAllForksOfAuthenticatedUser(): Promise<GithubRepo[]>;
    private _fetchAuthScopesForToken;
    private static _token;
    private static _tokenEnvironmentVariable;
    private static _authenticatedInstance;
    private static _userType;
    static get(): Promise<AuthenticatedGitClient>;
    static configure(token: string, userType?: UserType, tokenEnvironmentVariable?: TokenEnvironmentVariable | null): void;
}
export {};
