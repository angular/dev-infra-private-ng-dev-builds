/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { assertValidGithubConfig, ConfigValidationError, getConfig } from '../../utils/config.js';
import { bold, Log } from '../../utils/logging.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { isGithubApiError } from '../../utils/git/github.js';
import { GITHUB_TOKEN_GENERATE_URL } from '../../utils/git/github-urls.js';
import { assertValidPullRequestConfig } from '../config/index.js';
import { MergeTool } from './merge-tool.js';
import { FatalMergeToolError, PullRequestValidationError, UserAbortedMergeToolError, } from './failures.js';
import { InvalidTargetBranchError, InvalidTargetLabelError, } from '../common/targeting/target-label.js';
/**
 * Merges a given pull request based on labels configured in the given merge configuration.
 * Pull requests can be merged with different strategies such as the Github API merge
 * strategy, or the local autosquash strategy. Either strategy has benefits and downsides.
 * More information on these strategies can be found in their dedicated strategy classes.
 *
 * See {@link GithubApiMergeStrategy} and {@link AutosquashMergeStrategy}
 *
 * @param prNumber Number of the pull request that should be merged.
 * @param flags Configuration options for merging pull requests.
 */
export async function mergePullRequest(prNumber, flags) {
    // Set the environment variable to skip all git commit hooks triggered by husky. We are unable to
    // rely on `--no-verify` as some hooks still run, notably the `prepare-commit-msg` hook.
    process.env['HUSKY'] = '0';
    const tool = await createPullRequestMergeTool(flags);
    // Perform the merge. If the merge fails with non-fatal failures, the script
    // will prompt whether it should rerun in force mode with the ignored failure.
    if (!(await performMerge())) {
        process.exit(1);
    }
    /** Performs the merge and returns whether it was successful or not. */
    async function performMerge(validationConfig = {
        assertCompletedReviews: !flags.ignorePendingReviews,
    }) {
        try {
            await tool.merge(prNumber, validationConfig);
            return true;
        }
        catch (e) {
            // Catch errors to the Github API for invalid requests. We want to
            // exit the script with a better explanation of the error.
            if (isGithubApiError(e) && e.status === 401) {
                Log.error('Github API request failed: ' + bold(e.message));
                Log.error('Please ensure that your provided token is valid.');
                Log.warn(`You can generate a token here: ${GITHUB_TOKEN_GENERATE_URL}`);
                return false;
            }
            if (isGithubApiError(e)) {
                Log.error('Github API request failed: ' + bold(e.message));
                return false;
            }
            if (e instanceof UserAbortedMergeToolError) {
                Log.warn('Manually aborted merging..');
                return false;
            }
            if (e instanceof InvalidTargetBranchError) {
                Log.error(`Pull request selects an invalid GitHub destination branch:`);
                Log.error(` -> ${bold(e.failureMessage)}`);
            }
            if (e instanceof InvalidTargetLabelError) {
                Log.error(`Pull request target label could not be determined:`);
                Log.error(` -> ${bold(e.failureMessage)}`);
            }
            if (e instanceof PullRequestValidationError) {
                Log.error('Pull request failed at least one validation check.');
                Log.error('See above for specific error information');
                return false;
            }
            // Note: Known errors in the merge tooling extend from the FatalMergeToolError, as such
            // the instance check for FatalMergeToolError should remain last as it will be truthy for
            // all of the subclasses.
            if (e instanceof FatalMergeToolError) {
                Log.error(`Could not merge the specified pull request. Error:`);
                Log.error(` -> ${bold(e.message)}`);
                return false;
            }
            // For unknown errors, always re-throw.
            throw e;
        }
    }
}
/**
 * Creates the pull request merge tool using the given configuration options.
 *
 * Explicit configuration options can be specified when the merge script is used
 * outside of an `ng-dev` configured repository.
 */
async function createPullRequestMergeTool(flags) {
    try {
        const config = await getConfig();
        assertValidGithubConfig(config);
        assertValidPullRequestConfig(config);
        /** The singleton instance of the authenticated git client. */
        const git = await AuthenticatedGitClient.get();
        return new MergeTool(config, git, flags);
    }
    catch (e) {
        if (e instanceof ConfigValidationError) {
            if (e.errors.length) {
                Log.error('Invalid merge configuration:');
                e.errors.forEach((desc) => Log.error(`  -  ${desc}`));
            }
            else {
                Log.error(e.message);
            }
            process.exit(1);
        }
        throw e;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVyZ2UtcHVsbC1yZXF1ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL21lcmdlL21lcmdlLXB1bGwtcmVxdWVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsdUJBQXVCLEVBQUUscUJBQXFCLEVBQUUsU0FBUyxFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDaEcsT0FBTyxFQUFDLElBQUksRUFBRSxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNqRCxPQUFPLEVBQUMsc0JBQXNCLEVBQUMsTUFBTSw2Q0FBNkMsQ0FBQztBQUNuRixPQUFPLEVBQUMsZ0JBQWdCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUMzRCxPQUFPLEVBQUMseUJBQXlCLEVBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUV6RSxPQUFPLEVBQUMsNEJBQTRCLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUNoRSxPQUFPLEVBQUMsU0FBUyxFQUF3QixNQUFNLGlCQUFpQixDQUFDO0FBQ2pFLE9BQU8sRUFDTCxtQkFBbUIsRUFDbkIsMEJBQTBCLEVBQzFCLHlCQUF5QixHQUMxQixNQUFNLGVBQWUsQ0FBQztBQUV2QixPQUFPLEVBQ0wsd0JBQXdCLEVBQ3hCLHVCQUF1QixHQUN4QixNQUFNLHFDQUFxQyxDQUFDO0FBRTdDOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFNLENBQUMsS0FBSyxVQUFVLGdCQUFnQixDQUFDLFFBQWdCLEVBQUUsS0FBNEI7SUFDbkYsaUdBQWlHO0lBQ2pHLHdGQUF3RjtJQUN4RixPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEdBQUcsQ0FBQztJQUUzQixNQUFNLElBQUksR0FBRyxNQUFNLDBCQUEwQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRXJELDRFQUE0RTtJQUM1RSw4RUFBOEU7SUFDOUUsSUFBSSxDQUFDLENBQUMsTUFBTSxZQUFZLEVBQUUsQ0FBQyxFQUFFLENBQUM7UUFDNUIsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsQixDQUFDO0lBRUQsdUVBQXVFO0lBQ3ZFLEtBQUssVUFBVSxZQUFZLENBQ3pCLGdCQUFnQixHQUFHO1FBQ2pCLHNCQUFzQixFQUFFLENBQUMsS0FBSyxDQUFDLG9CQUFvQjtLQUNwRDtRQUVELElBQUksQ0FBQztZQUNILE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUM3QyxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ1gsa0VBQWtFO1lBQ2xFLDBEQUEwRDtZQUMxRCxJQUFJLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUM7Z0JBQzVDLEdBQUcsQ0FBQyxLQUFLLENBQUMsNkJBQTZCLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUMzRCxHQUFHLENBQUMsS0FBSyxDQUFDLGtEQUFrRCxDQUFDLENBQUM7Z0JBQzlELEdBQUcsQ0FBQyxJQUFJLENBQUMsa0NBQWtDLHlCQUF5QixFQUFFLENBQUMsQ0FBQztnQkFDeEUsT0FBTyxLQUFLLENBQUM7WUFDZixDQUFDO1lBQ0QsSUFBSSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUN4QixHQUFHLENBQUMsS0FBSyxDQUFDLDZCQUE2QixHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDM0QsT0FBTyxLQUFLLENBQUM7WUFDZixDQUFDO1lBQ0QsSUFBSSxDQUFDLFlBQVkseUJBQXlCLEVBQUUsQ0FBQztnQkFDM0MsR0FBRyxDQUFDLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO2dCQUN2QyxPQUFPLEtBQUssQ0FBQztZQUNmLENBQUM7WUFDRCxJQUFJLENBQUMsWUFBWSx3QkFBd0IsRUFBRSxDQUFDO2dCQUMxQyxHQUFHLENBQUMsS0FBSyxDQUFDLDREQUE0RCxDQUFDLENBQUM7Z0JBQ3hFLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUM3QyxDQUFDO1lBQ0QsSUFBSSxDQUFDLFlBQVksdUJBQXVCLEVBQUUsQ0FBQztnQkFDekMsR0FBRyxDQUFDLEtBQUssQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO2dCQUNoRSxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDN0MsQ0FBQztZQUVELElBQUksQ0FBQyxZQUFZLDBCQUEwQixFQUFFLENBQUM7Z0JBQzVDLEdBQUcsQ0FBQyxLQUFLLENBQUMsb0RBQW9ELENBQUMsQ0FBQztnQkFDaEUsR0FBRyxDQUFDLEtBQUssQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO2dCQUN0RCxPQUFPLEtBQUssQ0FBQztZQUNmLENBQUM7WUFFRCx1RkFBdUY7WUFDdkYseUZBQXlGO1lBQ3pGLHlCQUF5QjtZQUN6QixJQUFJLENBQUMsWUFBWSxtQkFBbUIsRUFBRSxDQUFDO2dCQUNyQyxHQUFHLENBQUMsS0FBSyxDQUFDLG9EQUFvRCxDQUFDLENBQUM7Z0JBQ2hFLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDcEMsT0FBTyxLQUFLLENBQUM7WUFDZixDQUFDO1lBRUQsdUNBQXVDO1lBQ3ZDLE1BQU0sQ0FBQyxDQUFDO1FBQ1YsQ0FBQztJQUNILENBQUM7QUFDSCxDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxLQUFLLFVBQVUsMEJBQTBCLENBQUMsS0FBNEI7SUFDcEUsSUFBSSxDQUFDO1FBQ0gsTUFBTSxNQUFNLEdBQUcsTUFBTSxTQUFTLEVBQUUsQ0FBQztRQUVqQyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNoQyw0QkFBNEIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUVyQyw4REFBOEQ7UUFDOUQsTUFBTSxHQUFHLEdBQUcsTUFBTSxzQkFBc0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUMvQyxPQUFPLElBQUksU0FBUyxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDWCxJQUFJLENBQUMsWUFBWSxxQkFBcUIsRUFBRSxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDcEIsR0FBRyxDQUFDLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO2dCQUMxQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN4RCxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDdkIsQ0FBQztZQUNELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEIsQ0FBQztRQUNELE1BQU0sQ0FBQyxDQUFDO0lBQ1YsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHthc3NlcnRWYWxpZEdpdGh1YkNvbmZpZywgQ29uZmlnVmFsaWRhdGlvbkVycm9yLCBnZXRDb25maWd9IGZyb20gJy4uLy4uL3V0aWxzL2NvbmZpZy5qcyc7XG5pbXBvcnQge2JvbGQsIExvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge0F1dGhlbnRpY2F0ZWRHaXRDbGllbnR9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQuanMnO1xuaW1wb3J0IHtpc0dpdGh1YkFwaUVycm9yfSBmcm9tICcuLi8uLi91dGlscy9naXQvZ2l0aHViLmpzJztcbmltcG9ydCB7R0lUSFVCX1RPS0VOX0dFTkVSQVRFX1VSTH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi11cmxzLmpzJztcblxuaW1wb3J0IHthc3NlcnRWYWxpZFB1bGxSZXF1ZXN0Q29uZmlnfSBmcm9tICcuLi9jb25maWcvaW5kZXguanMnO1xuaW1wb3J0IHtNZXJnZVRvb2wsIFB1bGxSZXF1ZXN0TWVyZ2VGbGFnc30gZnJvbSAnLi9tZXJnZS10b29sLmpzJztcbmltcG9ydCB7XG4gIEZhdGFsTWVyZ2VUb29sRXJyb3IsXG4gIFB1bGxSZXF1ZXN0VmFsaWRhdGlvbkVycm9yLFxuICBVc2VyQWJvcnRlZE1lcmdlVG9vbEVycm9yLFxufSBmcm9tICcuL2ZhaWx1cmVzLmpzJztcbmltcG9ydCB7Y3JlYXRlUHVsbFJlcXVlc3RWYWxpZGF0aW9uQ29uZmlnfSBmcm9tICcuLi9jb21tb24vdmFsaWRhdGlvbi92YWxpZGF0aW9uLWNvbmZpZy5qcyc7XG5pbXBvcnQge1xuICBJbnZhbGlkVGFyZ2V0QnJhbmNoRXJyb3IsXG4gIEludmFsaWRUYXJnZXRMYWJlbEVycm9yLFxufSBmcm9tICcuLi9jb21tb24vdGFyZ2V0aW5nL3RhcmdldC1sYWJlbC5qcyc7XG5cbi8qKlxuICogTWVyZ2VzIGEgZ2l2ZW4gcHVsbCByZXF1ZXN0IGJhc2VkIG9uIGxhYmVscyBjb25maWd1cmVkIGluIHRoZSBnaXZlbiBtZXJnZSBjb25maWd1cmF0aW9uLlxuICogUHVsbCByZXF1ZXN0cyBjYW4gYmUgbWVyZ2VkIHdpdGggZGlmZmVyZW50IHN0cmF0ZWdpZXMgc3VjaCBhcyB0aGUgR2l0aHViIEFQSSBtZXJnZVxuICogc3RyYXRlZ3ksIG9yIHRoZSBsb2NhbCBhdXRvc3F1YXNoIHN0cmF0ZWd5LiBFaXRoZXIgc3RyYXRlZ3kgaGFzIGJlbmVmaXRzIGFuZCBkb3duc2lkZXMuXG4gKiBNb3JlIGluZm9ybWF0aW9uIG9uIHRoZXNlIHN0cmF0ZWdpZXMgY2FuIGJlIGZvdW5kIGluIHRoZWlyIGRlZGljYXRlZCBzdHJhdGVneSBjbGFzc2VzLlxuICpcbiAqIFNlZSB7QGxpbmsgR2l0aHViQXBpTWVyZ2VTdHJhdGVneX0gYW5kIHtAbGluayBBdXRvc3F1YXNoTWVyZ2VTdHJhdGVneX1cbiAqXG4gKiBAcGFyYW0gcHJOdW1iZXIgTnVtYmVyIG9mIHRoZSBwdWxsIHJlcXVlc3QgdGhhdCBzaG91bGQgYmUgbWVyZ2VkLlxuICogQHBhcmFtIGZsYWdzIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgbWVyZ2luZyBwdWxsIHJlcXVlc3RzLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWVyZ2VQdWxsUmVxdWVzdChwck51bWJlcjogbnVtYmVyLCBmbGFnczogUHVsbFJlcXVlc3RNZXJnZUZsYWdzKSB7XG4gIC8vIFNldCB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGUgdG8gc2tpcCBhbGwgZ2l0IGNvbW1pdCBob29rcyB0cmlnZ2VyZWQgYnkgaHVza3kuIFdlIGFyZSB1bmFibGUgdG9cbiAgLy8gcmVseSBvbiBgLS1uby12ZXJpZnlgIGFzIHNvbWUgaG9va3Mgc3RpbGwgcnVuLCBub3RhYmx5IHRoZSBgcHJlcGFyZS1jb21taXQtbXNnYCBob29rLlxuICBwcm9jZXNzLmVudlsnSFVTS1knXSA9ICcwJztcblxuICBjb25zdCB0b29sID0gYXdhaXQgY3JlYXRlUHVsbFJlcXVlc3RNZXJnZVRvb2woZmxhZ3MpO1xuXG4gIC8vIFBlcmZvcm0gdGhlIG1lcmdlLiBJZiB0aGUgbWVyZ2UgZmFpbHMgd2l0aCBub24tZmF0YWwgZmFpbHVyZXMsIHRoZSBzY3JpcHRcbiAgLy8gd2lsbCBwcm9tcHQgd2hldGhlciBpdCBzaG91bGQgcmVydW4gaW4gZm9yY2UgbW9kZSB3aXRoIHRoZSBpZ25vcmVkIGZhaWx1cmUuXG4gIGlmICghKGF3YWl0IHBlcmZvcm1NZXJnZSgpKSkge1xuICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgfVxuXG4gIC8qKiBQZXJmb3JtcyB0aGUgbWVyZ2UgYW5kIHJldHVybnMgd2hldGhlciBpdCB3YXMgc3VjY2Vzc2Z1bCBvciBub3QuICovXG4gIGFzeW5jIGZ1bmN0aW9uIHBlcmZvcm1NZXJnZShcbiAgICB2YWxpZGF0aW9uQ29uZmlnID0ge1xuICAgICAgYXNzZXJ0Q29tcGxldGVkUmV2aWV3czogIWZsYWdzLmlnbm9yZVBlbmRpbmdSZXZpZXdzLFxuICAgIH0sXG4gICk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0b29sLm1lcmdlKHByTnVtYmVyLCB2YWxpZGF0aW9uQ29uZmlnKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIENhdGNoIGVycm9ycyB0byB0aGUgR2l0aHViIEFQSSBmb3IgaW52YWxpZCByZXF1ZXN0cy4gV2Ugd2FudCB0b1xuICAgICAgLy8gZXhpdCB0aGUgc2NyaXB0IHdpdGggYSBiZXR0ZXIgZXhwbGFuYXRpb24gb2YgdGhlIGVycm9yLlxuICAgICAgaWYgKGlzR2l0aHViQXBpRXJyb3IoZSkgJiYgZS5zdGF0dXMgPT09IDQwMSkge1xuICAgICAgICBMb2cuZXJyb3IoJ0dpdGh1YiBBUEkgcmVxdWVzdCBmYWlsZWQ6ICcgKyBib2xkKGUubWVzc2FnZSkpO1xuICAgICAgICBMb2cuZXJyb3IoJ1BsZWFzZSBlbnN1cmUgdGhhdCB5b3VyIHByb3ZpZGVkIHRva2VuIGlzIHZhbGlkLicpO1xuICAgICAgICBMb2cud2FybihgWW91IGNhbiBnZW5lcmF0ZSBhIHRva2VuIGhlcmU6ICR7R0lUSFVCX1RPS0VOX0dFTkVSQVRFX1VSTH1gKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKGlzR2l0aHViQXBpRXJyb3IoZSkpIHtcbiAgICAgICAgTG9nLmVycm9yKCdHaXRodWIgQVBJIHJlcXVlc3QgZmFpbGVkOiAnICsgYm9sZChlLm1lc3NhZ2UpKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBVc2VyQWJvcnRlZE1lcmdlVG9vbEVycm9yKSB7XG4gICAgICAgIExvZy53YXJuKCdNYW51YWxseSBhYm9ydGVkIG1lcmdpbmcuLicpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIEludmFsaWRUYXJnZXRCcmFuY2hFcnJvcikge1xuICAgICAgICBMb2cuZXJyb3IoYFB1bGwgcmVxdWVzdCBzZWxlY3RzIGFuIGludmFsaWQgR2l0SHViIGRlc3RpbmF0aW9uIGJyYW5jaDpgKTtcbiAgICAgICAgTG9nLmVycm9yKGAgLT4gJHtib2xkKGUuZmFpbHVyZU1lc3NhZ2UpfWApO1xuICAgICAgfVxuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBJbnZhbGlkVGFyZ2V0TGFiZWxFcnJvcikge1xuICAgICAgICBMb2cuZXJyb3IoYFB1bGwgcmVxdWVzdCB0YXJnZXQgbGFiZWwgY291bGQgbm90IGJlIGRldGVybWluZWQ6YCk7XG4gICAgICAgIExvZy5lcnJvcihgIC0+ICR7Ym9sZChlLmZhaWx1cmVNZXNzYWdlKX1gKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBQdWxsUmVxdWVzdFZhbGlkYXRpb25FcnJvcikge1xuICAgICAgICBMb2cuZXJyb3IoJ1B1bGwgcmVxdWVzdCBmYWlsZWQgYXQgbGVhc3Qgb25lIHZhbGlkYXRpb24gY2hlY2suJyk7XG4gICAgICAgIExvZy5lcnJvcignU2VlIGFib3ZlIGZvciBzcGVjaWZpYyBlcnJvciBpbmZvcm1hdGlvbicpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIE5vdGU6IEtub3duIGVycm9ycyBpbiB0aGUgbWVyZ2UgdG9vbGluZyBleHRlbmQgZnJvbSB0aGUgRmF0YWxNZXJnZVRvb2xFcnJvciwgYXMgc3VjaFxuICAgICAgLy8gdGhlIGluc3RhbmNlIGNoZWNrIGZvciBGYXRhbE1lcmdlVG9vbEVycm9yIHNob3VsZCByZW1haW4gbGFzdCBhcyBpdCB3aWxsIGJlIHRydXRoeSBmb3JcbiAgICAgIC8vIGFsbCBvZiB0aGUgc3ViY2xhc3Nlcy5cbiAgICAgIGlmIChlIGluc3RhbmNlb2YgRmF0YWxNZXJnZVRvb2xFcnJvcikge1xuICAgICAgICBMb2cuZXJyb3IoYENvdWxkIG5vdCBtZXJnZSB0aGUgc3BlY2lmaWVkIHB1bGwgcmVxdWVzdC4gRXJyb3I6YCk7XG4gICAgICAgIExvZy5lcnJvcihgIC0+ICR7Ym9sZChlLm1lc3NhZ2UpfWApO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIEZvciB1bmtub3duIGVycm9ycywgYWx3YXlzIHJlLXRocm93LlxuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIHRoZSBwdWxsIHJlcXVlc3QgbWVyZ2UgdG9vbCB1c2luZyB0aGUgZ2l2ZW4gY29uZmlndXJhdGlvbiBvcHRpb25zLlxuICpcbiAqIEV4cGxpY2l0IGNvbmZpZ3VyYXRpb24gb3B0aW9ucyBjYW4gYmUgc3BlY2lmaWVkIHdoZW4gdGhlIG1lcmdlIHNjcmlwdCBpcyB1c2VkXG4gKiBvdXRzaWRlIG9mIGFuIGBuZy1kZXZgIGNvbmZpZ3VyZWQgcmVwb3NpdG9yeS5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gY3JlYXRlUHVsbFJlcXVlc3RNZXJnZVRvb2woZmxhZ3M6IFB1bGxSZXF1ZXN0TWVyZ2VGbGFncykge1xuICB0cnkge1xuICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IGdldENvbmZpZygpO1xuXG4gICAgYXNzZXJ0VmFsaWRHaXRodWJDb25maWcoY29uZmlnKTtcbiAgICBhc3NlcnRWYWxpZFB1bGxSZXF1ZXN0Q29uZmlnKGNvbmZpZyk7XG5cbiAgICAvKiogVGhlIHNpbmdsZXRvbiBpbnN0YW5jZSBvZiB0aGUgYXV0aGVudGljYXRlZCBnaXQgY2xpZW50LiAqL1xuICAgIGNvbnN0IGdpdCA9IGF3YWl0IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQuZ2V0KCk7XG4gICAgcmV0dXJuIG5ldyBNZXJnZVRvb2woY29uZmlnLCBnaXQsIGZsYWdzKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGlmIChlIGluc3RhbmNlb2YgQ29uZmlnVmFsaWRhdGlvbkVycm9yKSB7XG4gICAgICBpZiAoZS5lcnJvcnMubGVuZ3RoKSB7XG4gICAgICAgIExvZy5lcnJvcignSW52YWxpZCBtZXJnZSBjb25maWd1cmF0aW9uOicpO1xuICAgICAgICBlLmVycm9ycy5mb3JFYWNoKChkZXNjKSA9PiBMb2cuZXJyb3IoYCAgLSAgJHtkZXNjfWApKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIExvZy5lcnJvcihlLm1lc3NhZ2UpO1xuICAgICAgfVxuICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgIH1cbiAgICB0aHJvdyBlO1xuICB9XG59XG4iXX0=