/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { assertValidGithubConfig, getConfig } from '../config.js';
import { findOwnedForksOfRepoQuery } from './graphql-queries.js';
import { yellow } from '../logging.js';
import { GitClient } from './git-client.js';
import { AuthenticatedGithubClient } from './github.js';
import { getRepositoryGitUrl, GITHUB_TOKEN_GENERATE_URL, GITHUB_TOKEN_SETTINGS_URL, } from './github-urls.js';
/**
 * Extension of the `GitClient` with additional utilities which are useful for
 * authenticated Git client instances.
 */
export class AuthenticatedGitClient extends GitClient {
    constructor(githubToken, userType, config, baseDir) {
        super(config, baseDir);
        this.githubToken = githubToken;
        this.userType = userType;
        /**
         * Regular expression that matches the provided Github token. Used for
         * sanitizing the token from Git child process output.
         */
        this._githubTokenRegex = new RegExp(this.githubToken, 'g');
        /** The OAuth scopes available for the provided Github token. */
        this._cachedOauthScopes = null;
        /** Cached fork repositories of the authenticated user. */
        this._cachedForkRepositories = null;
        /** Instance of an authenticated github client. */
        this.github = new AuthenticatedGithubClient(this.githubToken);
    }
    /** Sanitizes a given message by omitting the provided Github token if present. */
    sanitizeConsoleOutput(value) {
        return value.replace(this._githubTokenRegex, '<TOKEN>');
    }
    /** Git URL that resolves to the configured repository. */
    getRepoGitUrl() {
        return getRepositoryGitUrl(this.remoteConfig, this.githubToken);
    }
    /**
     * Assert the GitClient instance is using a token with permissions for the all of the
     * provided OAuth scopes.
     */
    async hasOauthScopes(testFn) {
        // Because bot accounts do not have the same structure for OAuth scopes, we always assume they
        // have the correct access.
        if (this.userType === 'bot') {
            return true;
        }
        const scopes = await this._fetchAuthScopesForToken();
        const missingScopes = [];
        // Test Github OAuth scopes and collect missing ones.
        testFn(scopes, missingScopes);
        // If no missing scopes are found, return true to indicate all OAuth Scopes are available.
        if (missingScopes.length === 0) {
            return true;
        }
        // Pre-constructed error message to log to the user, providing missing scopes and
        // remediation instructions.
        const error = `The provided <TOKEN> does not have required permissions due to missing scope(s): ` +
            `${yellow(missingScopes.join(', '))}\n\n` +
            `Update the token in use at:\n` +
            `  ${GITHUB_TOKEN_SETTINGS_URL}\n\n` +
            `Alternatively, a new token can be created at: ${GITHUB_TOKEN_GENERATE_URL}\n`;
        return { error };
    }
    /** Gets an owned fork for the configured project of the authenticated user. */
    async getForkOfAuthenticatedUser() {
        const forks = await this.getAllForksOfAuthenticatedUser();
        if (forks.length === 0) {
            throw Error('Unable to find fork a for currently authenticated user.');
        }
        return forks[0];
    }
    /**
     * Finds all forks owned by the currently authenticated user in the Git client,
     *
     * The determined fork repositories are cached as we assume that the authenticated
     * user will not change during execution, or that no new forks are created.
     */
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
    /** Fetch the OAuth scopes for the loaded Github token. */
    _fetchAuthScopesForToken() {
        // If the OAuth scopes have already been loaded, return the Promise containing them.
        if (this._cachedOauthScopes !== null) {
            return this._cachedOauthScopes;
        }
        // OAuth scopes are loaded via the /rate_limit endpoint to prevent
        // usage of a request against that rate_limit for this lookup.
        return (this._cachedOauthScopes = this.github.rateLimit.get().then((response) => {
            const scopes = response.headers['x-oauth-scopes'];
            // If no token is provided, or if the Github client is authenticated incorrectly,
            // the `x-oauth-scopes` response header is not set. We error in such cases as it
            // signifies a faulty  of the
            if (scopes === undefined) {
                throw Error('Unable to retrieve OAuth scopes for token provided to Git client.');
            }
            return scopes
                .split(',')
                .map((scope) => scope.trim())
                .filter((scope) => scope !== '');
        }));
    }
    /**
     * Static method to get the singleton instance of the `AuthenticatedGitClient`,
     * creating it if it has not yet been created.
     */
    static async get() {
        if (AuthenticatedGitClient._token === null) {
            throw new Error('No instance of `AuthenticatedGitClient` has been configured.');
        }
        // If there is no cached authenticated instance, create one and cache the promise
        // immediately. This avoids constructing a client twice accidentally when e.g. waiting
        // for the configuration to be loaded.
        if (AuthenticatedGitClient._authenticatedInstance === null) {
            AuthenticatedGitClient._authenticatedInstance = (async (token, userType) => {
                return new AuthenticatedGitClient(token, userType, await getConfig([assertValidGithubConfig]));
            })(AuthenticatedGitClient._token, AuthenticatedGitClient._userType);
        }
        return AuthenticatedGitClient._authenticatedInstance;
    }
    /** Configures an authenticated git client. */
    static configure(token, userType = 'user') {
        if (AuthenticatedGitClient._token) {
            throw Error('Unable to configure `AuthenticatedGitClient` as it has been configured already.');
        }
        AuthenticatedGitClient._token = token;
        AuthenticatedGitClient._userType = userType;
    }
}
/** The previously configured access token. */
AuthenticatedGitClient._token = null;
/** The singleton instance of the `AuthenticatedGitClient`. */
AuthenticatedGitClient._authenticatedInstance = null;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRlZC1naXQtY2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3V0aWxzL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLHVCQUF1QixFQUFFLFNBQVMsRUFBZSxNQUFNLGNBQWMsQ0FBQztBQUM5RSxPQUFPLEVBQUMseUJBQXlCLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUMvRCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRXJDLE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxpQkFBaUIsQ0FBQztBQUMxQyxPQUFPLEVBQUMseUJBQXlCLEVBQWEsTUFBTSxhQUFhLENBQUM7QUFDbEUsT0FBTyxFQUNMLG1CQUFtQixFQUNuQix5QkFBeUIsRUFDekIseUJBQXlCLEdBQzFCLE1BQU0sa0JBQWtCLENBQUM7QUFRMUI7OztHQUdHO0FBQ0gsTUFBTSxPQUFPLHNCQUF1QixTQUFRLFNBQVM7SUFnQm5ELFlBQ1csV0FBbUIsRUFDbkIsUUFBa0IsRUFDM0IsTUFBOEIsRUFDOUIsT0FBZ0I7UUFFaEIsS0FBSyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUxkLGdCQUFXLEdBQVgsV0FBVyxDQUFRO1FBQ25CLGFBQVEsR0FBUixRQUFRLENBQVU7UUFqQjdCOzs7V0FHRztRQUNjLHNCQUFpQixHQUFXLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFL0UsZ0VBQWdFO1FBQ3hELHVCQUFrQixHQUE2QixJQUFJLENBQUM7UUFFNUQsMERBQTBEO1FBQ2xELDRCQUF1QixHQUF3QixJQUFJLENBQUM7UUFFNUQsa0RBQWtEO1FBQ2hDLFdBQU0sR0FBRyxJQUFJLHlCQUF5QixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQVMzRSxDQUFDO0lBRUQsa0ZBQWtGO0lBQ3pFLHFCQUFxQixDQUFDLEtBQWE7UUFDMUMsT0FBTyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRUQsMERBQTBEO0lBQ2pELGFBQWE7UUFDcEIsT0FBTyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUNsRSxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsS0FBSyxDQUFDLGNBQWMsQ0FBQyxNQUE4QjtRQUNqRCw4RkFBOEY7UUFDOUYsMkJBQTJCO1FBQzNCLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxLQUFLLEVBQUUsQ0FBQztZQUM1QixPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1FBQ3JELE1BQU0sYUFBYSxHQUFhLEVBQUUsQ0FBQztRQUNuQyxxREFBcUQ7UUFDckQsTUFBTSxDQUFDLE1BQU0sRUFBRSxhQUFhLENBQUMsQ0FBQztRQUM5QiwwRkFBMEY7UUFDMUYsSUFBSSxhQUFhLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQy9CLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUVELGlGQUFpRjtRQUNqRiw0QkFBNEI7UUFDNUIsTUFBTSxLQUFLLEdBQ1QsbUZBQW1GO1lBQ25GLEdBQUcsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTTtZQUN6QywrQkFBK0I7WUFDL0IsS0FBSyx5QkFBeUIsTUFBTTtZQUNwQyxpREFBaUQseUJBQXlCLElBQUksQ0FBQztRQUVqRixPQUFPLEVBQUMsS0FBSyxFQUFDLENBQUM7SUFDakIsQ0FBQztJQUVELCtFQUErRTtJQUMvRSxLQUFLLENBQUMsMEJBQTBCO1FBQzlCLE1BQU0sS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLDhCQUE4QixFQUFFLENBQUM7UUFFMUQsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3ZCLE1BQU0sS0FBSyxDQUFDLHlEQUF5RCxDQUFDLENBQUM7UUFDekUsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xCLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILEtBQUssQ0FBQyw4QkFBOEI7UUFDbEMsSUFBSSxJQUFJLENBQUMsdUJBQXVCLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDMUMsT0FBTyxJQUFJLENBQUMsdUJBQXVCLENBQUM7UUFDdEMsQ0FBQztRQUVELE1BQU0sRUFBQyxLQUFLLEVBQUUsSUFBSSxFQUFDLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztRQUN4QyxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLHlCQUF5QixFQUFFLEVBQUMsS0FBSyxFQUFFLElBQUksRUFBQyxDQUFDLENBQUM7UUFFbkYsT0FBTyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ2xGLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUs7WUFDdkIsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1NBQ2hCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBRUQsMERBQTBEO0lBQ2xELHdCQUF3QjtRQUM5QixvRkFBb0Y7UUFDcEYsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDckMsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUM7UUFDakMsQ0FBQztRQUNELGtFQUFrRTtRQUNsRSw4REFBOEQ7UUFDOUQsT0FBTyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRTtZQUM5RSxNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFFbEQsaUZBQWlGO1lBQ2pGLGdGQUFnRjtZQUNoRiw2QkFBNkI7WUFDN0IsSUFBSSxNQUFNLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQ3pCLE1BQU0sS0FBSyxDQUFDLG1FQUFtRSxDQUFDLENBQUM7WUFDbkYsQ0FBQztZQUVELE9BQU8sTUFBTTtpQkFDVixLQUFLLENBQUMsR0FBRyxDQUFDO2lCQUNWLEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO2lCQUM1QixNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUMsQ0FBQztRQUNyQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ04sQ0FBQztJQVNEOzs7T0FHRztJQUNILE1BQU0sQ0FBVSxLQUFLLENBQUMsR0FBRztRQUN2QixJQUFJLHNCQUFzQixDQUFDLE1BQU0sS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUMzQyxNQUFNLElBQUksS0FBSyxDQUFDLDhEQUE4RCxDQUFDLENBQUM7UUFDbEYsQ0FBQztRQUVELGlGQUFpRjtRQUNqRixzRkFBc0Y7UUFDdEYsc0NBQXNDO1FBQ3RDLElBQUksc0JBQXNCLENBQUMsc0JBQXNCLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDM0Qsc0JBQXNCLENBQUMsc0JBQXNCLEdBQUcsQ0FBQyxLQUFLLEVBQ3BELEtBQWEsRUFDYixRQUFrQixFQUNsQixFQUFFO2dCQUNGLE9BQU8sSUFBSSxzQkFBc0IsQ0FDL0IsS0FBSyxFQUNMLFFBQVEsRUFDUixNQUFNLFNBQVMsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FDM0MsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDLHNCQUFzQixDQUFDLE1BQU0sRUFBRSxzQkFBc0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN0RSxDQUFDO1FBRUQsT0FBTyxzQkFBc0IsQ0FBQyxzQkFBc0IsQ0FBQztJQUN2RCxDQUFDO0lBRUQsOENBQThDO0lBQzlDLE1BQU0sQ0FBQyxTQUFTLENBQUMsS0FBYSxFQUFFLFdBQXFCLE1BQU07UUFDekQsSUFBSSxzQkFBc0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNsQyxNQUFNLEtBQUssQ0FDVCxpRkFBaUYsQ0FDbEYsQ0FBQztRQUNKLENBQUM7UUFFRCxzQkFBc0IsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO1FBQ3RDLHNCQUFzQixDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7SUFDOUMsQ0FBQzs7QUE3Q0QsOENBQThDO0FBQy9CLDZCQUFNLEdBQWtCLElBQUksQUFBdEIsQ0FBdUI7QUFDNUMsOERBQThEO0FBQy9DLDZDQUFzQixHQUEyQyxJQUFJLEFBQS9DLENBQWdEIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7YXNzZXJ0VmFsaWRHaXRodWJDb25maWcsIGdldENvbmZpZywgR2l0aHViQ29uZmlnfSBmcm9tICcuLi9jb25maWcuanMnO1xuaW1wb3J0IHtmaW5kT3duZWRGb3Jrc09mUmVwb1F1ZXJ5fSBmcm9tICcuL2dyYXBocWwtcXVlcmllcy5qcyc7XG5pbXBvcnQge3llbGxvd30gZnJvbSAnLi4vbG9nZ2luZy5qcyc7XG5cbmltcG9ydCB7R2l0Q2xpZW50fSBmcm9tICcuL2dpdC1jbGllbnQuanMnO1xuaW1wb3J0IHtBdXRoZW50aWNhdGVkR2l0aHViQ2xpZW50LCBHaXRodWJSZXBvfSBmcm9tICcuL2dpdGh1Yi5qcyc7XG5pbXBvcnQge1xuICBnZXRSZXBvc2l0b3J5R2l0VXJsLFxuICBHSVRIVUJfVE9LRU5fR0VORVJBVEVfVVJMLFxuICBHSVRIVUJfVE9LRU5fU0VUVElOR1NfVVJMLFxufSBmcm9tICcuL2dpdGh1Yi11cmxzLmpzJztcblxuLyoqIERlc2NyaWJlcyBhIGZ1bmN0aW9uIHRoYXQgY2FuIGJlIHVzZWQgdG8gdGVzdCBmb3IgZ2l2ZW4gR2l0aHViIE9BdXRoIHNjb3Blcy4gKi9cbmV4cG9ydCB0eXBlIE9BdXRoU2NvcGVUZXN0RnVuY3Rpb24gPSAoc2NvcGVzOiBzdHJpbmdbXSwgbWlzc2luZzogc3RyaW5nW10pID0+IHZvaWQ7XG5cbi8qKiBUaGUgcG9zc2libGUgdHlwZXMgb2YgdXNlcnMgd2hpY2ggY291bGQgYmUgdXNlZCBmb3IgYXV0aGVudGljYXRpb24uICovXG50eXBlIFVzZXJUeXBlID0gJ2JvdCcgfCAndXNlcic7XG5cbi8qKlxuICogRXh0ZW5zaW9uIG9mIHRoZSBgR2l0Q2xpZW50YCB3aXRoIGFkZGl0aW9uYWwgdXRpbGl0aWVzIHdoaWNoIGFyZSB1c2VmdWwgZm9yXG4gKiBhdXRoZW50aWNhdGVkIEdpdCBjbGllbnQgaW5zdGFuY2VzLlxuICovXG5leHBvcnQgY2xhc3MgQXV0aGVudGljYXRlZEdpdENsaWVudCBleHRlbmRzIEdpdENsaWVudCB7XG4gIC8qKlxuICAgKiBSZWd1bGFyIGV4cHJlc3Npb24gdGhhdCBtYXRjaGVzIHRoZSBwcm92aWRlZCBHaXRodWIgdG9rZW4uIFVzZWQgZm9yXG4gICAqIHNhbml0aXppbmcgdGhlIHRva2VuIGZyb20gR2l0IGNoaWxkIHByb2Nlc3Mgb3V0cHV0LlxuICAgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBfZ2l0aHViVG9rZW5SZWdleDogUmVnRXhwID0gbmV3IFJlZ0V4cCh0aGlzLmdpdGh1YlRva2VuLCAnZycpO1xuXG4gIC8qKiBUaGUgT0F1dGggc2NvcGVzIGF2YWlsYWJsZSBmb3IgdGhlIHByb3ZpZGVkIEdpdGh1YiB0b2tlbi4gKi9cbiAgcHJpdmF0ZSBfY2FjaGVkT2F1dGhTY29wZXM6IFByb21pc2U8c3RyaW5nW10+IHwgbnVsbCA9IG51bGw7XG5cbiAgLyoqIENhY2hlZCBmb3JrIHJlcG9zaXRvcmllcyBvZiB0aGUgYXV0aGVudGljYXRlZCB1c2VyLiAqL1xuICBwcml2YXRlIF9jYWNoZWRGb3JrUmVwb3NpdG9yaWVzOiBHaXRodWJSZXBvW10gfCBudWxsID0gbnVsbDtcblxuICAvKiogSW5zdGFuY2Ugb2YgYW4gYXV0aGVudGljYXRlZCBnaXRodWIgY2xpZW50LiAqL1xuICBvdmVycmlkZSByZWFkb25seSBnaXRodWIgPSBuZXcgQXV0aGVudGljYXRlZEdpdGh1YkNsaWVudCh0aGlzLmdpdGh1YlRva2VuKTtcblxuICBwcm90ZWN0ZWQgY29uc3RydWN0b3IoXG4gICAgcmVhZG9ubHkgZ2l0aHViVG9rZW46IHN0cmluZyxcbiAgICByZWFkb25seSB1c2VyVHlwZTogVXNlclR5cGUsXG4gICAgY29uZmlnOiB7Z2l0aHViOiBHaXRodWJDb25maWd9LFxuICAgIGJhc2VEaXI/OiBzdHJpbmcsXG4gICkge1xuICAgIHN1cGVyKGNvbmZpZywgYmFzZURpcik7XG4gIH1cblxuICAvKiogU2FuaXRpemVzIGEgZ2l2ZW4gbWVzc2FnZSBieSBvbWl0dGluZyB0aGUgcHJvdmlkZWQgR2l0aHViIHRva2VuIGlmIHByZXNlbnQuICovXG4gIG92ZXJyaWRlIHNhbml0aXplQ29uc29sZU91dHB1dCh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdmFsdWUucmVwbGFjZSh0aGlzLl9naXRodWJUb2tlblJlZ2V4LCAnPFRPS0VOPicpO1xuICB9XG5cbiAgLyoqIEdpdCBVUkwgdGhhdCByZXNvbHZlcyB0byB0aGUgY29uZmlndXJlZCByZXBvc2l0b3J5LiAqL1xuICBvdmVycmlkZSBnZXRSZXBvR2l0VXJsKCkge1xuICAgIHJldHVybiBnZXRSZXBvc2l0b3J5R2l0VXJsKHRoaXMucmVtb3RlQ29uZmlnLCB0aGlzLmdpdGh1YlRva2VuKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBc3NlcnQgdGhlIEdpdENsaWVudCBpbnN0YW5jZSBpcyB1c2luZyBhIHRva2VuIHdpdGggcGVybWlzc2lvbnMgZm9yIHRoZSBhbGwgb2YgdGhlXG4gICAqIHByb3ZpZGVkIE9BdXRoIHNjb3Blcy5cbiAgICovXG4gIGFzeW5jIGhhc09hdXRoU2NvcGVzKHRlc3RGbjogT0F1dGhTY29wZVRlc3RGdW5jdGlvbik6IFByb21pc2U8dHJ1ZSB8IHtlcnJvcjogc3RyaW5nfT4ge1xuICAgIC8vIEJlY2F1c2UgYm90IGFjY291bnRzIGRvIG5vdCBoYXZlIHRoZSBzYW1lIHN0cnVjdHVyZSBmb3IgT0F1dGggc2NvcGVzLCB3ZSBhbHdheXMgYXNzdW1lIHRoZXlcbiAgICAvLyBoYXZlIHRoZSBjb3JyZWN0IGFjY2Vzcy5cbiAgICBpZiAodGhpcy51c2VyVHlwZSA9PT0gJ2JvdCcpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHNjb3BlcyA9IGF3YWl0IHRoaXMuX2ZldGNoQXV0aFNjb3Blc0ZvclRva2VuKCk7XG4gICAgY29uc3QgbWlzc2luZ1Njb3Blczogc3RyaW5nW10gPSBbXTtcbiAgICAvLyBUZXN0IEdpdGh1YiBPQXV0aCBzY29wZXMgYW5kIGNvbGxlY3QgbWlzc2luZyBvbmVzLlxuICAgIHRlc3RGbihzY29wZXMsIG1pc3NpbmdTY29wZXMpO1xuICAgIC8vIElmIG5vIG1pc3Npbmcgc2NvcGVzIGFyZSBmb3VuZCwgcmV0dXJuIHRydWUgdG8gaW5kaWNhdGUgYWxsIE9BdXRoIFNjb3BlcyBhcmUgYXZhaWxhYmxlLlxuICAgIGlmIChtaXNzaW5nU2NvcGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gUHJlLWNvbnN0cnVjdGVkIGVycm9yIG1lc3NhZ2UgdG8gbG9nIHRvIHRoZSB1c2VyLCBwcm92aWRpbmcgbWlzc2luZyBzY29wZXMgYW5kXG4gICAgLy8gcmVtZWRpYXRpb24gaW5zdHJ1Y3Rpb25zLlxuICAgIGNvbnN0IGVycm9yID1cbiAgICAgIGBUaGUgcHJvdmlkZWQgPFRPS0VOPiBkb2VzIG5vdCBoYXZlIHJlcXVpcmVkIHBlcm1pc3Npb25zIGR1ZSB0byBtaXNzaW5nIHNjb3BlKHMpOiBgICtcbiAgICAgIGAke3llbGxvdyhtaXNzaW5nU2NvcGVzLmpvaW4oJywgJykpfVxcblxcbmAgK1xuICAgICAgYFVwZGF0ZSB0aGUgdG9rZW4gaW4gdXNlIGF0OlxcbmAgK1xuICAgICAgYCAgJHtHSVRIVUJfVE9LRU5fU0VUVElOR1NfVVJMfVxcblxcbmAgK1xuICAgICAgYEFsdGVybmF0aXZlbHksIGEgbmV3IHRva2VuIGNhbiBiZSBjcmVhdGVkIGF0OiAke0dJVEhVQl9UT0tFTl9HRU5FUkFURV9VUkx9XFxuYDtcblxuICAgIHJldHVybiB7ZXJyb3J9O1xuICB9XG5cbiAgLyoqIEdldHMgYW4gb3duZWQgZm9yayBmb3IgdGhlIGNvbmZpZ3VyZWQgcHJvamVjdCBvZiB0aGUgYXV0aGVudGljYXRlZCB1c2VyLiAqL1xuICBhc3luYyBnZXRGb3JrT2ZBdXRoZW50aWNhdGVkVXNlcigpOiBQcm9taXNlPEdpdGh1YlJlcG8+IHtcbiAgICBjb25zdCBmb3JrcyA9IGF3YWl0IHRoaXMuZ2V0QWxsRm9ya3NPZkF1dGhlbnRpY2F0ZWRVc2VyKCk7XG5cbiAgICBpZiAoZm9ya3MubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBFcnJvcignVW5hYmxlIHRvIGZpbmQgZm9yayBhIGZvciBjdXJyZW50bHkgYXV0aGVudGljYXRlZCB1c2VyLicpO1xuICAgIH1cblxuICAgIHJldHVybiBmb3Jrc1swXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kcyBhbGwgZm9ya3Mgb3duZWQgYnkgdGhlIGN1cnJlbnRseSBhdXRoZW50aWNhdGVkIHVzZXIgaW4gdGhlIEdpdCBjbGllbnQsXG4gICAqXG4gICAqIFRoZSBkZXRlcm1pbmVkIGZvcmsgcmVwb3NpdG9yaWVzIGFyZSBjYWNoZWQgYXMgd2UgYXNzdW1lIHRoYXQgdGhlIGF1dGhlbnRpY2F0ZWRcbiAgICogdXNlciB3aWxsIG5vdCBjaGFuZ2UgZHVyaW5nIGV4ZWN1dGlvbiwgb3IgdGhhdCBubyBuZXcgZm9ya3MgYXJlIGNyZWF0ZWQuXG4gICAqL1xuICBhc3luYyBnZXRBbGxGb3Jrc09mQXV0aGVudGljYXRlZFVzZXIoKTogUHJvbWlzZTxHaXRodWJSZXBvW10+IHtcbiAgICBpZiAodGhpcy5fY2FjaGVkRm9ya1JlcG9zaXRvcmllcyAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZEZvcmtSZXBvc2l0b3JpZXM7XG4gICAgfVxuXG4gICAgY29uc3Qge293bmVyLCBuYW1lfSA9IHRoaXMucmVtb3RlQ29uZmlnO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2l0aHViLmdyYXBocWwoZmluZE93bmVkRm9ya3NPZlJlcG9RdWVyeSwge293bmVyLCBuYW1lfSk7XG5cbiAgICByZXR1cm4gKHRoaXMuX2NhY2hlZEZvcmtSZXBvc2l0b3JpZXMgPSByZXN1bHQucmVwb3NpdG9yeS5mb3Jrcy5ub2Rlcy5tYXAoKG5vZGUpID0+ICh7XG4gICAgICBvd25lcjogbm9kZS5vd25lci5sb2dpbixcbiAgICAgIG5hbWU6IG5vZGUubmFtZSxcbiAgICB9KSkpO1xuICB9XG5cbiAgLyoqIEZldGNoIHRoZSBPQXV0aCBzY29wZXMgZm9yIHRoZSBsb2FkZWQgR2l0aHViIHRva2VuLiAqL1xuICBwcml2YXRlIF9mZXRjaEF1dGhTY29wZXNGb3JUb2tlbigpIHtcbiAgICAvLyBJZiB0aGUgT0F1dGggc2NvcGVzIGhhdmUgYWxyZWFkeSBiZWVuIGxvYWRlZCwgcmV0dXJuIHRoZSBQcm9taXNlIGNvbnRhaW5pbmcgdGhlbS5cbiAgICBpZiAodGhpcy5fY2FjaGVkT2F1dGhTY29wZXMgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRPYXV0aFNjb3BlcztcbiAgICB9XG4gICAgLy8gT0F1dGggc2NvcGVzIGFyZSBsb2FkZWQgdmlhIHRoZSAvcmF0ZV9saW1pdCBlbmRwb2ludCB0byBwcmV2ZW50XG4gICAgLy8gdXNhZ2Ugb2YgYSByZXF1ZXN0IGFnYWluc3QgdGhhdCByYXRlX2xpbWl0IGZvciB0aGlzIGxvb2t1cC5cbiAgICByZXR1cm4gKHRoaXMuX2NhY2hlZE9hdXRoU2NvcGVzID0gdGhpcy5naXRodWIucmF0ZUxpbWl0LmdldCgpLnRoZW4oKHJlc3BvbnNlKSA9PiB7XG4gICAgICBjb25zdCBzY29wZXMgPSByZXNwb25zZS5oZWFkZXJzWyd4LW9hdXRoLXNjb3BlcyddO1xuXG4gICAgICAvLyBJZiBubyB0b2tlbiBpcyBwcm92aWRlZCwgb3IgaWYgdGhlIEdpdGh1YiBjbGllbnQgaXMgYXV0aGVudGljYXRlZCBpbmNvcnJlY3RseSxcbiAgICAgIC8vIHRoZSBgeC1vYXV0aC1zY29wZXNgIHJlc3BvbnNlIGhlYWRlciBpcyBub3Qgc2V0LiBXZSBlcnJvciBpbiBzdWNoIGNhc2VzIGFzIGl0XG4gICAgICAvLyBzaWduaWZpZXMgYSBmYXVsdHkgIG9mIHRoZVxuICAgICAgaWYgKHNjb3BlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IEVycm9yKCdVbmFibGUgdG8gcmV0cmlldmUgT0F1dGggc2NvcGVzIGZvciB0b2tlbiBwcm92aWRlZCB0byBHaXQgY2xpZW50LicpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gc2NvcGVzXG4gICAgICAgIC5zcGxpdCgnLCcpXG4gICAgICAgIC5tYXAoKHNjb3BlKSA9PiBzY29wZS50cmltKCkpXG4gICAgICAgIC5maWx0ZXIoKHNjb3BlKSA9PiBzY29wZSAhPT0gJycpO1xuICAgIH0pKTtcbiAgfVxuXG4gIC8qKiBUaGUgcHJldmlvdXNseSBjb25maWd1cmVkIGFjY2VzcyB0b2tlbi4gKi9cbiAgcHJpdmF0ZSBzdGF0aWMgX3Rva2VuOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgLyoqIFRoZSBzaW5nbGV0b24gaW5zdGFuY2Ugb2YgdGhlIGBBdXRoZW50aWNhdGVkR2l0Q2xpZW50YC4gKi9cbiAgcHJpdmF0ZSBzdGF0aWMgX2F1dGhlbnRpY2F0ZWRJbnN0YW5jZTogUHJvbWlzZTxBdXRoZW50aWNhdGVkR2l0Q2xpZW50PiB8IG51bGwgPSBudWxsO1xuICAvKiogVGhlIHByZXZpb3VzbHkgY29uZmlndXJlZCB1c2VyIHR5cGUuICovXG4gIHByaXZhdGUgc3RhdGljIF91c2VyVHlwZTogJ3VzZXInIHwgJ2JvdCc7XG5cbiAgLyoqXG4gICAqIFN0YXRpYyBtZXRob2QgdG8gZ2V0IHRoZSBzaW5nbGV0b24gaW5zdGFuY2Ugb2YgdGhlIGBBdXRoZW50aWNhdGVkR2l0Q2xpZW50YCxcbiAgICogY3JlYXRpbmcgaXQgaWYgaXQgaGFzIG5vdCB5ZXQgYmVlbiBjcmVhdGVkLlxuICAgKi9cbiAgc3RhdGljIG92ZXJyaWRlIGFzeW5jIGdldCgpOiBQcm9taXNlPEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQ+IHtcbiAgICBpZiAoQXV0aGVudGljYXRlZEdpdENsaWVudC5fdG9rZW4gPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gaW5zdGFuY2Ugb2YgYEF1dGhlbnRpY2F0ZWRHaXRDbGllbnRgIGhhcyBiZWVuIGNvbmZpZ3VyZWQuJyk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gY2FjaGVkIGF1dGhlbnRpY2F0ZWQgaW5zdGFuY2UsIGNyZWF0ZSBvbmUgYW5kIGNhY2hlIHRoZSBwcm9taXNlXG4gICAgLy8gaW1tZWRpYXRlbHkuIFRoaXMgYXZvaWRzIGNvbnN0cnVjdGluZyBhIGNsaWVudCB0d2ljZSBhY2NpZGVudGFsbHkgd2hlbiBlLmcuIHdhaXRpbmdcbiAgICAvLyBmb3IgdGhlIGNvbmZpZ3VyYXRpb24gdG8gYmUgbG9hZGVkLlxuICAgIGlmIChBdXRoZW50aWNhdGVkR2l0Q2xpZW50Ll9hdXRoZW50aWNhdGVkSW5zdGFuY2UgPT09IG51bGwpIHtcbiAgICAgIEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQuX2F1dGhlbnRpY2F0ZWRJbnN0YW5jZSA9IChhc3luYyAoXG4gICAgICAgIHRva2VuOiBzdHJpbmcsXG4gICAgICAgIHVzZXJUeXBlOiBVc2VyVHlwZSxcbiAgICAgICkgPT4ge1xuICAgICAgICByZXR1cm4gbmV3IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQoXG4gICAgICAgICAgdG9rZW4sXG4gICAgICAgICAgdXNlclR5cGUsXG4gICAgICAgICAgYXdhaXQgZ2V0Q29uZmlnKFthc3NlcnRWYWxpZEdpdGh1YkNvbmZpZ10pLFxuICAgICAgICApO1xuICAgICAgfSkoQXV0aGVudGljYXRlZEdpdENsaWVudC5fdG9rZW4sIEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQuX3VzZXJUeXBlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gQXV0aGVudGljYXRlZEdpdENsaWVudC5fYXV0aGVudGljYXRlZEluc3RhbmNlO1xuICB9XG5cbiAgLyoqIENvbmZpZ3VyZXMgYW4gYXV0aGVudGljYXRlZCBnaXQgY2xpZW50LiAqL1xuICBzdGF0aWMgY29uZmlndXJlKHRva2VuOiBzdHJpbmcsIHVzZXJUeXBlOiBVc2VyVHlwZSA9ICd1c2VyJyk6IHZvaWQge1xuICAgIGlmIChBdXRoZW50aWNhdGVkR2l0Q2xpZW50Ll90b2tlbikge1xuICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICdVbmFibGUgdG8gY29uZmlndXJlIGBBdXRoZW50aWNhdGVkR2l0Q2xpZW50YCBhcyBpdCBoYXMgYmVlbiBjb25maWd1cmVkIGFscmVhZHkuJyxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgQXV0aGVudGljYXRlZEdpdENsaWVudC5fdG9rZW4gPSB0b2tlbjtcbiAgICBBdXRoZW50aWNhdGVkR2l0Q2xpZW50Ll91c2VyVHlwZSA9IHVzZXJUeXBlO1xuICB9XG59XG4iXX0=