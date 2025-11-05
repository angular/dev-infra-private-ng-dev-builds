import { alias, onUnion, params, types } from 'typed-graphqlify';
import { bold, Log } from '../../utils/logging.js';
import { BaseModule } from './base.js';
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
const MAX_RETURNED_ISSUES = 20;
export class GithubQueriesModule extends BaseModule {
    async retrieveData() {
        let queries = this.config.caretaker?.githubQueries;
        if (queries === undefined || queries.length === 0) {
            Log.debug('No github queries defined in the configuration, skipping');
            return;
        }
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
    buildGraphqlQuery(queries) {
        const graphqlQuery = {};
        const { owner, name: repo } = this.git.remoteConfig;
        const repoFilter = `repo:${owner}/${repo}`;
        queries.forEach(({ name, query }) => {
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
        Log.info(bold('Github Tasks'));
        const minQueryNameLength = Math.max(...queryResults.map((result) => result.queryName.length));
        for (const queryResult of queryResults) {
            Log.info(`${queryResult.queryName.padEnd(minQueryNameLength)}  ${queryResult.count}`);
            if (queryResult.count > 0) {
                Log.info(queryResult.queryUrl);
                queryResult.matchedUrls.forEach((url) => Log.info(`- ${url}`));
                if (queryResult.count > MAX_RETURNED_ISSUES) {
                    Log.info(`... ${queryResult.count - MAX_RETURNED_ISSUES} additional matches`);
                }
            }
        }
        Log.info();
    }
}
//# sourceMappingURL=github.js.map