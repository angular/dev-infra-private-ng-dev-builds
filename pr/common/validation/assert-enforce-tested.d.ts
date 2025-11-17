import { PullRequestCommentsFromGithub } from '../fetch-pull-request.js';
import { AuthenticatedGitClient } from '../../../utils/git/authenticated-git-client.js';
export declare const enforceTestedValidation: {
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
                                createdAt?: undefined;
                            } | {
                                __typename: "StatusContext";
                                state: import("@octokit/graphql-schema").StatusState;
                                context: string;
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
        };
        reviews: {
            nodes: {
                author: {
                    login: string;
                };
                authorAssociation: import("@octokit/graphql-schema").CommentAuthorAssociation;
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
                state: import("@octokit/graphql-schema").IssueState;
            }[];
        };
    }, gitClient: AuthenticatedGitClient): Promise<import("./validation-failure.js").PullRequestValidationFailure | null>;
};
export declare class PullRequestComments {
    private git;
    private prNumber;
    constructor(git: AuthenticatedGitClient, prNumber: number);
    loadPullRequestComments(): Promise<PullRequestCommentsFromGithub[]>;
    static create(git: AuthenticatedGitClient, prNumber: number): PullRequestComments;
}
export declare function pullRequestHasValidTestedComment(comments: PullRequestCommentsFromGithub[], gitClient: AuthenticatedGitClient): Promise<boolean>;
