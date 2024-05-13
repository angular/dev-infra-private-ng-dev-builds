/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { getPendingPrs, getPr, getPrFiles, getPrComments } from '../../utils/github.js';
import { alias, types as graphqlTypes, onUnion, optional, params } from 'typed-graphqlify';
/** A status for a pull request status or check. */
export var PullRequestStatus;
(function (PullRequestStatus) {
    PullRequestStatus[PullRequestStatus["PASSING"] = 0] = "PASSING";
    PullRequestStatus[PullRequestStatus["FAILING"] = 1] = "FAILING";
    PullRequestStatus[PullRequestStatus["PENDING"] = 2] = "PENDING";
})(PullRequestStatus || (PullRequestStatus = {}));
/** Graphql schema for the response body the requested pull request. */
export const PR_SCHEMA = {
    url: graphqlTypes.string,
    isDraft: graphqlTypes.boolean,
    state: graphqlTypes.custom(),
    number: graphqlTypes.number,
    mergeable: graphqlTypes.custom(),
    updatedAt: graphqlTypes.string,
    // Along with the `commits` queried below, we always query the oldest commit in the PR and
    // determine its parent SHA. This is the base SHA of a pull request. Note that this is different
    // to the `baseRefOid` which is based on when the PR has been created and the attached base branch.
    [alias('baseCommitInfo', 'commits')]: params({ first: 1 }, { nodes: [{ commit: { parents: params({ first: 1 }, { nodes: [{ oid: graphqlTypes.string }] }) } }] }),
    // Only the last 100 commits from a pull request are obtained as we likely will never see a pull
    // requests with more than 100 commits.
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
/** Fetches a pull request from Github. Returns null if an error occurred. */
export async function fetchPullRequestFromGithub(git, prNumber) {
    return await getPr(PR_SCHEMA, prNumber, git);
}
/** Fetches a pull request from Github. Returns null if an error occurred. */
export async function fetchPendingPullRequestsFromGithub(git) {
    return await getPendingPrs(PR_SCHEMA, git);
}
/** Fetches a pull request from Github. Returns null if an error occurred. */
export async function fetchPullRequestFilesFromGithub(git, prNumber) {
    return await getPrFiles(PR_FILES_SCHEMA, prNumber, git);
}
/** Fetches a pull request from Github. Returns null if an error occurred. */
export async function fetchPullRequestCommentsFromGithub(git, prNumber) {
    return await getPrComments(PR_COMMENTS_SCHEMA, prNumber, git);
}
/**
 * Gets the statuses for a commit from a pull request, using a consistent interface
 * for both status and checks results.
 */
export function getStatusesForPullRequest(pullRequest) {
    const nodes = pullRequest.commits.nodes;
    /** The combined github status and github checks object. */
    const { statusCheckRollup } = nodes[nodes.length - 1].commit;
    // If there is no status check rollup (i.e. no status nor checks), we
    // consider the pull request status as failing.
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
/** Retrieve the normalized PullRequestStatus for the provided github status state. */
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
/** Retrieve the normalized PullRequestStatus for the provided github check state. */
function normalizeGithubCheckState(conclusion, status) {
    if (status !== 'COMPLETED') {
        return PullRequestStatus.PENDING;
    }
    // If the `status` is completed, a conclusion is guaranteed to be set.
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmV0Y2gtcHVsbC1yZXF1ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL2NvbW1vbi9mZXRjaC1wdWxsLXJlcXVlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBVUgsT0FBTyxFQUFDLGFBQWEsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQ3RGLE9BQU8sRUFBQyxLQUFLLEVBQUUsS0FBSyxJQUFJLFlBQVksRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBSXpGLG1EQUFtRDtBQUNuRCxNQUFNLENBQU4sSUFBWSxpQkFJWDtBQUpELFdBQVksaUJBQWlCO0lBQzNCLCtEQUFPLENBQUE7SUFDUCwrREFBTyxDQUFBO0lBQ1AsK0RBQU8sQ0FBQTtBQUNULENBQUMsRUFKVyxpQkFBaUIsS0FBakIsaUJBQWlCLFFBSTVCO0FBRUQsdUVBQXVFO0FBQ3ZFLE1BQU0sQ0FBQyxNQUFNLFNBQVMsR0FBRztJQUN2QixHQUFHLEVBQUUsWUFBWSxDQUFDLE1BQU07SUFDeEIsT0FBTyxFQUFFLFlBQVksQ0FBQyxPQUFPO0lBQzdCLEtBQUssRUFBRSxZQUFZLENBQUMsTUFBTSxFQUFvQjtJQUM5QyxNQUFNLEVBQUUsWUFBWSxDQUFDLE1BQU07SUFDM0IsU0FBUyxFQUFFLFlBQVksQ0FBQyxNQUFNLEVBQWtCO0lBQ2hELFNBQVMsRUFBRSxZQUFZLENBQUMsTUFBTTtJQUM5QiwwRkFBMEY7SUFDMUYsZ0dBQWdHO0lBQ2hHLG1HQUFtRztJQUNuRyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxTQUFTLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FDMUMsRUFBQyxLQUFLLEVBQUUsQ0FBQyxFQUFDLEVBQ1YsRUFBQyxLQUFLLEVBQUUsQ0FBQyxFQUFDLE1BQU0sRUFBRSxFQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsRUFBQyxLQUFLLEVBQUUsQ0FBQyxFQUFDLEVBQUUsRUFBQyxLQUFLLEVBQUUsQ0FBQyxFQUFDLEdBQUcsRUFBRSxZQUFZLENBQUMsTUFBTSxFQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsRUFBQyxDQUFDLEVBQUMsQ0FDMUY7SUFDRCxnR0FBZ0c7SUFDaEcsdUNBQXVDO0lBQ3ZDLE9BQU8sRUFBRSxNQUFNLENBQ2IsRUFBQyxJQUFJLEVBQUUsR0FBRyxFQUFDLEVBQ1g7UUFDRSxVQUFVLEVBQUUsWUFBWSxDQUFDLE1BQU07UUFDL0IsS0FBSyxFQUFFO1lBQ0w7Z0JBQ0UsTUFBTSxFQUFFO29CQUNOLEdBQUcsRUFBRSxZQUFZLENBQUMsTUFBTTtvQkFDeEIsWUFBWSxFQUFFLFlBQVksQ0FBQyxNQUFNO29CQUNqQyxpQkFBaUIsRUFBRSxRQUFRLENBQUM7d0JBQzFCLEtBQUssRUFBRSxZQUFZLENBQUMsTUFBTSxFQUFlO3dCQUN6QyxRQUFRLEVBQUUsTUFBTSxDQUNkLEVBQUMsSUFBSSxFQUFFLEdBQUcsRUFBQyxFQUNYOzRCQUNFLEtBQUssRUFBRTtnQ0FDTCxPQUFPLENBQUM7b0NBQ04sUUFBUSxFQUFFO3dDQUNSLFVBQVUsRUFBRSxZQUFZLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQzt3Q0FDN0MsTUFBTSxFQUFFLFlBQVksQ0FBQyxNQUFNLEVBQW9CO3dDQUMvQyxVQUFVLEVBQUUsWUFBWSxDQUFDLE1BQU0sRUFBK0I7d0NBQzlELElBQUksRUFBRSxZQUFZLENBQUMsTUFBTTtxQ0FDMUI7b0NBQ0QsYUFBYSxFQUFFO3dDQUNiLFVBQVUsRUFBRSxZQUFZLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQzt3Q0FDbEQsS0FBSyxFQUFFLFlBQVksQ0FBQyxNQUFNLEVBQWU7d0NBQ3pDLE9BQU8sRUFBRSxZQUFZLENBQUMsTUFBTTtxQ0FDN0I7aUNBQ0YsQ0FBQzs2QkFDSDt5QkFDRixDQUNGO3FCQUNGLENBQUM7b0JBQ0YsT0FBTyxFQUFFLFlBQVksQ0FBQyxNQUFNO2lCQUM3QjthQUNGO1NBQ0Y7S0FDRixDQUNGO0lBQ0QsY0FBYyxFQUFFO1FBQ2QsVUFBVSxFQUFFLFlBQVksQ0FBQyxNQUFNO0tBQ2hDO0lBQ0QsT0FBTyxFQUFFLE1BQU0sQ0FDYixFQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBQyxFQUMvQjtRQUNFLEtBQUssRUFBRTtZQUNMO2dCQUNFLE1BQU0sRUFBRTtvQkFDTixLQUFLLEVBQUUsWUFBWSxDQUFDLE1BQU07aUJBQzNCO2dCQUNELGlCQUFpQixFQUFFLFlBQVksQ0FBQyxNQUFNLEVBQTRCO2dCQUNsRSxRQUFRLEVBQUUsWUFBWSxDQUFDLE1BQU07Z0JBQzdCLE1BQU0sRUFBRTtvQkFDTixHQUFHLEVBQUUsWUFBWSxDQUFDLE1BQU07aUJBQ3pCO2FBQ0Y7U0FDRjtLQUNGLENBQ0Y7SUFDRCxtQkFBbUIsRUFBRSxZQUFZLENBQUMsT0FBTztJQUN6QyxlQUFlLEVBQUUsWUFBWSxDQUFDLE9BQU87SUFDckMsVUFBVSxFQUFFLFlBQVksQ0FBQyxNQUFNO0lBQy9CLE9BQU8sRUFBRTtRQUNQLElBQUksRUFBRSxZQUFZLENBQUMsTUFBTTtRQUN6QixVQUFVLEVBQUU7WUFDVixHQUFHLEVBQUUsWUFBWSxDQUFDLE1BQU07WUFDeEIsYUFBYSxFQUFFLFlBQVksQ0FBQyxNQUFNO1NBQ25DO0tBQ0Y7SUFDRCxPQUFPLEVBQUU7UUFDUCxJQUFJLEVBQUUsWUFBWSxDQUFDLE1BQU07UUFDekIsVUFBVSxFQUFFO1lBQ1YsR0FBRyxFQUFFLFlBQVksQ0FBQyxNQUFNO1lBQ3hCLGFBQWEsRUFBRSxZQUFZLENBQUMsTUFBTTtTQUNuQztLQUNGO0lBQ0QsV0FBVyxFQUFFLFlBQVksQ0FBQyxNQUFNO0lBQ2hDLEtBQUssRUFBRSxZQUFZLENBQUMsTUFBTTtJQUMxQixNQUFNLEVBQUUsTUFBTSxDQUNaLEVBQUMsS0FBSyxFQUFFLEdBQUcsRUFBQyxFQUNaO1FBQ0UsS0FBSyxFQUFFO1lBQ0w7Z0JBQ0UsSUFBSSxFQUFFLFlBQVksQ0FBQyxNQUFNO2FBQzFCO1NBQ0Y7S0FDRixDQUNGO0NBQ0YsQ0FBQztBQUlGLE1BQU0sQ0FBQyxNQUFNLGVBQWUsR0FBRyxNQUFNLENBQ25DLEVBQUMsS0FBSyxFQUFFLEdBQUcsRUFBQyxFQUNaO0lBQ0UsSUFBSSxFQUFFLFlBQVksQ0FBQyxNQUFNO0NBQzFCLENBQ0YsQ0FBQztBQUlGLE1BQU0sQ0FBQyxNQUFNLGtCQUFrQixHQUFHLE1BQU0sQ0FDdEMsRUFBQyxLQUFLLEVBQUUsR0FBRyxFQUFDLEVBQ1o7SUFDRSxNQUFNLEVBQUU7UUFDTixLQUFLLEVBQUUsWUFBWSxDQUFDLE1BQU07S0FDM0I7SUFDRCxpQkFBaUIsRUFBRSxZQUFZLENBQUMsTUFBTSxFQUE0QjtJQUNsRSxRQUFRLEVBQUUsWUFBWSxDQUFDLE1BQU07Q0FDOUIsQ0FDRixDQUFDO0FBY0YsNkVBQTZFO0FBQzdFLE1BQU0sQ0FBQyxLQUFLLFVBQVUsMEJBQTBCLENBQzlDLEdBQTJCLEVBQzNCLFFBQWdCO0lBRWhCLE9BQU8sTUFBTSxLQUFLLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUMvQyxDQUFDO0FBRUQsNkVBQTZFO0FBQzdFLE1BQU0sQ0FBQyxLQUFLLFVBQVUsa0NBQWtDLENBQ3RELEdBQTJCO0lBRTNCLE9BQU8sTUFBTSxhQUFhLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzdDLENBQUM7QUFFRCw2RUFBNkU7QUFDN0UsTUFBTSxDQUFDLEtBQUssVUFBVSwrQkFBK0IsQ0FDbkQsR0FBMkIsRUFDM0IsUUFBZ0I7SUFFaEIsT0FBTyxNQUFNLFVBQVUsQ0FBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzFELENBQUM7QUFFRCw2RUFBNkU7QUFDN0UsTUFBTSxDQUFDLEtBQUssVUFBVSxrQ0FBa0MsQ0FDdEQsR0FBMkIsRUFDM0IsUUFBZ0I7SUFFaEIsT0FBTyxNQUFNLGFBQWEsQ0FBQyxrQkFBa0IsRUFBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDaEUsQ0FBQztBQUVEOzs7R0FHRztBQUNILE1BQU0sVUFBVSx5QkFBeUIsQ0FDdkMsV0FBa0M7SUFFbEMsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFDeEMsMkRBQTJEO0lBQzNELE1BQU0sRUFBQyxpQkFBaUIsRUFBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztJQUUzRCxxRUFBcUU7SUFDckUsK0NBQStDO0lBQy9DLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQ3ZCLE9BQU87WUFDTCxjQUFjLEVBQUUsaUJBQWlCLENBQUMsT0FBTztZQUN6QyxRQUFRLEVBQUUsRUFBRTtTQUNiLENBQUM7SUFDSixDQUFDO0lBRUQsTUFBTSxRQUFRLEdBQUcsaUJBQWlCLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTtRQUNoRSxRQUFRLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUMzQixLQUFLLFVBQVU7Z0JBQ2IsT0FBTztvQkFDTCxJQUFJLEVBQUUsT0FBZ0I7b0JBQ3RCLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtvQkFDbEIsTUFBTSxFQUFFLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQztpQkFDdEUsQ0FBQztZQUNKLEtBQUssZUFBZTtnQkFDbEIsT0FBTztvQkFDTCxJQUFJLEVBQUUsUUFBaUI7b0JBQ3ZCLElBQUksRUFBRSxPQUFPLENBQUMsT0FBTztvQkFDckIsTUFBTSxFQUFFLDBCQUEwQixDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7aUJBQ2xELENBQUM7UUFDTixDQUFDO0lBQ0gsQ0FBQyxDQUFDLENBQUM7SUFFSCxPQUFPO1FBQ0wsY0FBYyxFQUFFLDBCQUEwQixDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQztRQUNuRSxRQUFRO0tBQ1QsQ0FBQztBQUNKLENBQUM7QUFFRCxzRkFBc0Y7QUFDdEYsU0FBUywwQkFBMEIsQ0FBQyxLQUFrQjtJQUNwRCxRQUFRLEtBQUssRUFBRSxDQUFDO1FBQ2QsS0FBSyxTQUFTLENBQUM7UUFDZixLQUFLLE9BQU87WUFDVixPQUFPLGlCQUFpQixDQUFDLE9BQU8sQ0FBQztRQUNuQyxLQUFLLFNBQVM7WUFDWixPQUFPLGlCQUFpQixDQUFDLE9BQU8sQ0FBQztRQUNuQyxLQUFLLFNBQVMsQ0FBQztRQUNmLEtBQUssVUFBVTtZQUNiLE9BQU8saUJBQWlCLENBQUMsT0FBTyxDQUFDO0lBQ3JDLENBQUM7QUFDSCxDQUFDO0FBRUQscUZBQXFGO0FBQ3JGLFNBQVMseUJBQXlCLENBQ2hDLFVBQXVDLEVBQ3ZDLE1BQXdCO0lBRXhCLElBQUksTUFBTSxLQUFLLFdBQVcsRUFBRSxDQUFDO1FBQzNCLE9BQU8saUJBQWlCLENBQUMsT0FBTyxDQUFDO0lBQ25DLENBQUM7SUFFRCxzRUFBc0U7SUFDdEUsUUFBUSxVQUFXLEVBQUUsQ0FBQztRQUNwQixLQUFLLGlCQUFpQixDQUFDO1FBQ3ZCLEtBQUssV0FBVyxDQUFDO1FBQ2pCLEtBQUssV0FBVyxDQUFDO1FBQ2pCLEtBQUssU0FBUyxDQUFDO1FBQ2YsS0FBSyxTQUFTLENBQUM7UUFDZixLQUFLLE9BQU8sQ0FBQztRQUNiLEtBQUssaUJBQWlCO1lBQ3BCLE9BQU8saUJBQWlCLENBQUMsT0FBTyxDQUFDO1FBQ25DLEtBQUssU0FBUyxDQUFDO1FBQ2YsS0FBSyxTQUFTO1lBQ1osT0FBTyxpQkFBaUIsQ0FBQyxPQUFPLENBQUM7SUFDckMsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgQ2hlY2tDb25jbHVzaW9uU3RhdGUsXG4gIENoZWNrU3RhdHVzU3RhdGUsXG4gIE1lcmdlYWJsZVN0YXRlLFxuICBQdWxsUmVxdWVzdFN0YXRlLFxuICBTdGF0dXNTdGF0ZSxcbiAgQ29tbWVudEF1dGhvckFzc29jaWF0aW9uLFxufSBmcm9tICdAb2N0b2tpdC9ncmFwaHFsLXNjaGVtYSc7XG5pbXBvcnQge2dldFBlbmRpbmdQcnMsIGdldFByLCBnZXRQckZpbGVzLCBnZXRQckNvbW1lbnRzfSBmcm9tICcuLi8uLi91dGlscy9naXRodWIuanMnO1xuaW1wb3J0IHthbGlhcywgdHlwZXMgYXMgZ3JhcGhxbFR5cGVzLCBvblVuaW9uLCBvcHRpb25hbCwgcGFyYW1zfSBmcm9tICd0eXBlZC1ncmFwaHFsaWZ5JztcblxuaW1wb3J0IHtBdXRoZW50aWNhdGVkR2l0Q2xpZW50fSBmcm9tICcuLi8uLi91dGlscy9naXQvYXV0aGVudGljYXRlZC1naXQtY2xpZW50LmpzJztcblxuLyoqIEEgc3RhdHVzIGZvciBhIHB1bGwgcmVxdWVzdCBzdGF0dXMgb3IgY2hlY2suICovXG5leHBvcnQgZW51bSBQdWxsUmVxdWVzdFN0YXR1cyB7XG4gIFBBU1NJTkcsXG4gIEZBSUxJTkcsXG4gIFBFTkRJTkcsXG59XG5cbi8qKiBHcmFwaHFsIHNjaGVtYSBmb3IgdGhlIHJlc3BvbnNlIGJvZHkgdGhlIHJlcXVlc3RlZCBwdWxsIHJlcXVlc3QuICovXG5leHBvcnQgY29uc3QgUFJfU0NIRU1BID0ge1xuICB1cmw6IGdyYXBocWxUeXBlcy5zdHJpbmcsXG4gIGlzRHJhZnQ6IGdyYXBocWxUeXBlcy5ib29sZWFuLFxuICBzdGF0ZTogZ3JhcGhxbFR5cGVzLmN1c3RvbTxQdWxsUmVxdWVzdFN0YXRlPigpLFxuICBudW1iZXI6IGdyYXBocWxUeXBlcy5udW1iZXIsXG4gIG1lcmdlYWJsZTogZ3JhcGhxbFR5cGVzLmN1c3RvbTxNZXJnZWFibGVTdGF0ZT4oKSxcbiAgdXBkYXRlZEF0OiBncmFwaHFsVHlwZXMuc3RyaW5nLFxuICAvLyBBbG9uZyB3aXRoIHRoZSBgY29tbWl0c2AgcXVlcmllZCBiZWxvdywgd2UgYWx3YXlzIHF1ZXJ5IHRoZSBvbGRlc3QgY29tbWl0IGluIHRoZSBQUiBhbmRcbiAgLy8gZGV0ZXJtaW5lIGl0cyBwYXJlbnQgU0hBLiBUaGlzIGlzIHRoZSBiYXNlIFNIQSBvZiBhIHB1bGwgcmVxdWVzdC4gTm90ZSB0aGF0IHRoaXMgaXMgZGlmZmVyZW50XG4gIC8vIHRvIHRoZSBgYmFzZVJlZk9pZGAgd2hpY2ggaXMgYmFzZWQgb24gd2hlbiB0aGUgUFIgaGFzIGJlZW4gY3JlYXRlZCBhbmQgdGhlIGF0dGFjaGVkIGJhc2UgYnJhbmNoLlxuICBbYWxpYXMoJ2Jhc2VDb21taXRJbmZvJywgJ2NvbW1pdHMnKV06IHBhcmFtcyhcbiAgICB7Zmlyc3Q6IDF9LFxuICAgIHtub2RlczogW3tjb21taXQ6IHtwYXJlbnRzOiBwYXJhbXMoe2ZpcnN0OiAxfSwge25vZGVzOiBbe29pZDogZ3JhcGhxbFR5cGVzLnN0cmluZ31dfSl9fV19LFxuICApLFxuICAvLyBPbmx5IHRoZSBsYXN0IDEwMCBjb21taXRzIGZyb20gYSBwdWxsIHJlcXVlc3QgYXJlIG9idGFpbmVkIGFzIHdlIGxpa2VseSB3aWxsIG5ldmVyIHNlZSBhIHB1bGxcbiAgLy8gcmVxdWVzdHMgd2l0aCBtb3JlIHRoYW4gMTAwIGNvbW1pdHMuXG4gIGNvbW1pdHM6IHBhcmFtcyhcbiAgICB7bGFzdDogMTAwfSxcbiAgICB7XG4gICAgICB0b3RhbENvdW50OiBncmFwaHFsVHlwZXMubnVtYmVyLFxuICAgICAgbm9kZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGNvbW1pdDoge1xuICAgICAgICAgICAgb2lkOiBncmFwaHFsVHlwZXMuc3RyaW5nLFxuICAgICAgICAgICAgYXV0aG9yZWREYXRlOiBncmFwaHFsVHlwZXMuc3RyaW5nLFxuICAgICAgICAgICAgc3RhdHVzQ2hlY2tSb2xsdXA6IG9wdGlvbmFsKHtcbiAgICAgICAgICAgICAgc3RhdGU6IGdyYXBocWxUeXBlcy5jdXN0b208U3RhdHVzU3RhdGU+KCksXG4gICAgICAgICAgICAgIGNvbnRleHRzOiBwYXJhbXMoXG4gICAgICAgICAgICAgICAge2xhc3Q6IDEwMH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbm9kZXM6IFtcbiAgICAgICAgICAgICAgICAgICAgb25Vbmlvbih7XG4gICAgICAgICAgICAgICAgICAgICAgQ2hlY2tSdW46IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9fdHlwZW5hbWU6IGdyYXBocWxUeXBlcy5jb25zdGFudCgnQ2hlY2tSdW4nKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogZ3JhcGhxbFR5cGVzLmN1c3RvbTxDaGVja1N0YXR1c1N0YXRlPigpLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uY2x1c2lvbjogZ3JhcGhxbFR5cGVzLmN1c3RvbTxDaGVja0NvbmNsdXNpb25TdGF0ZSB8IG51bGw+KCksXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBncmFwaHFsVHlwZXMuc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgU3RhdHVzQ29udGV4dDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgX190eXBlbmFtZTogZ3JhcGhxbFR5cGVzLmNvbnN0YW50KCdTdGF0dXNDb250ZXh0JyksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0ZTogZ3JhcGhxbFR5cGVzLmN1c3RvbTxTdGF0dXNTdGF0ZT4oKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQ6IGdyYXBocWxUeXBlcy5zdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGdyYXBocWxUeXBlcy5zdHJpbmcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgKSxcbiAgcmV2aWV3UmVxdWVzdHM6IHtcbiAgICB0b3RhbENvdW50OiBncmFwaHFsVHlwZXMubnVtYmVyLFxuICB9LFxuICByZXZpZXdzOiBwYXJhbXMoXG4gICAge2xhc3Q6IDEwMCwgc3RhdGVzOiAnQVBQUk9WRUQnfSxcbiAgICB7XG4gICAgICBub2RlczogW1xuICAgICAgICB7XG4gICAgICAgICAgYXV0aG9yOiB7XG4gICAgICAgICAgICBsb2dpbjogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGF1dGhvckFzc29jaWF0aW9uOiBncmFwaHFsVHlwZXMuY3VzdG9tPENvbW1lbnRBdXRob3JBc3NvY2lhdGlvbj4oKSxcbiAgICAgICAgICBib2R5VGV4dDogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgICAgICAgICBjb21taXQ6IHtcbiAgICAgICAgICAgIG9pZDogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICApLFxuICBtYWludGFpbmVyQ2FuTW9kaWZ5OiBncmFwaHFsVHlwZXMuYm9vbGVhbixcbiAgdmlld2VyRGlkQXV0aG9yOiBncmFwaHFsVHlwZXMuYm9vbGVhbixcbiAgaGVhZFJlZk9pZDogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgaGVhZFJlZjoge1xuICAgIG5hbWU6IGdyYXBocWxUeXBlcy5zdHJpbmcsXG4gICAgcmVwb3NpdG9yeToge1xuICAgICAgdXJsOiBncmFwaHFsVHlwZXMuc3RyaW5nLFxuICAgICAgbmFtZVdpdGhPd25lcjogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgICB9LFxuICB9LFxuICBiYXNlUmVmOiB7XG4gICAgbmFtZTogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgICByZXBvc2l0b3J5OiB7XG4gICAgICB1cmw6IGdyYXBocWxUeXBlcy5zdHJpbmcsXG4gICAgICBuYW1lV2l0aE93bmVyOiBncmFwaHFsVHlwZXMuc3RyaW5nLFxuICAgIH0sXG4gIH0sXG4gIGJhc2VSZWZOYW1lOiBncmFwaHFsVHlwZXMuc3RyaW5nLFxuICB0aXRsZTogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgbGFiZWxzOiBwYXJhbXMoXG4gICAge2ZpcnN0OiAxMDB9LFxuICAgIHtcbiAgICAgIG5vZGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBncmFwaHFsVHlwZXMuc3RyaW5nLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9LFxuICApLFxufTtcblxuZXhwb3J0IHR5cGUgUHVsbFJlcXVlc3RGcm9tR2l0aHViID0gdHlwZW9mIFBSX1NDSEVNQTtcblxuZXhwb3J0IGNvbnN0IFBSX0ZJTEVTX1NDSEVNQSA9IHBhcmFtcyhcbiAge2ZpcnN0OiAxMDB9LFxuICB7XG4gICAgcGF0aDogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgfSxcbik7XG5cbmV4cG9ydCB0eXBlIFB1bGxSZXF1ZXN0RmlsZXNGcm9tR2l0aHViID0gdHlwZW9mIFBSX0ZJTEVTX1NDSEVNQTtcblxuZXhwb3J0IGNvbnN0IFBSX0NPTU1FTlRTX1NDSEVNQSA9IHBhcmFtcyhcbiAge2ZpcnN0OiAxMDB9LFxuICB7XG4gICAgYXV0aG9yOiB7XG4gICAgICBsb2dpbjogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgICB9LFxuICAgIGF1dGhvckFzc29jaWF0aW9uOiBncmFwaHFsVHlwZXMuY3VzdG9tPENvbW1lbnRBdXRob3JBc3NvY2lhdGlvbj4oKSxcbiAgICBib2R5VGV4dDogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgfSxcbik7XG5cbmV4cG9ydCB0eXBlIFB1bGxSZXF1ZXN0Q29tbWVudHNGcm9tR2l0aHViID0gdHlwZW9mIFBSX0NPTU1FTlRTX1NDSEVNQTtcblxuLyoqIFR5cGUgZGVzY3JpYmluZyB0aGUgbm9ybWFsaXplZCBhbmQgY29tYmluZWQgc3RhdHVzIG9mIGEgcHVsbCByZXF1ZXN0LiAqL1xuZXhwb3J0IHR5cGUgUHVsbFJlcXVlc3RTdGF0dXNJbmZvID0ge1xuICBjb21iaW5lZFN0YXR1czogUHVsbFJlcXVlc3RTdGF0dXM7XG4gIHN0YXR1c2VzOiB7XG4gICAgc3RhdHVzOiBQdWxsUmVxdWVzdFN0YXR1cztcbiAgICB0eXBlOiAnY2hlY2snIHwgJ3N0YXR1cyc7XG4gICAgbmFtZTogc3RyaW5nO1xuICB9W107XG59O1xuXG4vKiogRmV0Y2hlcyBhIHB1bGwgcmVxdWVzdCBmcm9tIEdpdGh1Yi4gUmV0dXJucyBudWxsIGlmIGFuIGVycm9yIG9jY3VycmVkLiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoUHVsbFJlcXVlc3RGcm9tR2l0aHViKFxuICBnaXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4gIHByTnVtYmVyOiBudW1iZXIsXG4pOiBQcm9taXNlPFB1bGxSZXF1ZXN0RnJvbUdpdGh1YiB8IG51bGw+IHtcbiAgcmV0dXJuIGF3YWl0IGdldFByKFBSX1NDSEVNQSwgcHJOdW1iZXIsIGdpdCk7XG59XG5cbi8qKiBGZXRjaGVzIGEgcHVsbCByZXF1ZXN0IGZyb20gR2l0aHViLiBSZXR1cm5zIG51bGwgaWYgYW4gZXJyb3Igb2NjdXJyZWQuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmV0Y2hQZW5kaW5nUHVsbFJlcXVlc3RzRnJvbUdpdGh1YihcbiAgZ2l0OiBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LFxuKTogUHJvbWlzZTxQdWxsUmVxdWVzdEZyb21HaXRodWJbXSB8IG51bGw+IHtcbiAgcmV0dXJuIGF3YWl0IGdldFBlbmRpbmdQcnMoUFJfU0NIRU1BLCBnaXQpO1xufVxuXG4vKiogRmV0Y2hlcyBhIHB1bGwgcmVxdWVzdCBmcm9tIEdpdGh1Yi4gUmV0dXJucyBudWxsIGlmIGFuIGVycm9yIG9jY3VycmVkLiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoUHVsbFJlcXVlc3RGaWxlc0Zyb21HaXRodWIoXG4gIGdpdDogQXV0aGVudGljYXRlZEdpdENsaWVudCxcbiAgcHJOdW1iZXI6IG51bWJlcixcbik6IFByb21pc2U8UHVsbFJlcXVlc3RGaWxlc0Zyb21HaXRodWJbXSB8IG51bGw+IHtcbiAgcmV0dXJuIGF3YWl0IGdldFByRmlsZXMoUFJfRklMRVNfU0NIRU1BLCBwck51bWJlciwgZ2l0KTtcbn1cblxuLyoqIEZldGNoZXMgYSBwdWxsIHJlcXVlc3QgZnJvbSBHaXRodWIuIFJldHVybnMgbnVsbCBpZiBhbiBlcnJvciBvY2N1cnJlZC4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaFB1bGxSZXF1ZXN0Q29tbWVudHNGcm9tR2l0aHViKFxuICBnaXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4gIHByTnVtYmVyOiBudW1iZXIsXG4pOiBQcm9taXNlPFB1bGxSZXF1ZXN0Q29tbWVudHNGcm9tR2l0aHViW10gfCBudWxsPiB7XG4gIHJldHVybiBhd2FpdCBnZXRQckNvbW1lbnRzKFBSX0NPTU1FTlRTX1NDSEVNQSwgcHJOdW1iZXIsIGdpdCk7XG59XG5cbi8qKlxuICogR2V0cyB0aGUgc3RhdHVzZXMgZm9yIGEgY29tbWl0IGZyb20gYSBwdWxsIHJlcXVlc3QsIHVzaW5nIGEgY29uc2lzdGVudCBpbnRlcmZhY2VcbiAqIGZvciBib3RoIHN0YXR1cyBhbmQgY2hlY2tzIHJlc3VsdHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRTdGF0dXNlc0ZvclB1bGxSZXF1ZXN0KFxuICBwdWxsUmVxdWVzdDogUHVsbFJlcXVlc3RGcm9tR2l0aHViLFxuKTogUHVsbFJlcXVlc3RTdGF0dXNJbmZvIHtcbiAgY29uc3Qgbm9kZXMgPSBwdWxsUmVxdWVzdC5jb21taXRzLm5vZGVzO1xuICAvKiogVGhlIGNvbWJpbmVkIGdpdGh1YiBzdGF0dXMgYW5kIGdpdGh1YiBjaGVja3Mgb2JqZWN0LiAqL1xuICBjb25zdCB7c3RhdHVzQ2hlY2tSb2xsdXB9ID0gbm9kZXNbbm9kZXMubGVuZ3RoIC0gMV0uY29tbWl0O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vIHN0YXR1cyBjaGVjayByb2xsdXAgKGkuZS4gbm8gc3RhdHVzIG5vciBjaGVja3MpLCB3ZVxuICAvLyBjb25zaWRlciB0aGUgcHVsbCByZXF1ZXN0IHN0YXR1cyBhcyBmYWlsaW5nLlxuICBpZiAoIXN0YXR1c0NoZWNrUm9sbHVwKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbWJpbmVkU3RhdHVzOiBQdWxsUmVxdWVzdFN0YXR1cy5GQUlMSU5HLFxuICAgICAgc3RhdHVzZXM6IFtdLFxuICAgIH07XG4gIH1cblxuICBjb25zdCBzdGF0dXNlcyA9IHN0YXR1c0NoZWNrUm9sbHVwLmNvbnRleHRzLm5vZGVzLm1hcCgoY29udGV4dCkgPT4ge1xuICAgIHN3aXRjaCAoY29udGV4dC5fX3R5cGVuYW1lKSB7XG4gICAgICBjYXNlICdDaGVja1J1bic6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHlwZTogJ2NoZWNrJyBhcyBjb25zdCxcbiAgICAgICAgICBuYW1lOiBjb250ZXh0Lm5hbWUsXG4gICAgICAgICAgc3RhdHVzOiBub3JtYWxpemVHaXRodWJDaGVja1N0YXRlKGNvbnRleHQuY29uY2x1c2lvbiwgY29udGV4dC5zdGF0dXMpLFxuICAgICAgICB9O1xuICAgICAgY2FzZSAnU3RhdHVzQ29udGV4dCc6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHlwZTogJ3N0YXR1cycgYXMgY29uc3QsXG4gICAgICAgICAgbmFtZTogY29udGV4dC5jb250ZXh0LFxuICAgICAgICAgIHN0YXR1czogbm9ybWFsaXplR2l0aHViU3RhdHVzU3RhdGUoY29udGV4dC5zdGF0ZSksXG4gICAgICAgIH07XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4ge1xuICAgIGNvbWJpbmVkU3RhdHVzOiBub3JtYWxpemVHaXRodWJTdGF0dXNTdGF0ZShzdGF0dXNDaGVja1JvbGx1cC5zdGF0ZSksXG4gICAgc3RhdHVzZXMsXG4gIH07XG59XG5cbi8qKiBSZXRyaWV2ZSB0aGUgbm9ybWFsaXplZCBQdWxsUmVxdWVzdFN0YXR1cyBmb3IgdGhlIHByb3ZpZGVkIGdpdGh1YiBzdGF0dXMgc3RhdGUuICovXG5mdW5jdGlvbiBub3JtYWxpemVHaXRodWJTdGF0dXNTdGF0ZShzdGF0ZTogU3RhdHVzU3RhdGUpOiBQdWxsUmVxdWVzdFN0YXR1cyB7XG4gIHN3aXRjaCAoc3RhdGUpIHtcbiAgICBjYXNlICdGQUlMVVJFJzpcbiAgICBjYXNlICdFUlJPUic6XG4gICAgICByZXR1cm4gUHVsbFJlcXVlc3RTdGF0dXMuRkFJTElORztcbiAgICBjYXNlICdQRU5ESU5HJzpcbiAgICAgIHJldHVybiBQdWxsUmVxdWVzdFN0YXR1cy5QRU5ESU5HO1xuICAgIGNhc2UgJ1NVQ0NFU1MnOlxuICAgIGNhc2UgJ0VYUEVDVEVEJzpcbiAgICAgIHJldHVybiBQdWxsUmVxdWVzdFN0YXR1cy5QQVNTSU5HO1xuICB9XG59XG5cbi8qKiBSZXRyaWV2ZSB0aGUgbm9ybWFsaXplZCBQdWxsUmVxdWVzdFN0YXR1cyBmb3IgdGhlIHByb3ZpZGVkIGdpdGh1YiBjaGVjayBzdGF0ZS4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZUdpdGh1YkNoZWNrU3RhdGUoXG4gIGNvbmNsdXNpb246IENoZWNrQ29uY2x1c2lvblN0YXRlIHwgbnVsbCxcbiAgc3RhdHVzOiBDaGVja1N0YXR1c1N0YXRlLFxuKTogUHVsbFJlcXVlc3RTdGF0dXMge1xuICBpZiAoc3RhdHVzICE9PSAnQ09NUExFVEVEJykge1xuICAgIHJldHVybiBQdWxsUmVxdWVzdFN0YXR1cy5QRU5ESU5HO1xuICB9XG5cbiAgLy8gSWYgdGhlIGBzdGF0dXNgIGlzIGNvbXBsZXRlZCwgYSBjb25jbHVzaW9uIGlzIGd1YXJhbnRlZWQgdG8gYmUgc2V0LlxuICBzd2l0Y2ggKGNvbmNsdXNpb24hKSB7XG4gICAgY2FzZSAnQUNUSU9OX1JFUVVJUkVEJzpcbiAgICBjYXNlICdUSU1FRF9PVVQnOlxuICAgIGNhc2UgJ0NBTkNFTExFRCc6XG4gICAgY2FzZSAnRkFJTFVSRSc6XG4gICAgY2FzZSAnU0tJUFBFRCc6XG4gICAgY2FzZSAnU1RBTEUnOlxuICAgIGNhc2UgJ1NUQVJUVVBfRkFJTFVSRSc6XG4gICAgICByZXR1cm4gUHVsbFJlcXVlc3RTdGF0dXMuRkFJTElORztcbiAgICBjYXNlICdTVUNDRVNTJzpcbiAgICBjYXNlICdORVVUUkFMJzpcbiAgICAgIHJldHVybiBQdWxsUmVxdWVzdFN0YXR1cy5QQVNTSU5HO1xuICB9XG59XG4iXX0=