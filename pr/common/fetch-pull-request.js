import { getPendingPrs, getPr, getPrFiles, getPrComments } from '../../utils/github.js';
import { alias, types as graphqlTypes, onUnion, optional, params } from 'typed-graphqlify';
export var PullRequestStatus;
(function (PullRequestStatus) {
    PullRequestStatus[PullRequestStatus["PASSING"] = 0] = "PASSING";
    PullRequestStatus[PullRequestStatus["FAILING"] = 1] = "FAILING";
    PullRequestStatus[PullRequestStatus["PENDING"] = 2] = "PENDING";
})(PullRequestStatus || (PullRequestStatus = {}));
export const PR_SCHEMA = {
    url: graphqlTypes.string,
    isDraft: graphqlTypes.boolean,
    state: graphqlTypes.custom(),
    number: graphqlTypes.number,
    mergeable: graphqlTypes.custom(),
    updatedAt: graphqlTypes.string,
    [alias('baseCommitInfo', 'commits')]: params({ first: 1 }, { nodes: [{ commit: { parents: params({ first: 1 }, { nodes: [{ oid: graphqlTypes.string }] }) } }] }),
    commits: params({ last: 100 }, {
        totalCount: graphqlTypes.number,
        nodes: [
            {
                commit: {
                    oid: graphqlTypes.string,
                    authoredDate: graphqlTypes.string,
                    statusCheckRollup: optional({
                        state: graphqlTypes.custom(),
                        contexts: params({ last: 100 }, {
                            nodes: [
                                onUnion({
                                    CheckRun: {
                                        __typename: graphqlTypes.constant('CheckRun'),
                                        status: graphqlTypes.custom(),
                                        conclusion: graphqlTypes.custom(),
                                        name: graphqlTypes.string,
                                    },
                                    StatusContext: {
                                        __typename: graphqlTypes.constant('StatusContext'),
                                        state: graphqlTypes.custom(),
                                        context: graphqlTypes.string,
                                    },
                                }),
                            ],
                        }),
                    }),
                    message: graphqlTypes.string,
                },
            },
        ],
    }),
    reviewRequests: {
        totalCount: graphqlTypes.number,
    },
    reviews: params({ last: 100, states: 'APPROVED' }, {
        nodes: [
            {
                author: {
                    login: graphqlTypes.string,
                },
                authorAssociation: graphqlTypes.custom(),
                bodyText: graphqlTypes.string,
                commit: {
                    oid: graphqlTypes.string,
                },
            },
        ],
    }),
    maintainerCanModify: graphqlTypes.boolean,
    viewerDidAuthor: graphqlTypes.boolean,
    headRefOid: graphqlTypes.string,
    headRef: {
        name: graphqlTypes.string,
        repository: {
            url: graphqlTypes.string,
            nameWithOwner: graphqlTypes.string,
        },
    },
    baseRef: {
        name: graphqlTypes.string,
        repository: {
            url: graphqlTypes.string,
            nameWithOwner: graphqlTypes.string,
        },
    },
    baseRefName: graphqlTypes.string,
    title: graphqlTypes.string,
    labels: params({ first: 100 }, {
        nodes: [
            {
                name: graphqlTypes.string,
            },
        ],
    }),
    author: {
        login: graphqlTypes.string,
    },
    closingIssuesReferences: params({ first: 100 }, {
        nodes: [
            {
                number: graphqlTypes.number,
                state: graphqlTypes.custom(),
            },
        ],
    }),
};
export const PR_FILES_SCHEMA = params({ first: 100 }, {
    path: graphqlTypes.string,
});
export const PR_COMMENTS_SCHEMA = params({ first: 100 }, {
    author: {
        login: graphqlTypes.string,
    },
    authorAssociation: graphqlTypes.custom(),
    bodyText: graphqlTypes.string,
});
export async function fetchPullRequestFromGithub(git, prNumber) {
    return await getPr(PR_SCHEMA, prNumber, git);
}
export async function fetchPendingPullRequestsFromGithub(git) {
    return await getPendingPrs(PR_SCHEMA, git);
}
export async function fetchPullRequestFilesFromGithub(git, prNumber) {
    return await getPrFiles(PR_FILES_SCHEMA, prNumber, git);
}
export async function fetchPullRequestCommentsFromGithub(git, prNumber) {
    return await getPrComments(PR_COMMENTS_SCHEMA, prNumber, git);
}
export function getStatusesForPullRequest(pullRequest) {
    const nodes = pullRequest.commits.nodes;
    const { statusCheckRollup } = nodes[nodes.length - 1].commit;
    if (!statusCheckRollup) {
        return {
            combinedStatus: PullRequestStatus.FAILING,
            statuses: [],
        };
    }
    const statuses = statusCheckRollup.contexts.nodes.map((context) => {
        switch (context.__typename) {
            case 'CheckRun':
                return {
                    type: 'check',
                    name: context.name,
                    status: normalizeGithubCheckState(context.conclusion, context.status),
                };
            case 'StatusContext':
                return {
                    type: 'status',
                    name: context.context,
                    status: normalizeGithubStatusState(context.state),
                };
        }
    });
    return {
        combinedStatus: normalizeGithubStatusState(statusCheckRollup.state),
        statuses,
    };
}
function normalizeGithubStatusState(state) {
    switch (state) {
        case 'FAILURE':
        case 'ERROR':
            return PullRequestStatus.FAILING;
        case 'PENDING':
            return PullRequestStatus.PENDING;
        case 'SUCCESS':
        case 'EXPECTED':
            return PullRequestStatus.PASSING;
    }
}
function normalizeGithubCheckState(conclusion, status) {
    if (status !== 'COMPLETED') {
        return PullRequestStatus.PENDING;
    }
    switch (conclusion) {
        case 'ACTION_REQUIRED':
        case 'TIMED_OUT':
        case 'CANCELLED':
        case 'FAILURE':
        case 'SKIPPED':
        case 'STALE':
        case 'STARTUP_FAILURE':
            return PullRequestStatus.FAILING;
        case 'SUCCESS':
        case 'NEUTRAL':
            return PullRequestStatus.PASSING;
    }
}
//# sourceMappingURL=fetch-pull-request.js.map