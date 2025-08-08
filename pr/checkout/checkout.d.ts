export interface CheckoutPullRequestParams {
    pr: number;
    takeover?: boolean;
    target?: string;
}
export declare function checkoutPullRequest(params: CheckoutPullRequestParams): Promise<void>;
