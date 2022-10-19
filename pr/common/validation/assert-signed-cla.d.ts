/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/** Assert the pull request has a signed CLA. */
export declare const signedClaValidation: {
    run(validationConfig: import("./validation-config.js").PullRequestValidationConfig, pullRequest: {
        url: string;
        isDraft: boolean;
        state: import("@octokit/graphql-schema/schema.js").PullRequestState;
        number: number;
        mergeable: import("@octokit/graphql-schema/schema.js").MergeableState;
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
                    statusCheckRollup: {
                        state: import("@octokit/graphql-schema/schema.js").StatusState;
                        contexts: {
                            nodes: ({
                                __typename: "CheckRun";
                                status: import("@octokit/graphql-schema/schema.js").CheckStatusState;
                                conclusion: import("@octokit/graphql-schema/schema.js").CheckConclusionState | null;
                                name: string;
                                state?: undefined;
                                context?: undefined;
                            } | {
                                __typename: "StatusContext";
                                state: import("@octokit/graphql-schema/schema.js").StatusState;
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
    }): Promise<import("./validation-failure.js").PullRequestValidationFailure | null>;
};
