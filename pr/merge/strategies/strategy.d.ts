import { AuthenticatedGitClient } from '../../../utils/git/authenticated-git-client.js';
import { PullRequest } from '../pull-request.js';
export declare const TEMP_PR_HEAD_BRANCH = "merge_pr_head";
export declare abstract class MergeStrategy {
    protected git: AuthenticatedGitClient;
    constructor(git: AuthenticatedGitClient);
    prepare(pullRequest: PullRequest): Promise<void>;
    abstract merge(pullRequest: PullRequest): Promise<void>;
    check(pullRequest: PullRequest): Promise<void>;
    cleanup(pullRequest: PullRequest): Promise<void>;
    protected getLocalTargetBranchName(targetBranch: string): string;
    protected cherryPickIntoTargetBranches(revisionRange: string, targetBranches: string[], options?: {
        dryRun?: boolean;
        linkToOriginalCommits?: boolean;
    }): string[];
    protected fetchTargetBranches(names: string[], ...extraRefspecs: string[]): void;
    protected pushTargetBranchesUpstream(names: string[]): void;
    protected _assertMergeableOrThrow({ revisionRange }: PullRequest, targetBranches: string[]): Promise<void>;
    protected createMergeComment(pullRequest: PullRequest, targetBranches: string[]): Promise<void>;
}
