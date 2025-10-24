import { Commit } from '../../../commit-message/parse.js';
import { ActiveReleaseTrains } from '../../../release/versioning/active-release-trains.js';
import { PullRequestConfig } from '../../config/index.js';
import { TargetLabel } from '../labels/target.js';
export declare const changesAllowForTargetLabelValidation: {
    run(validationConfig: import("../../config/index.js").PullRequestValidationConfig, commits: Commit[], targetLabel: TargetLabel, config: PullRequestConfig, releaseTrains: ActiveReleaseTrains, labelsOnPullRequest: string[], pullRequest: {
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
                                state?: undefined;
                                context?: undefined;
                            } | {
                                __typename: "StatusContext";
                                state: import("@octokit/graphql-schema").StatusState;
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
    }): Promise<import("./validation-failure.js").PullRequestValidationFailure | null>;
};
