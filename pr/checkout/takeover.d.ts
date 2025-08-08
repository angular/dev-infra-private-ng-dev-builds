import { checkOutPullRequestLocally } from '../common/checkout-pr.js';
export declare function checkoutAsPrTakeover(prNumber: number, { resetGitState, pullRequest }: Awaited<ReturnType<typeof checkOutPullRequestLocally>>): Promise<void>;
