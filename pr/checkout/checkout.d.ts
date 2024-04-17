export interface CheckoutPullRequestParams {
    pr: number;
    takeover?: boolean;
}
export declare function checkoutPullRequest(params: CheckoutPullRequestParams): Promise<void>;
