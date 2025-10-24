import { CheckConclusionState, CheckStatusState, MergeableState, PullRequestState, StatusState, CommentAuthorAssociation, IssueState } from '@octokit/graphql-schema';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
export declare enum PullRequestStatus {
    PASSING = 0,
    FAILING = 1,
    PENDING = 2
}
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
    author: {
        login: string;
    };
    closingIssuesReferences: {
        nodes: {
            number: number;
            state: IssueState;
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
export type PullRequestStatusInfo = {
    combinedStatus: PullRequestStatus;
    statuses: {
        status: PullRequestStatus;
        type: 'check' | 'status';
        name: string;
    }[];
};
export declare function fetchPullRequestFromGithub(git: AuthenticatedGitClient, prNumber: number): Promise<PullRequestFromGithub | null>;
export declare function fetchPendingPullRequestsFromGithub(git: AuthenticatedGitClient): Promise<PullRequestFromGithub[] | null>;
export declare function fetchPullRequestFilesFromGithub(git: AuthenticatedGitClient, prNumber: number): Promise<PullRequestFilesFromGithub[] | null>;
export declare function fetchPullRequestCommentsFromGithub(git: AuthenticatedGitClient, prNumber: number): Promise<PullRequestCommentsFromGithub[] | null>;
export declare function getStatusesForPullRequest(pullRequest: PullRequestFromGithub): PullRequestStatusInfo;
