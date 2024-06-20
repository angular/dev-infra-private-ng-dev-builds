import { GithubConfig, NgDevConfig } from '../../utils/config.js';
export interface CheckoutPullRequestParams {
    pr: number;
    takeover?: boolean;
    target?: string;
}
export declare function checkoutPullRequest(params: CheckoutPullRequestParams, config: NgDevConfig<{
    github: GithubConfig;
}>): Promise<void>;
