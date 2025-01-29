/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export interface CheckoutPullRequestParams {
    pr: number;
    takeover?: boolean;
    target?: string;
}
export declare function checkoutPullRequest(params: CheckoutPullRequestParams): Promise<void>;
