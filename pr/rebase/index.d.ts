/**
 * Rebase the provided PR onto its merge target branch, and push up the resulting
 * commit to the PRs repository.
 *
 * @returns a status code indicating whether the rebase was successful.
 */
export declare function rebasePr(prNumber: number, interactive?: boolean): Promise<number>;
