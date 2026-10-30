import type { PullRequestReviewState } from '@octokit/graphql-schema';
import { AuthenticatedGitClient } from '../../../utils/git/authenticated-git-client.js';
export declare const googleOwnedRobots: string[];
export declare const minimumReviewsValidation: {
    run(validationConfig: import("../../config/index.js").PullRequestValidationConfig, pullRequest: {
        url: string;
        isDraft: boolean;
        state: import("@octokit/graphql-schema").PullRequestState;
        number: number;
        mergeable: import("@octokit/graphql-schema").MergeableState;
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
                    committedDate: string;
                    pushedDate: string | null;
                    author: {
                        user: {
                            login: string;
                        } | null | undefined;
                    } | null | undefined;
                    committer: {
                        user: {
                            login: string;
                        } | null | undefined;
                    } | null | undefined;
                    statusCheckRollup: {
                        state: import("@octokit/graphql-schema").StatusState;
                        contexts: {
                            nodes: ({
                                __typename: "CheckRun";
                                status: import("@octokit/graphql-schema").CheckStatusState;
                                conclusion: import("@octokit/graphql-schema").CheckConclusionState | null;
                                name: string;
                                completedAt: string;
                                state?: undefined;
                                context?: undefined;
                                description?: undefined;
                                createdAt?: undefined;
                            } | {
                                __typename: "StatusContext";
                                state: import("@octokit/graphql-schema").StatusState;
                                context: string;
                                description: string | null | undefined;
                                createdAt: string;
                                status?: undefined;
                                conclusion?: undefined;
                                name?: undefined;
                                completedAt?: undefined;
                            })[];
                        };
                    } | null | undefined;
                    message: string;
                };
            }[];
        };
        reviewRequests: {
            totalCount: number;
            nodes: {
                requestedReviewer: {
                    login: string;
                } | null | undefined;
            }[];
        };
        reviews: {
            nodes: {
                author: {
                    login: string;
                };
                authorAssociation: import("@octokit/graphql-schema").CommentAuthorAssociation;
                state: PullRequestReviewState;
                submittedAt: string;
                bodyText: string;
                commit: {
                    oid: string;
                } | null | undefined;
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
                state: import("@octokit/graphql-schema").IssueState;
            }[];
        };
    }, gitClient?: AuthenticatedGitClient | undefined): Promise<import("./validation-failure.js").PullRequestValidationFailure | null>;
};
