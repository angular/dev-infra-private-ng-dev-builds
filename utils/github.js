import { params, types } from 'typed-graphqlify';
import { GraphqlResponseError } from '@octokit/graphql';
export async function getPr(prSchema, prNumber, git) {
    const { owner, name } = git.remoteConfig;
    const PR_QUERY = params({
        $number: 'Int!',
        $owner: 'String!',
        $name: 'String!',
    }, {
        repository: params({ owner: '$owner', name: '$name' }, {
            pullRequest: params({ number: '$number' }, prSchema),
        }),
    });
    try {
        const result = await git.github.graphql(PR_QUERY, { number: prNumber, owner, name });
        return result.repository.pullRequest;
    }
    catch (e) {
        if (e instanceof GraphqlResponseError && e.errors?.every((e) => e.type === 'NOT_FOUND')) {
            return null;
        }
        throw e;
    }
}
export async function getPendingPrs(prSchema, git) {
    const { owner, name } = git.remoteConfig;
    const PRS_QUERY = params({
        $first: 'Int',
        $after: 'String',
        $owner: 'String!',
        $name: 'String!',
    }, {
        repository: params({ owner: '$owner', name: '$name' }, {
            pullRequests: params({
                first: '$first',
                after: '$after',
                states: `OPEN`,
            }, {
                nodes: [prSchema],
                pageInfo: {
                    hasNextPage: types.boolean,
                    endCursor: types.string,
                },
            }),
        }),
    });
    let cursor;
    let hasNextPage = true;
    const prs = [];
    while (hasNextPage) {
        const paramsValue = {
            after: cursor || null,
            first: 100,
            owner,
            name,
        };
        const results = (await git.github.graphql(PRS_QUERY, paramsValue));
        prs.push(...results.repository.pullRequests.nodes);
        hasNextPage = results.repository.pullRequests.pageInfo.hasNextPage;
        cursor = results.repository.pullRequests.pageInfo.endCursor;
    }
    return prs;
}
export async function getPrFiles(fileSchema, prNumber, git) {
    const { owner, name } = git.remoteConfig;
    const PRS_QUERY = params({
        $first: 'Int',
        $after: 'String',
        $owner: 'String!',
        $name: 'String!',
    }, {
        repository: params({ owner: '$owner', name: '$name' }, {
            pullRequest: params({
                number: prNumber,
            }, {
                files: params({
                    first: '$first',
                    after: '$after',
                }, {
                    nodes: [fileSchema],
                    pageInfo: {
                        hasNextPage: types.boolean,
                        endCursor: types.string,
                    },
                }),
            }),
        }),
    });
    let cursor;
    let hasNextPage = true;
    const files = [];
    while (hasNextPage) {
        const paramsValue = {
            after: cursor || null,
            first: 100,
            owner,
            name,
        };
        const results = await git.github.graphql(PRS_QUERY, paramsValue);
        files.push(...results.repository.pullRequest.files.nodes);
        hasNextPage = results.repository.pullRequest.files.pageInfo.hasNextPage;
        cursor = results.repository.pullRequest.files.pageInfo.endCursor;
    }
    return files;
}
export async function getPrComments(commentsSchema, prNumber, git) {
    const { owner, name } = git.remoteConfig;
    const PRS_QUERY = params({
        $first: 'Int',
        $after: 'String',
        $owner: 'String!',
        $name: 'String!',
    }, {
        repository: params({ owner: '$owner', name: '$name' }, {
            pullRequest: params({
                number: prNumber,
            }, {
                comments: params({
                    first: '$first',
                    after: '$after',
                }, {
                    nodes: [commentsSchema],
                    pageInfo: {
                        hasNextPage: types.boolean,
                        endCursor: types.string,
                    },
                }),
            }),
        }),
    });
    let cursor;
    let hasNextPage = true;
    const comments = [];
    while (hasNextPage) {
        const paramsValue = {
            after: cursor || null,
            first: 100,
            owner,
            name,
        };
        const results = await git.github.graphql(PRS_QUERY, paramsValue);
        comments.push(...results.repository.pullRequest.comments.nodes);
        hasNextPage = results.repository.pullRequest.comments.pageInfo.hasNextPage;
        cursor = results.repository.pullRequest.comments.pageInfo.endCursor;
    }
    return comments;
}
//# sourceMappingURL=github.js.map