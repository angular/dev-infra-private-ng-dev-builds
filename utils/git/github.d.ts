import type { OctokitOptions } from '@octokit/core';
import { Octokit } from '@octokit/rest';
import { RequestParameters } from '@octokit/types';
import { RequestError } from '@octokit/request-error';
import { query } from 'typed-graphqlify';
export type GraphqlQueryObject = Parameters<typeof query>[1];
export interface GithubRepo {
    owner: string;
    name: string;
}
export declare class GithubClient {
    private _octokitOptions?;
    protected _octokit: Octokit;
    readonly pulls: Octokit['pulls'];
    readonly orgs: Octokit['orgs'];
    readonly repos: Octokit['repos'];
    readonly issues: Octokit['issues'];
    readonly git: Octokit['git'];
    readonly rateLimit: Octokit['rateLimit'];
    readonly teams: Octokit['teams'];
    readonly search: Octokit['search'];
    readonly rest: Octokit['rest'];
    readonly paginate: Octokit['paginate'];
    readonly checks: Octokit['checks'];
    readonly users: Octokit['users'];
    constructor(_octokitOptions?: OctokitOptions | undefined);
}
export declare class AuthenticatedGithubClient extends GithubClient {
    private _token;
    private _graphql;
    constructor(_token: string);
    graphql<T extends GraphqlQueryObject>(queryObject: T, params?: RequestParameters): Promise<T>;
}
export declare function isGithubApiError(obj: unknown): obj is RequestError;
