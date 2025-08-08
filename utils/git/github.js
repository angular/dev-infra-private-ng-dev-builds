import { Octokit } from '@octokit/rest';
import { query } from 'typed-graphqlify';
export class GithubClient {
    constructor(_octokitOptions) {
        this._octokitOptions = _octokitOptions;
        this._octokit = new Octokit({ ...this._octokitOptions });
        this.pulls = this._octokit.pulls;
        this.orgs = this._octokit.orgs;
        this.repos = this._octokit.repos;
        this.issues = this._octokit.issues;
        this.git = this._octokit.git;
        this.rateLimit = this._octokit.rateLimit;
        this.teams = this._octokit.teams;
        this.search = this._octokit.search;
        this.rest = this._octokit.rest;
        this.paginate = this._octokit.paginate;
        this.checks = this._octokit.checks;
    }
}
export class AuthenticatedGithubClient extends GithubClient {
    constructor(_token) {
        super({ auth: _token });
        this._token = _token;
        this._graphql = this._octokit.graphql.defaults({
            headers: { authorization: `token ${this._token}` },
        });
    }
    async graphql(queryObject, params = {}) {
        return (await this._graphql(query(queryObject).toString(), params));
    }
}
export function isGithubApiError(obj) {
    return (obj instanceof Error &&
        obj.constructor.name === 'RequestError' &&
        obj.request !== undefined);
}
//# sourceMappingURL=github.js.map