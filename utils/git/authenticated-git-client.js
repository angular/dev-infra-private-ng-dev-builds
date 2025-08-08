import { assertValidGithubConfig, getConfig } from '../config.js';
import { findOwnedForksOfRepoQuery } from './graphql-queries.js';
import { yellow } from '../logging.js';
import { GitClient } from './git-client.js';
import { AuthenticatedGithubClient } from './github.js';
import { getRepositoryGitUrl, GITHUB_TOKEN_GENERATE_URL, GITHUB_TOKEN_SETTINGS_URL, } from './github-urls.js';
export class AuthenticatedGitClient extends GitClient {
    constructor(githubToken, userType, config, baseDir) {
        super(config, baseDir);
        this.githubToken = githubToken;
        this.userType = userType;
        this._githubTokenRegex = new RegExp(this.githubToken, 'g');
        this._cachedOauthScopes = null;
        this._cachedForkRepositories = null;
        this.github = new AuthenticatedGithubClient(this.githubToken);
    }
    sanitizeConsoleOutput(value) {
        return value.replace(this._githubTokenRegex, '<TOKEN>');
    }
    getRepoGitUrl() {
        return getRepositoryGitUrl(this.remoteConfig, this.githubToken);
    }
    async hasOauthScopes(testFn) {
        if (this.userType === 'bot') {
            return true;
        }
        const scopes = await this._fetchAuthScopesForToken();
        const missingScopes = [];
        testFn(scopes, missingScopes);
        if (missingScopes.length === 0) {
            return true;
        }
        const error = `The provided <TOKEN> does not have required permissions due to missing scope(s): ` +
            `${yellow(missingScopes.join(', '))}\n\n` +
            `Update the token in use at:\n` +
            `  ${GITHUB_TOKEN_SETTINGS_URL}\n\n` +
            `Alternatively, a new token can be created at: ${GITHUB_TOKEN_GENERATE_URL}\n`;
        return { error };
    }
    async getForkOfAuthenticatedUser() {
        const forks = await this.getAllForksOfAuthenticatedUser();
        if (forks.length === 0) {
            throw Error('Unable to find fork a for currently authenticated user.');
        }
        return forks[0];
    }
    async getAllForksOfAuthenticatedUser() {
        if (this._cachedForkRepositories !== null) {
            return this._cachedForkRepositories;
        }
        const { owner, name } = this.remoteConfig;
        const result = await this.github.graphql(findOwnedForksOfRepoQuery, { owner, name });
        return (this._cachedForkRepositories = result.repository.forks.nodes.map((node) => ({
            owner: node.owner.login,
            name: node.name,
        })));
    }
    _fetchAuthScopesForToken() {
        if (this._cachedOauthScopes !== null) {
            return this._cachedOauthScopes;
        }
        return (this._cachedOauthScopes = this.github.rateLimit.get().then((response) => {
            const scopes = response.headers['x-oauth-scopes'];
            if (scopes === undefined) {
                throw Error('Unable to retrieve OAuth scopes for token provided to Git client.');
            }
            return scopes
                .split(',')
                .map((scope) => scope.trim())
                .filter((scope) => scope !== '');
        }));
    }
    static async get() {
        if (AuthenticatedGitClient._token === null) {
            throw new Error('No instance of `AuthenticatedGitClient` has been configured.');
        }
        if (AuthenticatedGitClient._authenticatedInstance === null) {
            AuthenticatedGitClient._authenticatedInstance = (async (token, userType) => {
                return new AuthenticatedGitClient(token, userType, await getConfig([assertValidGithubConfig]));
            })(AuthenticatedGitClient._token, AuthenticatedGitClient._userType);
        }
        return AuthenticatedGitClient._authenticatedInstance;
    }
    static configure(token, userType = 'user') {
        if (AuthenticatedGitClient._token) {
            throw Error('Unable to configure `AuthenticatedGitClient` as it has been configured already.');
        }
        AuthenticatedGitClient._token = token;
        AuthenticatedGitClient._userType = userType;
    }
}
AuthenticatedGitClient._token = null;
AuthenticatedGitClient._authenticatedInstance = null;
//# sourceMappingURL=authenticated-git-client.js.map