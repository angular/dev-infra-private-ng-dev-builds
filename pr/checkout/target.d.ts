/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { checkOutPullRequestLocally } from '../common/checkout-pr.js';
export declare function checkoutToTargetBranch(prNumber: number, target: string, { pullRequest }: Awaited<ReturnType<typeof checkOutPullRequestLocally>>): Promise<void>;
