/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import type { OctokitOptions } from '@octokit/core/dist-types/types.js';
import { Octokit } from '@octokit/rest';
import { RequestParameters } from '@octokit/types';
import { RequestError } from '@octokit/request-error';
import { query } from 'typed-graphqlify';
/**
 * An object representation of a Graphql Query to be used as a response type and
 * to generate a Graphql query string.
 */
export type GraphqlQueryObject = Parameters<typeof query>[1];
/** Interface describing a Github repository. */
export interface GithubRepo {
    /** Owner login of the repository. */
    owner: string;
    /** Name of the repository. */
    name: string;
}
/** A Github client for interacting with the Github APIs. */
export declare class GithubClient {
    private _octokitOptions?;
    /** The octokit instance actually performing API requests. */
    protected _octokit: import("@octokit/core/dist-types").Octokit & {
        paginate: import("@octokit/plugin-paginate-rest/dist-types").PaginateInterface;
    } & import("@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types").RestEndpointMethods & import("@octokit/plugin-rest-endpoint-methods/dist-types/types").Api;
    readonly pulls: Octokit['pulls'];
    readonly repos: Octokit['repos'];
    readonly issues: Octokit['issues'];
    readonly git: Octokit['git'];
    readonly rateLimit: Octokit['rateLimit'];
    readonly teams: Octokit['teams'];
    readonly search: Octokit['search'];
    readonly rest: Octokit['rest'];
    readonly paginate: Octokit['paginate'];
    constructor(_octokitOptions?: OctokitOptions | undefined);
}
/**
 * Extension of the `GithubClient` that provides utilities which are specific
 * to authenticated instances.
 */
export declare class AuthenticatedGithubClient extends GithubClient {
    private _token;
    /** The graphql instance with authentication set during construction. */
    private _graphql;
    constructor(_token: string);
    /** Perform a query using Github's Graphql API. */
    graphql<T extends GraphqlQueryObject>(queryObject: T, params?: RequestParameters): Promise<T>;
}
/** Whether the given object corresponds to an Octokit API request error.  */
export declare function isGithubApiError(obj: unknown): obj is RequestError;
