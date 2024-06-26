/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CheckConclusionState, CheckStatusState, MergeableState, PullRequestState, StatusState, CommentAuthorAssociation } from '@octokit/graphql-schema';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
/** A status for a pull request status or check. */
export declare enum PullRequestStatus {
    PASSING = 0,
    FAILING = 1,
    PENDING = 2
}
/** Graphql schema for the response body the requested pull request. */
export declare const PR_SCHEMA: {
    url: string;
    isDraft: boolean;
    state: PullRequestState;
    number: number;
    mergeable: MergeableState;
    updatedAt: string;
    baseCommitInfo: {
        nodes: {
            commit: {
                parents: {
                    nodes: {
                        oid: string;
                    }[];
                };
            };
        }[];
    };
    commits: {
        totalCount: number;
        nodes: {
            commit: {
                oid: string;
                authoredDate: string;
                statusCheckRollup: {
                    state: StatusState;
                    contexts: {
                        nodes: ({
                            __typename: "CheckRun";
                            status: CheckStatusState;
                            conclusion: CheckConclusionState | null;
                            name: string;
                            state?: undefined;
                            context?: undefined;
                        } | {
                            __typename: "StatusContext";
                            state: StatusState;
                            context: string;
                            status?: undefined;
                            conclusion?: undefined;
                            name?: undefined;
                        })[];
                    };
                } | null | undefined;
                message: string;
            };
        }[];
    };
    reviewRequests: {
        totalCount: number;
    };
    reviews: {
        nodes: {
            author: {
                login: string;
            };
            authorAssociation: CommentAuthorAssociation;
            bodyText: string;
            commit: {
                oid: string;
            };
        }[];
    };
    maintainerCanModify: boolean;
    viewerDidAuthor: boolean;
    headRefOid: string;
    headRef: {
        name: string;
        repository: {
            url: string;
            nameWithOwner: string;
        };
    };
    baseRef: {
        name: string;
        repository: {
            url: string;
            nameWithOwner: string;
        };
    };
    baseRefName: string;
    title: string;
    labels: {
        nodes: {
            name: string;
        }[];
    };
};
export type PullRequestFromGithub = typeof PR_SCHEMA;
export declare const PR_FILES_SCHEMA: {
    path: string;
};
export type PullRequestFilesFromGithub = typeof PR_FILES_SCHEMA;
export declare const PR_COMMENTS_SCHEMA: {
    author: {
        login: string;
    };
    authorAssociation: CommentAuthorAssociation;
    bodyText: string;
};
export type PullRequestCommentsFromGithub = typeof PR_COMMENTS_SCHEMA;
/** Type describing the normalized and combined status of a pull request. */
export type PullRequestStatusInfo = {
    combinedStatus: PullRequestStatus;
    statuses: {
        status: PullRequestStatus;
        type: 'check' | 'status';
        name: string;
    }[];
};
/** Fetches a pull request from Github. Returns null if an error occurred. */
export declare function fetchPullRequestFromGithub(git: AuthenticatedGitClient, prNumber: number): Promise<PullRequestFromGithub | null>;
/** Fetches a pull request from Github. Returns null if an error occurred. */
export declare function fetchPendingPullRequestsFromGithub(git: AuthenticatedGitClient): Promise<PullRequestFromGithub[] | null>;
/** Fetches a pull request from Github. Returns null if an error occurred. */
export declare function fetchPullRequestFilesFromGithub(git: AuthenticatedGitClient, prNumber: number): Promise<PullRequestFilesFromGithub[] | null>;
/** Fetches a pull request from Github. Returns null if an error occurred. */
export declare function fetchPullRequestCommentsFromGithub(git: AuthenticatedGitClient, prNumber: number): Promise<PullRequestCommentsFromGithub[] | null>;
/**
 * Gets the statuses for a commit from a pull request, using a consistent interface
 * for both status and checks results.
 */
export declare function getStatusesForPullRequest(pullRequest: PullRequestFromGithub): PullRequestStatusInfo;
