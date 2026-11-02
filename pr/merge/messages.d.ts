import { PullRequestCommentsFromGithub } from '../common/fetch-pull-request.js';
import { PullRequest } from './pull-request.js';
export interface PullRequestMergeResult {
    prNumber: number;
    status: 'success' | 'failed';
    targetBranches?: string[];
    failureReason?: string;
}
export declare const CARETAKER_NOTE_COMMENT_REGEX: RegExp;
export declare function getCaretakerNoteFromComments(comments: PullRequestCommentsFromGithub[]): string | null;
export declare function getQuotedComment(comment: string): string;
export declare function getCaretakerNotePromptMessage(pullRequest: PullRequest, caretakerNote?: string | undefined): string;
export declare function getTargetedBranchesConfirmationPromptMessage(): string;
export declare function getTargetedBranchesMessage(pullRequest: PullRequest): string;
export declare function formatCaretakerNoteForSummary(note: string): string;
export declare function getPullRequestSummary(pullRequest: PullRequest): string;
export declare function getMultiPullRequestSummary(pullRequests: PullRequest[]): string;
export declare function getMergeResultsSummary(results: PullRequestMergeResult[], isDryRun?: boolean): string;
