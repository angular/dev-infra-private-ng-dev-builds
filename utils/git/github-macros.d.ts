import { AuthenticatedGithubClient } from './github.js';
import { RestEndpointMethodTypes } from '@octokit/rest';
declare function isGooglerOrgMember(client: AuthenticatedGithubClient, username: string): Promise<boolean>;
interface CheckOrStatusResult {
    type: string;
    name: string;
    result: string;
    url: string;
}
interface CheckResult extends CheckOrStatusResult {
    type: 'check';
    check: RestEndpointMethodTypes['checks']['listForRef']['response']['data']['check_runs'][number];
}
interface StatusResult extends CheckOrStatusResult {
    type: 'status';
    description: string;
    status: RestEndpointMethodTypes['repos']['getCombinedStatusForRef']['response']['data']['statuses'][number];
}
export interface CombinedChecksAndStatusesResult {
    result: 'pending' | 'passing' | 'failing' | null;
    results: (CheckResult | StatusResult)[];
}
declare function getCombinedChecksAndStatusesForRef(github: AuthenticatedGithubClient, params: RestEndpointMethodTypes['checks']['listForRef']['parameters'] & RestEndpointMethodTypes['repos']['getCombinedStatusForRef']['parameters']): Promise<CombinedChecksAndStatusesResult>;
declare const _default: {
    getCombinedChecksAndStatusesForRef: typeof getCombinedChecksAndStatusesForRef;
    isGooglerOrgMember: typeof isGooglerOrgMember;
};
export default _default;
