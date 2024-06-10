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
/**
 * Parses the pull request number from either the number or url string
 */
export function parsePrNumber(prUrlOrNumber) {
    // There is no url validation here other than presence of `/`.
    // So whatever is the last segment of that string, url or not, will be
    // parsed as a PR number.
    const prNumber = parseInt(prUrlOrNumber.split('/').pop());
    if (isNaN(prNumber)) {
        throw new Error('Pull Request was unable to be parsed from the parameters');
    }
    return prNumber;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVyZ2UtcHVsbC1yZXF1ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL21lcmdlL21lcmdlLXB1bGwtcmVxdWVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsdUJBQXVCLEVBQUUscUJBQXFCLEVBQUUsU0FBUyxFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFDaEcsT0FBTyxFQUFDLElBQUksRUFBRSxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNqRCxPQUFPLEVBQUMsc0JBQXNCLEVBQUMsTUFBTSw2Q0FBNkMsQ0FBQztBQUNuRixPQUFPLEVBQUMsZ0JBQWdCLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUMzRCxPQUFPLEVBQUMseUJBQXlCLEVBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUV6RSxPQUFPLEVBQUMsNEJBQTRCLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUNoRSxPQUFPLEVBQUMsU0FBUyxFQUF3QixNQUFNLGlCQUFpQixDQUFDO0FBQ2pFLE9BQU8sRUFDTCxtQkFBbUIsRUFDbkIsMEJBQTBCLEVBQzFCLHlCQUF5QixHQUMxQixNQUFNLGVBQWUsQ0FBQztBQUN2QixPQUFPLEVBQ0wsd0JBQXdCLEVBQ3hCLHVCQUF1QixHQUN4QixNQUFNLHFDQUFxQyxDQUFDO0FBRTdDOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFNLENBQUMsS0FBSyxVQUFVLGdCQUFnQixDQUFDLFFBQWdCLEVBQUUsS0FBNEI7SUFDbkYsaUdBQWlHO0lBQ2pHLHdGQUF3RjtJQUN4RixPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEdBQUcsQ0FBQztJQUUzQixNQUFNLElBQUksR0FBRyxNQUFNLDBCQUEwQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRXJELDRFQUE0RTtJQUM1RSw4RUFBOEU7SUFDOUUsSUFBSSxDQUFDLENBQUMsTUFBTSxZQUFZ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InNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2Fzc2VydFZhbGlkR2l0aHViQ29uZmlnLCBDb25maWdWYWxpZGF0aW9uRXJyb3IsIGdldENvbmZpZ30gZnJvbSAnLi4vLi4vdXRpbHMvY29uZmlnLmpzJztcbmltcG9ydCB7Ym9sZCwgTG9nfSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7QXV0aGVudGljYXRlZEdpdENsaWVudH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2F1dGhlbnRpY2F0ZWQtZ2l0LWNsaWVudC5qcyc7XG5pbXBvcnQge2lzR2l0aHViQXBpRXJyb3J9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9naXRodWIuanMnO1xuaW1wb3J0IHtHSVRIVUJfVE9LRU5fR0VORVJBVEVfVVJMfSBmcm9tICcuLi8uLi91dGlscy9naXQvZ2l0aHViLXVybHMuanMnO1xuXG5pbXBvcnQge2Fzc2VydFZhbGlkUHVsbFJlcXVlc3RDb25maWd9IGZyb20gJy4uL2NvbmZpZy9pbmRleC5qcyc7XG5pbXBvcnQge01lcmdlVG9vbCwgUHVsbFJlcXVlc3RNZXJnZUZsYWdzfSBmcm9tICcuL21lcmdlLXRvb2wuanMnO1xuaW1wb3J0IHtcbiAgRmF0YWxNZXJnZVRvb2xFcnJvcixcbiAgUHVsbFJlcXVlc3RWYWxpZGF0aW9uRXJyb3IsXG4gIFVzZXJBYm9ydGVkTWVyZ2VUb29sRXJyb3IsXG59IGZyb20gJy4vZmFpbHVyZXMuanMnO1xuaW1wb3J0IHtcbiAgSW52YWxpZFRhcmdldEJyYW5jaEVycm9yLFxuICBJbnZhbGlkVGFyZ2V0TGFiZWxFcnJvcixcbn0gZnJvbSAnLi4vY29tbW9uL3RhcmdldGluZy90YXJnZXQtbGFiZWwuanMnO1xuXG4vKipcbiAqIE1lcmdlcyBhIGdpdmVuIHB1bGwgcmVxdWVzdCBiYXNlZCBvbiBsYWJlbHMgY29uZmlndXJlZCBpbiB0aGUgZ2l2ZW4gbWVyZ2UgY29uZmlndXJhdGlvbi5cbiAqIFB1bGwgcmVxdWVzdHMgY2FuIGJlIG1lcmdlZCB3aXRoIGRpZmZlcmVudCBzdHJhdGVnaWVzIHN1Y2ggYXMgdGhlIEdpdGh1YiBBUEkgbWVyZ2VcbiAqIHN0cmF0ZWd5LCBvciB0aGUgbG9jYWwgYXV0b3NxdWFzaCBzdHJhdGVneS4gRWl0aGVyIHN0cmF0ZWd5IGhhcyBiZW5lZml0cyBhbmQgZG93bnNpZGVzLlxuICogTW9yZSBpbmZvcm1hdGlvbiBvbiB0aGVzZSBzdHJhdGVnaWVzIGNhbiBiZSBmb3VuZCBpbiB0aGVpciBkZWRpY2F0ZWQgc3RyYXRlZ3kgY2xhc3Nlcy5cbiAqXG4gKiBTZWUge0BsaW5rIEdpdGh1YkFwaU1lcmdlU3RyYXRlZ3l9IGFuZCB7QGxpbmsgQXV0b3NxdWFzaE1lcmdlU3RyYXRlZ3l9XG4gKlxuICogQHBhcmFtIHByTnVtYmVyIE51bWJlciBvZiB0aGUgcHVsbCByZXF1ZXN0IHRoYXQgc2hvdWxkIGJlIG1lcmdlZC5cbiAqIEBwYXJhbSBmbGFncyBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIG1lcmdpbmcgcHVsbCByZXF1ZXN0cy5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1lcmdlUHVsbFJlcXVlc3QocHJOdW1iZXI6IG51bWJlciwgZmxhZ3M6IFB1bGxSZXF1ZXN0TWVyZ2VGbGFncykge1xuICAvLyBTZXQgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlIHRvIHNraXAgYWxsIGdpdCBjb21taXQgaG9va3MgdHJpZ2dlcmVkIGJ5IGh1c2t5LiBXZSBhcmUgdW5hYmxlIHRvXG4gIC8vIHJlbHkgb24gYC0tbm8tdmVyaWZ5YCBhcyBzb21lIGhvb2tzIHN0aWxsIHJ1biwgbm90YWJseSB0aGUgYHByZXBhcmUtY29tbWl0LW1zZ2AgaG9vay5cbiAgcHJvY2Vzcy5lbnZbJ0hVU0tZJ10gPSAnMCc7XG5cbiAgY29uc3QgdG9vbCA9IGF3YWl0IGNyZWF0ZVB1bGxSZXF1ZXN0TWVyZ2VUb29sKGZsYWdzKTtcblxuICAvLyBQZXJmb3JtIHRoZSBtZXJnZS4gSWYgdGhlIG1lcmdlIGZhaWxzIHdpdGggbm9uLWZhdGFsIGZhaWx1cmVzLCB0aGUgc2NyaXB0XG4gIC8vIHdpbGwgcHJvbXB0IHdoZXRoZXIgaXQgc2hvdWxkIHJlcnVuIGluIGZvcmNlIG1vZGUgd2l0aCB0aGUgaWdub3JlZCBmYWlsdXJlLlxuICBpZiAoIShhd2FpdCBwZXJmb3JtTWVyZ2UoKSkpIHtcbiAgICBwcm9jZXNzLmV4aXQoMSk7XG4gIH1cblxuICAvKiogUGVyZm9ybXMgdGhlIG1lcmdlIGFuZCByZXR1cm5zIHdoZXRoZXIgaXQgd2FzIHN1Y2Nlc3NmdWwgb3Igbm90LiAqL1xuICBhc3luYyBmdW5jdGlvbiBwZXJmb3JtTWVyZ2UoXG4gICAgdmFsaWRhdGlvbkNvbmZpZyA9IHtcbiAgICAgIGFzc2VydENvbXBsZXRlZFJldmlld3M6ICFmbGFncy5pZ25vcmVQZW5kaW5nUmV2aWV3cyxcbiAgICB9LFxuICApOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdG9vbC5tZXJnZShwck51bWJlciwgdmFsaWRhdGlvbkNvbmZpZyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBDYXRjaCBlcnJvcnMgdG8gdGhlIEdpdGh1YiBBUEkgZm9yIGludmFsaWQgcmVxdWVzdHMuIFdlIHdhbnQgdG9cbiAgICAgIC8vIGV4aXQgdGhlIHNjcmlwdCB3aXRoIGEgYmV0dGVyIGV4cGxhbmF0aW9uIG9mIHRoZSBlcnJvci5cbiAgICAgIGlmIChpc0dpdGh1YkFwaUVycm9yKGUpICYmIGUuc3RhdHVzID09PSA0MDEpIHtcbiAgICAgICAgTG9nLmVycm9yKCdHaXRodWIgQVBJIHJlcXVlc3QgZmFpbGVkOiAnICsgYm9sZChlLm1lc3NhZ2UpKTtcbiAgICAgICAgTG9nLmVycm9yKCdQbGVhc2UgZW5zdXJlIHRoYXQgeW91ciBwcm92aWRlZCB0b2tlbiBpcyB2YWxpZC4nKTtcbiAgICAgICAgTG9nLndhcm4oYFlvdSBjYW4gZ2VuZXJhdGUgYSB0b2tlbiBoZXJlOiAke0dJVEhVQl9UT0tFTl9HRU5FUkFURV9VUkx9YCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmIChpc0dpdGh1YkFwaUVycm9yKGUpKSB7XG4gICAgICAgIExvZy5lcnJvcignR2l0aHViIEFQSSByZXF1ZXN0IGZhaWxlZDogJyArIGJvbGQoZS5tZXNzYWdlKSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmIChlIGluc3RhbmNlb2YgVXNlckFib3J0ZWRNZXJnZVRvb2xFcnJvcikge1xuICAgICAgICBMb2cud2FybignTWFudWFsbHkgYWJvcnRlZCBtZXJnaW5nLi4nKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBJbnZhbGlkVGFyZ2V0QnJhbmNoRXJyb3IpIHtcbiAgICAgICAgTG9nLmVycm9yKGBQdWxsIHJlcXVlc3Qgc2VsZWN0cyBhbiBpbnZhbGlkIEdpdEh1YiBkZXN0aW5hdGlvbiBicmFuY2g6YCk7XG4gICAgICAgIExvZy5lcnJvcihgIC0+ICR7Ym9sZChlLmZhaWx1cmVNZXNzYWdlKX1gKTtcbiAgICAgIH1cbiAgICAgIGlmIChlIGluc3RhbmNlb2YgSW52YWxpZFRhcmdldExhYmVsRXJyb3IpIHtcbiAgICAgICAgTG9nLmVycm9yKGBQdWxsIHJlcXVlc3QgdGFyZ2V0IGxhYmVsIGNvdWxkIG5vdCBiZSBkZXRlcm1pbmVkOmApO1xuICAgICAgICBMb2cuZXJyb3IoYCAtPiAke2JvbGQoZS5mYWlsdXJlTWVzc2FnZSl9YCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChlIGluc3RhbmNlb2YgUHVsbFJlcXVlc3RWYWxpZGF0aW9uRXJyb3IpIHtcbiAgICAgICAgTG9nLmVycm9yKCdQdWxsIHJlcXVlc3QgZmFpbGVkIGF0IGxlYXN0IG9uZSB2YWxpZGF0aW9uIGNoZWNrLicpO1xuICAgICAgICBMb2cuZXJyb3IoJ1NlZSBhYm92ZSBmb3Igc3BlY2lmaWMgZXJyb3IgaW5mb3JtYXRpb24nKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICAvLyBOb3RlOiBLbm93biBlcnJvcnMgaW4gdGhlIG1lcmdlIHRvb2xpbmcgZXh0ZW5kIGZyb20gdGhlIEZhdGFsTWVyZ2VUb29sRXJyb3IsIGFzIHN1Y2hcbiAgICAgIC8vIHRoZSBpbnN0YW5jZSBjaGVjayBmb3IgRmF0YWxNZXJnZVRvb2xFcnJvciBzaG91bGQgcmVtYWluIGxhc3QgYXMgaXQgd2lsbCBiZSB0cnV0aHkgZm9yXG4gICAgICAvLyBhbGwgb2YgdGhlIHN1YmNsYXNzZXMuXG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIEZhdGFsTWVyZ2VUb29sRXJyb3IpIHtcbiAgICAgICAgTG9nLmVycm9yKGBDb3VsZCBub3QgbWVyZ2UgdGhlIHNwZWNpZmllZCBwdWxsIHJlcXVlc3QuIEVycm9yOmApO1xuICAgICAgICBMb2cuZXJyb3IoYCAtPiAke2JvbGQoZS5tZXNzYWdlKX1gKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICAvLyBGb3IgdW5rbm93biBlcnJvcnMsIGFsd2F5cyByZS10aHJvdy5cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyB0aGUgcHVsbCByZXF1ZXN0IG1lcmdlIHRvb2wgdXNpbmcgdGhlIGdpdmVuIGNvbmZpZ3VyYXRpb24gb3B0aW9ucy5cbiAqXG4gKiBFeHBsaWNpdCBjb25maWd1cmF0aW9uIG9wdGlvbnMgY2FuIGJlIHNwZWNpZmllZCB3aGVuIHRoZSBtZXJnZSBzY3JpcHQgaXMgdXNlZFxuICogb3V0c2lkZSBvZiBhbiBgbmctZGV2YCBjb25maWd1cmVkIHJlcG9zaXRvcnkuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVB1bGxSZXF1ZXN0TWVyZ2VUb29sKGZsYWdzOiBQdWxsUmVxdWVzdE1lcmdlRmxhZ3MpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBjb25maWcgPSBhd2FpdCBnZXRDb25maWcoKTtcblxuICAgIGFzc2VydFZhbGlkR2l0aHViQ29uZmlnKGNvbmZpZyk7XG4gICAgYXNzZXJ0VmFsaWRQdWxsUmVxdWVzdENvbmZpZyhjb25maWcpO1xuXG4gICAgLyoqIFRoZSBzaW5nbGV0b24gaW5zdGFuY2Ugb2YgdGhlIGF1dGhlbnRpY2F0ZWQgZ2l0IGNsaWVudC4gKi9cbiAgICBjb25zdCBnaXQgPSBhd2FpdCBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LmdldCgpO1xuICAgIHJldHVybiBuZXcgTWVyZ2VUb29sKGNvbmZpZywgZ2l0LCBmbGFncyk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoZSBpbnN0YW5jZW9mIENvbmZpZ1ZhbGlkYXRpb25FcnJvcikge1xuICAgICAgaWYgKGUuZXJyb3JzLmxlbmd0aCkge1xuICAgICAgICBMb2cuZXJyb3IoJ0ludmFsaWQgbWVyZ2UgY29uZmlndXJhdGlvbjonKTtcbiAgICAgICAgZS5lcnJvcnMuZm9yRWFjaCgoZGVzYykgPT4gTG9nLmVycm9yKGAgIC0gICR7ZGVzY31gKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBMb2cuZXJyb3IoZS5tZXNzYWdlKTtcbiAgICAgIH1cbiAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICB9XG4gICAgdGhyb3cgZTtcbiAgfVxufVxuXG4vKipcbiAqIFBhcnNlcyB0aGUgcHVsbCByZXF1ZXN0IG51bWJlciBmcm9tIGVpdGhlciB0aGUgbnVtYmVyIG9yIHVybCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHJOdW1iZXIocHJVcmxPck51bWJlcjogc3RyaW5nKTogbnVtYmVyIHtcbiAgLy8gVGhlcmUgaXMgbm8gdXJsIHZhbGlkYXRpb24gaGVyZSBvdGhlciB0aGFuIHByZXNlbmNlIG9mIGAvYC5cbiAgLy8gU28gd2hhdGV2ZXIgaXMgdGhlIGxhc3Qgc2VnbWVudCBvZiB0aGF0IHN0cmluZywgdXJsIG9yIG5vdCwgd2lsbCBiZVxuICAvLyBwYXJzZWQgYXMgYSBQUiBudW1iZXIuXG4gIGNvbnN0IHByTnVtYmVyID0gcGFyc2VJbnQocHJVcmxPck51bWJlci5zcGxpdCgnLycpLnBvcCgpISk7XG4gIGlmIChpc05hTihwck51bWJlcikpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1B1bGwgUmVxdWVzdCB3YXMgdW5hYmxlIHRvIGJlIHBhcnNlZCBmcm9tIHRoZSBwYXJhbWV0ZXJzJyk7XG4gIH1cbiAgcmV0dXJuIHByTnVtYmVyO1xufVxuIl19