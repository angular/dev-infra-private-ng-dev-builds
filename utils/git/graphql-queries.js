import { params, types } from 'typed-graphqlify';
export const findOwnedForksOfRepoQuery = params({
    $owner: 'String!',
    $name: 'String!',
}, {
    repository: params({ owner: '$owner', name: '$name' }, {
        forks: params({ affiliations: 'OWNER', first: 1, orderBy: { field: 'NAME', direction: 'ASC' } }, {
            nodes: [
                {
                    owner: {
                        login: types.string,
                    },
                    name: types.string,
                },
            ],
        }),
    }),
});
//# sourceMappingURL=graphql-queries.js.map