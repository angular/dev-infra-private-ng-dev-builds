import { checkOutPullRequestLocally } from '../common/checkout-pr.js';
export declare function checkoutToTargetBranch(prNumber: number, target: string, { pullRequest }: Awaited<ReturnType<typeof checkOutPullRequestLocally>>): Promise<void>;
