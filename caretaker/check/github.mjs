/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { alias, onUnion, params, types } from 'typed-graphqlify';
import { bold, Log } from '../../utils/logging.js';
import { BaseModule } from './base.js';
/** The fragment for a result from Github's api for a Github query. */
const GithubQueryResultFragment = {
    issueCount: types.number,
    nodes: [
        {
            ...onUnion({
                PullRequest: {
                    url: types.string,
                },
                Issue: {
                    url: types.string,
                },
            }),
        },
    ],
};
/**
 * Cap the returned issues in the queries to an arbitrary 20. At that point, caretaker has a lot
 * of work to do and showing more than that isn't really useful.
 */
const MAX_RETURNED_ISSUES = 20;
export class GithubQueriesModule extends BaseModule {
    async retrieveData() {
        // Non-null assertion is used here as the check for undefined immediately follows to confirm the
        // assertion.  Typescript's type filtering does not seem to work as needed to understand
        // whether githubQueries is undefined or not.
        let queries = this.config.caretaker?.githubQueries;
        if (queries === undefined || queries.length === 0) {
            Log.debug('No github queries defined in the configuration, skipping');
            return;
        }
        /** The results of the generated github query. */
        const queryResult = await this.git.github.graphql(this.buildGraphqlQuery(queries));
        const results = Object.values(queryResult);
        const { owner, name: repo } = this.git.remoteConfig;
        return results.map((result, i) => {
            const query = queries[i];
            const queryURLParam = encodeURIComponent(query.query);
            return {
                queryName: query.name,
                count: result.issueCount,
                queryUrl: `https://github.com/${owner}/${repo}/issues?q=${queryURLParam}`,
                matchedUrls: result.nodes.map((node) => node.url),
            };
        });
    }
    /** Build a Graphql query statement for the provided queries. */
    buildGraphqlQuery(queries) {
        /** The query object for graphql. */
        const graphqlQuery = {};
        const { owner, name: repo } = this.git.remoteConfig;
        /** The Github search filter for the configured repository. */
        const repoFilter = `repo:${owner}/${repo}`;
        queries.forEach(({ name, query }) => {
            /** The name of the query, with spaces removed to match Graphql requirements. */
            const queryKey = alias(name.replace(/ /g, ''), 'search');
            graphqlQuery[queryKey] = params({
                type: 'ISSUE',
                first: MAX_RETURNED_ISSUES,
                query: `"${repoFilter} ${query.replace(/\"/g, '\\"')}"`,
            }, { ...GithubQueryResultFragment });
        });
        return graphqlQuery;
    }
    async printToTerminal() {
        const queryResults = await this.data;
        if (!queryResults) {
            return;
        }
        Log.info.group(bold('Github Tasks'));
        const minQueryNameLength = Math.max(...queryResults.map((result) => result.queryName.length));
        for (const queryResult of queryResults) {
            Log.info(`${queryResult.queryName.padEnd(minQueryNameLength)}  ${queryResult.count}`);
            if (queryResult.count > 0) {
                Log.info.group(queryResult.queryUrl);
                queryResult.matchedUrls.forEach((url) => Log.info(`- ${url}`));
                if (queryResult.count > MAX_RETURNED_ISSUES) {
                    Log.info(`... ${queryResult.count - MAX_RETURNED_ISSUES} additional matches`);
                }
                Log.info.groupEnd();
            }
        }
        Log.info.groupEnd();
        Log.info();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L2NhcmV0YWtlci9jaGVjay9naXRodWIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBRS9ELE9BQU8sRUFBQyxJQUFJLEVBQUUsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFakQsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLFdBQVcsQ0FBQztBQVVyQyxzRUFBc0U7QUFDdEUsTUFBTSx5QkFBeUIsR0FBRztJQUNoQyxVQUFVLEVBQUUsS0FBSyxDQUFDLE1BQU07SUFDeEIsS0FBSyxFQUFFO1FBQ0w7WUFDRSxHQUFHLE9BQU8sQ0FBQztnQkFDVCxXQUFXLEVBQUU7b0JBQ1gsR0FBRyxFQUFFLEtBQUssQ0FBQyxNQUFNO2lCQUNsQjtnQkFDRCxLQUFLLEVBQUU7b0JBQ0wsR0FBRyxFQUFFLEtBQUssQ0FBQyxNQUFNO2lCQUNsQjthQUNGLENBQUM7U0FDSDtLQUNGO0NBQ0YsQ0FBQztBQU9GOzs7R0FHRztBQUNILE1BQU0sbUJBQW1CLEdBQUcsRUFBRSxDQUFDO0FBRS9CLE1BQU0sT0FBTyxtQkFBb0IsU0FBUSxVQUFxQztJQUNuRSxLQUFLLENBQUMsWUFBWTtRQUN6QixnR0FBZ0c7UUFDaEcsd0ZBQXdGO1FBQ3hGLDZDQUE2QztRQUM3QyxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxhQUFjLENBQUM7UUFDcEQsSUFBSSxPQUFPLEtBQUssU0FBUyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDbEQsR0FBRyxDQUFDLEtBQUssQ0FBQywwREFBMEQsQ0FBQyxDQUFDO1lBQ3RFLE9BQU87UUFDVCxDQUFDO1FBRUQsaURB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SUFBSSxXQUFXLENBQUMsS0FBSyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUMxQixHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3JDLFdBQVcsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUMvRCxJQUFJLFdBQVcsQ0FBQyxLQUFLLEdBQUcsbUJBQW1CLEVBQUUsQ0FBQztvQkFDNUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLFdBQVcsQ0FBQyxLQUFLLEdBQUcsbUJBQW1CLHFCQUFxQixDQUFDLENBQUM7Z0JBQ2hGLENBQUM7Z0JBQ0QsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN0QixDQUFDO1FBQ0gsQ0FBQztRQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDcEIsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2IsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7YWxpYXMsIG9uVW5pb24sIHBhcmFtcywgdHlwZXN9IGZyb20gJ3R5cGVkLWdyYXBocWxpZnknO1xuXG5pbXBvcnQge2JvbGQsIExvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge0NhcmV0YWtlckNvbmZpZ30gZnJvbSAnLi4vLi4vdXRpbHMvY29uZmlnLmpzJztcbmltcG9ydCB7QmFzZU1vZHVsZX0gZnJvbSAnLi9iYXNlLmpzJztcblxuLyoqIEEgbGlzdCBvZiBnZW5lcmF0ZWQgcmVzdWx0cyBmb3IgYSBnaXRodWIgcXVlcnkuICovXG50eXBlIEdpdGh1YlF1ZXJ5UmVzdWx0cyA9IHtcbiAgcXVlcnlOYW1lOiBzdHJpbmc7XG4gIGNvdW50OiBudW1iZXI7XG4gIHF1ZXJ5VXJsOiBzdHJpbmc7XG4gIG1hdGNoZWRVcmxzOiBzdHJpbmdbXTtcbn1bXTtcblxuLyoqIFRoZSBmcmFnbWVudCBmb3IgYSByZXN1bHQgZnJvbSBHaXRodWIncyBhcGkgZm9yIGEgR2l0aHViIHF1ZXJ5LiAqL1xuY29uc3QgR2l0aHViUXVlcnlSZXN1bHRGcmFnbWVudCA9IHtcbiAgaXNzdWVDb3VudDogdHlwZXMubnVtYmVyLFxuICBub2RlczogW1xuICAgIHtcbiAgICAgIC4uLm9uVW5pb24oe1xuICAgICAgICBQdWxsUmVxdWVzdDoge1xuICAgICAgICAgIHVybDogdHlwZXMuc3RyaW5nLFxuICAgICAgICB9LFxuICAgICAgICBJc3N1ZToge1xuICAgICAgICAgIHVybDogdHlwZXMuc3RyaW5nLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgfSxcbiAgXSxcbn07XG5cbi8qKiBBbiBvYmplY3QgY29udGFpbmluZyByZXN1bHRzIG9mIG11bHRpcGxlIHF1ZXJpZXMuICAqL1xudHlwZSBHaXRodWJRdWVyeVJlc3VsdCA9IHtcbiAgW2tleTogc3RyaW5nXTogdHlwZW9mIEdpdGh1YlF1ZXJ5UmVzdWx0RnJhZ21lbnQ7XG59O1xuXG4vKipcbiAqIENhcCB0aGUgcmV0dXJuZWQgaXNzdWVzIGluIHRoZSBxdWVyaWVzIHRvIGFuIGFyYml0cmFyeSAyMC4gQXQgdGhhdCBwb2ludCwgY2FyZXRha2VyIGhhcyBhIGxvdFxuICogb2Ygd29yayB0byBkbyBhbmQgc2hvd2luZyBtb3JlIHRoYW4gdGhhdCBpc24ndCByZWFsbHkgdXNlZnVsLlxuICovXG5jb25zdCBNQVhfUkVUVVJORURfSVNTVUVTID0gMjA7XG5cbmV4cG9ydCBjbGFzcyBHaXRodWJRdWVyaWVzTW9kdWxlIGV4dGVuZHMgQmFzZU1vZHVsZTxHaXRodWJRdWVyeVJlc3VsdHMgfCB2b2lkPiB7XG4gIG92ZXJyaWRlIGFzeW5jIHJldHJpZXZlRGF0YSgpIHtcbiAgICAvLyBOb24tbnVsbCBhc3NlcnRpb24gaXMgdXNlZCBoZXJlIGFzIHRoZSBjaGVjayBmb3IgdW5kZWZpbmVkIGltbWVkaWF0ZWx5IGZvbGxvd3MgdG8gY29uZmlybSB0aGVcbiAgICAvLyBhc3NlcnRpb24uICBUeXBlc2NyaXB0J3MgdHlwZSBmaWx0ZXJpbmcgZG9lcyBub3Qgc2VlbSB0byB3b3JrIGFzIG5lZWRlZCB0byB1bmRlcnN0YW5kXG4gICAgLy8gd2hldGhlciBnaXRodWJRdWVyaWVzIGlzIHVuZGVmaW5lZCBvciBub3QuXG4gICAgbGV0IHF1ZXJpZXMgPSB0aGlzLmNvbmZpZy5jYXJldGFrZXI/LmdpdGh1YlF1ZXJpZXMhO1xuICAgIGlmIChxdWVyaWVzID09PSB1bmRlZmluZWQgfHwgcXVlcmllcy5sZW5ndGggPT09IDApIHtcbiAgICAgIExvZy5kZWJ1ZygnTm8gZ2l0aHViIHF1ZXJpZXMgZGVmaW5lZCBpbiB0aGUgY29uZmlndXJhdGlvbiwgc2tpcHBpbmcnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvKiogVGhlIHJlc3VsdHMgb2YgdGhlIGdlbmVyYXRlZCBnaXRodWIgcXVlcnkuICovXG4gICAgY29uc3QgcXVlcnlSZXN1bHQgPSBhd2FpdCB0aGlzLmdpdC5naXRodWIuZ3JhcGhxbCh0aGlzLmJ1aWxkR3JhcGhxbFF1ZXJ5KHF1ZXJpZXMpKTtcbiAgICBjb25zdCByZXN1bHRzID0gT2JqZWN0LnZhbHVlcyhxdWVyeVJlc3VsdCk7XG5cbiAgICBjb25zdCB7b3duZXIsIG5hbWU6IHJlcG99ID0gdGhpcy5naXQucmVtb3RlQ29uZmlnO1xuXG4gICAgcmV0dXJuIHJlc3VsdHMubWFwKChyZXN1bHQsIGkpID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gcXVlcmllc1tpXTtcbiAgICAgIGNvbnN0IHF1ZXJ5VVJMUGFyYW0gPSBlbmNvZGVVUklDb21wb25lbnQocXVlcnkucXVlcnkpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBxdWVyeU5hbWU6IHF1ZXJ5Lm5hbWUsXG4gICAgICAgIGNvdW50OiByZXN1bHQuaXNzdWVDb3VudCxcbiAgICAgICAgcXVlcnlVcmw6IGBodHRwczovL2dpdGh1Yi5jb20vJHtvd25lcn0vJHtyZXBvfS9pc3N1ZXM/cT0ke3F1ZXJ5VVJMUGFyYW19YCxcbiAgICAgICAgbWF0Y2hlZFVybHM6IHJlc3VsdC5ub2Rlcy5tYXAoKG5vZGUpID0+IG5vZGUudXJsKSxcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICAvKiogQnVpbGQgYSBHcmFwaHFsIHF1ZXJ5IHN0YXRlbWVudCBmb3IgdGhlIHByb3ZpZGVkIHF1ZXJpZXMuICovXG4gIHByaXZhdGUgYnVpbGRHcmFwaHFsUXVlcnkocXVlcmllczogTm9uTnVsbGFibGU8Q2FyZXRha2VyQ29uZmlnWydnaXRodWJRdWVyaWVzJ10+KSB7XG4gICAgLyoqIFRoZSBxdWVyeSBvYmplY3QgZm9yIGdyYXBocWwuICovXG4gICAgY29uc3QgZ3JhcGhxbFF1ZXJ5OiBHaXRodWJRdWVyeVJlc3VsdCA9IHt9O1xuICAgIGNvbnN0IHtvd25lciwgbmFtZTogcmVwb30gPSB0aGlzLmdpdC5yZW1vdGVDb25maWc7XG4gICAgLyoqIFRoZSBHaXRodWIgc2VhcmNoIGZpbHRlciBmb3IgdGhlIGNvbmZpZ3VyZWQgcmVwb3NpdG9yeS4gKi9cbiAgICBjb25zdCByZXBvRmlsdGVyID0gYHJlcG86JHtvd25lcn0vJHtyZXBvfWA7XG5cbiAgICBxdWVyaWVzLmZvckVhY2goKHtuYW1lLCBxdWVyeX0pID0+IHtcbiAgICAgIC8qKiBUaGUgbmFtZSBvZiB0aGUgcXVlcnksIHdpdGggc3BhY2VzIHJlbW92ZWQgdG8gbWF0Y2ggR3JhcGhxbCByZXF1aXJlbWVudHMuICovXG4gICAgICBjb25zdCBxdWVyeUtleSA9IGFsaWFzKG5hbWUucmVwbGFjZSgvIC9nLCAnJyksICdzZWFyY2gnKTtcbiAgICAgIGdyYXBocWxRdWVyeVtxdWVyeUtleV0gPSBwYXJhbXMoXG4gICAgICAgIHtcbiAgICAgICAgICB0eXBlOiAnSVNTVUUnLFxuICAgICAgICAgIGZpcnN0OiBNQVhfUkVUVVJORURfSVNTVUVTLFxuICAgICAgICAgIHF1ZXJ5OiBgXCIke3JlcG9GaWx0ZXJ9ICR7cXVlcnkucmVwbGFjZSgvXFxcIi9nLCAnXFxcXFwiJyl9XCJgLFxuICAgICAgICB9LFxuICAgICAgICB7Li4uR2l0aHViUXVlcnlSZXN1bHRGcmFnbWVudH0sXG4gICAgICApO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGdyYXBocWxRdWVyeTtcbiAgfVxuXG4gIG92ZXJyaWRlIGFzeW5jIHByaW50VG9UZXJtaW5hbCgpIHtcbiAgICBjb25zdCBxdWVyeVJlc3VsdHMgPSBhd2FpdCB0aGlzLmRhdGE7XG4gICAgaWYgKCFxdWVyeVJlc3VsdHMpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgTG9nLmluZm8uZ3JvdXAoYm9sZCgnR2l0aHViIFRhc2tzJykpO1xuICAgIGNvbnN0IG1pblF1ZXJ5TmFtZUxlbmd0aCA9IE1hdGgubWF4KC4uLnF1ZXJ5UmVzdWx0cy5tYXAoKHJlc3VsdCkgPT4gcmVzdWx0LnF1ZXJ5TmFtZS5sZW5ndGgpKTtcbiAgICBmb3IgKGNvbnN0IHF1ZXJ5UmVzdWx0IG9mIHF1ZXJ5UmVzdWx0cykge1xuICAgICAgTG9nLmluZm8oYCR7cXVlcnlSZXN1bHQucXVlcnlOYW1lLnBhZEVuZChtaW5RdWVyeU5hbWVMZW5ndGgpfSAgJHtxdWVyeVJlc3VsdC5jb3VudH1gKTtcblxuICAgICAgaWYgKHF1ZXJ5UmVzdWx0LmNvdW50ID4gMCkge1xuICAgICAgICBMb2cuaW5mby5ncm91cChxdWVyeVJlc3VsdC5xdWVyeVVybCk7XG4gICAgICAgIHF1ZXJ5UmVzdWx0Lm1hdGNoZWRVcmxzLmZvckVhY2goKHVybCkgPT4gTG9nLmluZm8oYC0gJHt1cmx9YCkpO1xuICAgICAgICBpZiAocXVlcnlSZXN1bHQuY291bnQgPiBNQVhfUkVUVVJORURfSVNTVUVTKSB7XG4gICAgICAgICAgTG9nLmluZm8oYC4uLiAke3F1ZXJ5UmVzdWx0LmNvdW50IC0gTUFYX1JFVFVSTkVEX0lTU1VFU30gYWRkaXRpb25hbCBtYXRjaGVzYCk7XG4gICAgICAgIH1cbiAgICAgICAgTG9nLmluZm8uZ3JvdXBFbmQoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgTG9nLmluZm8uZ3JvdXBFbmQoKTtcbiAgICBMb2cuaW5mbygpO1xuICB9XG59XG4iXX0=