/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { checkOutPullRequestLocally } from '../common/checkout-pr.js';
/**
 * Checkout the provided pull request in preperation for a new takeover pull request to be made
 */
export declare function checkoutAsPrTakeover(prNumber: number, { resetGitState, pullRequest }: Awaited<ReturnType<typeof checkOutPullRequestLocally>>): Promise<void>;
