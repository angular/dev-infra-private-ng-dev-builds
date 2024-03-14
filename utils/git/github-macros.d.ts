/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AuthenticatedGithubClient } from './github.js';
import { RestEndpointMethodTypes } from '@octokit/rest';
declare function isGooglerOrgMember(client: AuthenticatedGithubClient, username: string): Promise<boolean>;
/** Shared base object for a derived Check or Status result. */
interface CheckOrStatusResult {
    type: string;
    name: string;
    result: string;
    url: string;
}
/** A derived Check result */
interface CheckResult extends CheckOrStatusResult {
    type: 'check';
    check: RestEndpointMethodTypes['checks']['listForRef']['response']['data']['check_runs'][number];
}
/** A derived Status result */
interface StatusResult extends CheckOrStatusResult {
    type: 'status';
    description: string;
    status: RestEndpointMethodTypes['repos']['getCombinedStatusForRef']['response']['data']['statuses'][number];
}
/** The overall results of a combined Checks and Statuses check. */
export interface CombinedChecksAndStatusesResult {
    result: 'pending' | 'passing' | 'failing' | null;
    results: (CheckResult | StatusResult)[];
}
/**
 * Retrieve a combined listing of the results for a refs statuses and checks.
 */
declare function getCombinedChecksAndStatusesForRef(github: AuthenticatedGithubClient, params: RestEndpointMethodTypes['checks']['listForRef']['parameters'] & RestEndpointMethodTypes['repos']['getCombinedStatusForRef']['parameters']): Promise<CombinedChecksAndStatusesResult>;
declare const _default: {
    getCombinedChecksAndStatusesForRef: typeof getCombinedChecksAndStatusesForRef;
    isGooglerOrgMember: typeof isGooglerOrgMember;
};
export default _default;
