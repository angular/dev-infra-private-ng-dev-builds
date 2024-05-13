/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { params, types } from 'typed-graphqlify';
/**
 * Graphql Github API query that can be used to find forks of a given repository
 * that are owned by the current viewer authenticated with the Github API.
 */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGhxbC1xdWVyaWVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3V0aWxzL2dpdC9ncmFwaHFsLXF1ZXJpZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUUvQzs7O0dBR0c7QUFDSCxNQUFNLENBQUMsTUFBTSx5QkFBeUIsR0FBRyxNQUFNLENBQzdDO0lBQ0UsTUFBTSxFQUFFLFNBQVM7SUFDakIsS0FBSyxFQUFFLFNBQVM7Q0FDakIsRUFDRDtJQUNFLFVBQVUsRUFBRSxNQUFNLENBQ2hCLEVBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFDLEVBQ2hDO1FBQ0UsS0FBSyxFQUFFLE1BQU0sQ0FDWCxFQUFDLFlBQVksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxPQUFPLEVBQUUsRUFBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUMsRUFBQyxFQUM3RTtZQUNFLEtBQUssRUFBRTtnQkFDTDtvQkFDRSxLQUFLLEVBQUU7d0JBQ0wsS0FBSyxFQUFFLEtBQUssQ0FBQyxNQUFNO3FCQUNwQjtvQkFDRCxJQUFJLEVBQUUsS0FBSyxDQUFDLE1BQU07aUJBQ25CO2FBQ0Y7U0FDRixDQUNGO0tBQ0YsQ0FDRjtDQUNGLENBQ0YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge3BhcmFtcywgdHlwZXN9IGZyb20gJ3R5cGVkLWdyYXBocWxpZnknO1xuXG4vKipcbiAqIEdyYXBocWwgR2l0aHViIEFQSSBxdWVyeSB0aGF0IGNhbiBiZSB1c2VkIHRvIGZpbmQgZm9ya3Mgb2YgYSBnaXZlbiByZXBvc2l0b3J5XG4gKiB0aGF0IGFyZSBvd25lZCBieSB0aGUgY3VycmVudCB2aWV3ZXIgYXV0aGVudGljYXRlZCB3aXRoIHRoZSBHaXRodWIgQVBJLlxuICovXG5leHBvcnQgY29uc3QgZmluZE93bmVkRm9ya3NPZlJlcG9RdWVyeSA9IHBhcmFtcyhcbiAge1xuICAgICRvd25lcjogJ1N0cmluZyEnLFxuICAgICRuYW1lOiAnU3RyaW5nIScsXG4gIH0sXG4gIHtcbiAgICByZXBvc2l0b3J5OiBwYXJhbXMoXG4gICAgICB7b3duZXI6ICckb3duZXInLCBuYW1lOiAnJG5hbWUnfSxcbiAgICAgIHtcbiAgICAgICAgZm9ya3M6IHBhcmFtcyhcbiAgICAgICAgICB7YWZmaWxpYXRpb25zOiAnT1dORVInLCBmaXJzdDogMSwgb3JkZXJCeToge2ZpZWxkOiAnTkFNRScsIGRpcmVjdGlvbjogJ0FTQyd9fSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBub2RlczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgb3duZXI6IHtcbiAgICAgICAgICAgICAgICAgIGxvZ2luOiB0eXBlcy5zdHJpbmcsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBuYW1lOiB0eXBlcy5zdHJpbmcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgICksXG4gICAgICB9LFxuICAgICksXG4gIH0sXG4pO1xuIl19