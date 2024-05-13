/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { bold, green, Log } from '../../utils/logging.js';
import { Prompt } from '../../utils/prompt.js';
import { isGithubApiError } from '../../utils/git/github.js';
import { isPullRequestMerged } from './pull-request-state.js';
/**
 * Prints the pull request to the console and informs the user about
 * the process of getting the pull request merged.
 *
 * The user will then be prompted, allowing the user to initiate the
 * merging. The tool will then attempt to merge the pull request
 * automatically.
 */
export async function promptToInitiatePullRequestMerge(git, { id, url }) {
    Log.info();
    Log.info();
    Log.info(green(bold(`      Pull request #${id} is sent out for review: ${url}`)));
    Log.warn(bold(`      Do not merge it manually. The tool will automatically merge it.`));
    Log.info('');
    Log.warn(`      The tool is ${bold('not')} ensuring that all tests pass. Branch protection`);
    Log.warn('      rules always apply, but other non-required checks can be skipped.');
    Log.info('');
    Log.info(`      If you think it is ready (i.e. has the necessary approvals), you can continue`);
    Log.info(`      by confirming the prompt. The tool will then auto-merge the PR if possible.`);
    Log.info('');
    // We will loop forever until the PR has been merged. If a user wants to abort,
    // the script needs to be aborted e.g. using CTRL + C.
    while (true) {
        if (!(await Prompt.confirm(`Do you want to continue with merging PR #${id}?`))) {
            continue;
        }
        Log.info(`      Attempting to merge pull request #${id}..`);
        Log.info(``);
        try {
            // Special logic that will check if the pull request is already merged. This should never
            // happen but there may be situations where a caretaker merged manually. We wouldn't want
            // the process to stuck forever here but continue given the caretaker explicitly confirming
            // that they would like to continue (assuming they expect the PR to be recognized as merged).
            if (await gracefulCheckIfPullRequestIsMerged(git, id)) {
                break;
            }
            const { data, status, headers } = await git.github.pulls.merge({
                ...git.remoteParams,
                pull_number: id,
                merge_method: 'rebase',
            });
            // If merge is successful, break out of the loop and complete the function.
            if (data.merged) {
                break;
            }
            // Octokit throws for non-200 status codes, but there may be unknown cases
            // where `merged` is false but we have a 200 status code. We handle this here
            // and allow for the merge to be re-attempted.
            Log.error(`  ✘   Pull request #${id} could not be merged.`);
            Log.error(`      ${data.message} (${status})`);
            Log.debug(data, status, headers);
        }
        catch (e) {
            if (!isGithubApiError(e)) {
                throw e;
            }
            // If there is an request error, e.g. 403 permissions or insufficient permissions
            // due to active branch protections, then we want to print the message and allow
            // for the user to re-attempt the merge (by continuing in the loop).
            Log.error(`  ✘   Pull request #${id} could not be merged.`);
            Log.error(`      ${e.message} (${e.status})`);
            Log.debug(e);
        }
    }
    Log.info(green(`  ✓   Pull request #${id} has been merged.`));
}
/** Gracefully checks whether the given pull request has been merged. */
async function gracefulCheckIfPullRequestIsMerged(git, id) {
    try {
        return await isPullRequestMerged(git, id);
    }
    catch (e) {
        if (isGithubApiError(e)) {
            Log.debug(`Unable to determine if pull request #${id} has been merged.`);
            Log.debug(e);
            return false;
        }
        throw e;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0LW1lcmdlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3JlbGVhc2UvcHVibGlzaC9wcm9tcHQtbWVyZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDeEQsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQzdDLE9BQU8sRUFBQyxnQkFBZ0IsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBRzNELE9BQU8sRUFBQyxtQkFBbUIsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBRTVEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLENBQUMsS0FBSyxVQUFVLGdDQUFnQyxDQUNwRCxHQUEyQixFQUMzQixFQUFDLEVBQUUsRUFBRSxHQUFHLEVBQWM7SUFFdEIsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ1gsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ1gsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLHVCQUF1QixFQUFFLDRCQUE0QixHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsRixHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyx1RUFBdUUsQ0FBQyxDQUFDLENBQUM7SUFDeEYsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNiLEdBQUcsQ0FBQyxJQUFJLENBQUMscUJBQXFCLElBQUksQ0FBQyxLQUFLLENBQUMsa0RBQWtELENBQUMsQ0FBQztJQUM3RixHQUFHLENBQUMsSUFBSSxDQUFDLHlFQUF5RSxDQUFDLENBQUM7SUFDcEYsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNiLEdBQUcsQ0FBQyxJQUFJLENBQUMscUZBQXFGLENBQUMsQ0FBQztJ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dCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0F1dGhlbnRpY2F0ZWRHaXRDbGllbnR9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQuanMnO1xuaW1wb3J0IHtib2xkLCBncmVlbiwgTG9nfSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7UHJvbXB0fSBmcm9tICcuLi8uLi91dGlscy9wcm9tcHQuanMnO1xuaW1wb3J0IHtpc0dpdGh1YkFwaUVycm9yfSBmcm9tICcuLi8uLi91dGlscy9naXQvZ2l0aHViLmpzJztcblxuaW1wb3J0IHtQdWxsUmVxdWVzdH0gZnJvbSAnLi9hY3Rpb25zLmpzJztcbmltcG9ydCB7aXNQdWxsUmVxdWVzdE1lcmdlZH0gZnJvbSAnLi9wdWxsLXJlcXVlc3Qtc3RhdGUuanMnO1xuXG4vKipcbiAqIFByaW50cyB0aGUgcHVsbCByZXF1ZXN0IHRvIHRoZSBjb25zb2xlIGFuZCBpbmZvcm1zIHRoZSB1c2VyIGFib3V0XG4gKiB0aGUgcHJvY2VzcyBvZiBnZXR0aW5nIHRoZSBwdWxsIHJlcXVlc3QgbWVyZ2VkLlxuICpcbiAqIFRoZSB1c2VyIHdpbGwgdGhlbiBiZSBwcm9tcHRlZCwgYWxsb3dpbmcgdGhlIHVzZXIgdG8gaW5pdGlhdGUgdGhlXG4gKiBtZXJnaW5nLiBUaGUgdG9vbCB3aWxsIHRoZW4gYXR0ZW1wdCB0byBtZXJnZSB0aGUgcHVsbCByZXF1ZXN0XG4gKiBhdXRvbWF0aWNhbGx5LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcHJvbXB0VG9Jbml0aWF0ZVB1bGxSZXF1ZXN0TWVyZ2UoXG4gIGdpdDogQXV0aGVudGljYXRlZEdpdENsaWVudCxcbiAge2lkLCB1cmx9OiBQdWxsUmVxdWVzdCxcbik6IFByb21pc2U8dm9pZD4ge1xuICBMb2cuaW5mbygpO1xuICBMb2cuaW5mbygpO1xuICBMb2cuaW5mbyhncmVlbihib2xkKGAgICAgICBQdWxsIHJlcXVlc3QgIyR7aWR9IGlzIHNlbnQgb3V0IGZvciByZXZpZXc6ICR7dXJsfWApKSk7XG4gIExvZy53YXJuKGJvbGQoYCAgICAgIERvIG5vdCBtZXJnZSBpdCBtYW51YWxseS4gVGhlIHRvb2wgd2lsbCBhdXRvbWF0aWNhbGx5IG1lcmdlIGl0LmApKTtcbiAgTG9nLmluZm8oJycpO1xuICBMb2cud2FybihgICAgICAgVGhlIHRvb2wgaXMgJHtib2xkKCdub3QnKX0gZW5zdXJpbmcgdGhhdCBhbGwgdGVzdHMgcGFzcy4gQnJhbmNoIHByb3RlY3Rpb25gKTtcbiAgTG9nLndhcm4oJyAgICAgIHJ1bGVzIGFsd2F5cyBhcHBseSwgYnV0IG90aGVyIG5vbi1yZXF1aXJlZCBjaGVja3MgY2FuIGJlIHNraXBwZWQuJyk7XG4gIExvZy5pbmZvKCcnKTtcbiAgTG9nLmluZm8oYCAgICAgIElmIHlvdSB0aGluayBpdCBpcyByZWFkeSAoaS5lLiBoYXMgdGhlIG5lY2Vzc2FyeSBhcHByb3ZhbHMpLCB5b3UgY2FuIGNvbnRpbnVlYCk7XG4gIExvZy5pbmZvKGAgICAgICBieSBjb25maXJtaW5nIHRoZSBwcm9tcHQuIFRoZSB0b29sIHdpbGwgdGhlbiBhdXRvLW1lcmdlIHRoZSBQUiBpZiBwb3NzaWJsZS5gKTtcbiAgTG9nLmluZm8oJycpO1xuXG4gIC8vIFdlIHdpbGwgbG9vcCBmb3JldmVyIHVudGlsIHRoZSBQUiBoYXMgYmVlbiBtZXJnZWQuIElmIGEgdXNlciB3YW50cyB0byBhYm9ydCxcbiAgLy8gdGhlIHNjcmlwdCBuZWVkcyB0byBiZSBhYm9ydGVkIGUuZy4gdXNpbmcgQ1RSTCArIEMuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgaWYgKCEoYXdhaXQgUHJvbXB0LmNvbmZpcm0oYERvIHlvdSB3YW50IHRvIGNvbnRpbnVlIHdpdGggbWVyZ2luZyBQUiAjJHtpZH0/YCkpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBMb2cuaW5mbyhgICAgICAgQXR0ZW1wdGluZyB0byBtZXJnZSBwdWxsIHJlcXVlc3QgIyR7aWR9Li5gKTtcbiAgICBMb2cuaW5mbyhgYCk7XG5cbiAgICB0cnkge1xuICAgICAgLy8gU3BlY2lhbCBsb2dpYyB0aGF0IHdpbGwgY2hlY2sgaWYgdGhlIHB1bGwgcmVxdWVzdCBpcyBhbHJlYWR5IG1lcmdlZC4gVGhpcyBzaG91bGQgbmV2ZXJcbiAgICAgIC8vIGhhcHBlbiBidXQgdGhlcmUgbWF5IGJlIHNpdHVhdGlvbnMgd2hlcmUgYSBjYXJldGFrZXIgbWVyZ2VkIG1hbnVhbGx5LiBXZSB3b3VsZG4ndCB3YW50XG4gICAgICAvLyB0aGUgcHJvY2VzcyB0byBzdHVjayBmb3JldmVyIGhlcmUgYnV0IGNvbnRpbnVlIGdpdmVuIHRoZSBjYXJldGFrZXIgZXhwbGljaXRseSBjb25maXJtaW5nXG4gICAgICAvLyB0aGF0IHRoZXkgd291bGQgbGlrZSB0byBjb250aW51ZSAoYXNzdW1pbmcgdGhleSBleHBlY3QgdGhlIFBSIHRvIGJlIHJlY29nbml6ZWQgYXMgbWVyZ2VkKS5cbiAgICAgIGlmIChhd2FpdCBncmFjZWZ1bENoZWNrSWZQdWxsUmVxdWVzdElzTWVyZ2VkKGdpdCwgaWQpKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB7ZGF0YSwgc3RhdHVzLCBoZWFkZXJzfSA9IGF3YWl0IGdpdC5naXRodWIucHVsbHMubWVyZ2Uoe1xuICAgICAgICAuLi5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgICBwdWxsX251bWJlcjogaWQsXG4gICAgICAgIG1lcmdlX21ldGhvZDogJ3JlYmFzZScsXG4gICAgICB9KTtcblxuICAgICAgLy8gSWYgbWVyZ2UgaXMgc3VjY2Vzc2Z1bCwgYnJlYWsgb3V0IG9mIHRoZSBsb29wIGFuZCBjb21wbGV0ZSB0aGUgZnVuY3Rpb24uXG4gICAgICBpZiAoZGF0YS5tZXJnZWQpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIC8vIE9jdG9raXQgdGhyb3dzIGZvciBub24tMjAwIHN0YXR1cyBjb2RlcywgYnV0IHRoZXJlIG1heSBiZSB1bmtub3duIGNhc2VzXG4gICAgICAvLyB3aGVyZSBgbWVyZ2VkYCBpcyBmYWxzZSBidXQgd2UgaGF2ZSBhIDIwMCBzdGF0dXMgY29kZS4gV2UgaGFuZGxlIHRoaXMgaGVyZVxuICAgICAgLy8gYW5kIGFsbG93IGZvciB0aGUgbWVyZ2UgdG8gYmUgcmUtYXR0ZW1wdGVkLlxuICAgICAgTG9nLmVycm9yKGAgIOKcmCAgIFB1bGwgcmVxdWVzdCAjJHtpZH0gY291bGQgbm90IGJlIG1lcmdlZC5gKTtcbiAgICAgIExvZy5lcnJvcihgICAgICAgJHtkYXRhLm1lc3NhZ2V9ICgke3N0YXR1c30pYCk7XG4gICAgICBMb2cuZGVidWcoZGF0YSwgc3RhdHVzLCBoZWFkZXJzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoIWlzR2l0aHViQXBpRXJyb3IoZSkpIHtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgdGhlcmUgaXMgYW4gcmVxdWVzdCBlcnJvciwgZS5nLiA0MDMgcGVybWlzc2lvbnMgb3IgaW5zdWZmaWNpZW50IHBlcm1pc3Npb25zXG4gICAgICAvLyBkdWUgdG8gYWN0aXZlIGJyYW5jaCBwcm90ZWN0aW9ucywgdGhlbiB3ZSB3YW50IHRvIHByaW50IHRoZSBtZXNzYWdlIGFuZCBhbGxvd1xuICAgICAgLy8gZm9yIHRoZSB1c2VyIHRvIHJlLWF0dGVtcHQgdGhlIG1lcmdlIChieSBjb250aW51aW5nIGluIHRoZSBsb29wKS5cbiAgICAgIExvZy5lcnJvcihgICDinJggICBQdWxsIHJlcXVlc3QgIyR7aWR9IGNvdWxkIG5vdCBiZSBtZXJnZWQuYCk7XG4gICAgICBMb2cuZXJyb3IoYCAgICAgICR7ZS5tZXNzYWdlfSAoJHtlLnN0YXR1c30pYCk7XG4gICAgICBMb2cuZGVidWcoZSk7XG4gICAgfVxuICB9XG5cbiAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgUHVsbCByZXF1ZXN0ICMke2lkfSBoYXMgYmVlbiBtZXJnZWQuYCkpO1xufVxuXG4vKiogR3JhY2VmdWxseSBjaGVja3Mgd2hldGhlciB0aGUgZ2l2ZW4gcHVsbCByZXF1ZXN0IGhhcyBiZWVuIG1lcmdlZC4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdyYWNlZnVsQ2hlY2tJZlB1bGxSZXF1ZXN0SXNNZXJnZWQoXG4gIGdpdDogQXV0aGVudGljYXRlZEdpdENsaWVudCxcbiAgaWQ6IG51bWJlcixcbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCBpc1B1bGxSZXF1ZXN0TWVyZ2VkKGdpdCwgaWQpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKGlzR2l0aHViQXBpRXJyb3IoZSkpIHtcbiAgICAgIExvZy5kZWJ1ZyhgVW5hYmxlIHRvIGRldGVybWluZSBpZiBwdWxsIHJlcXVlc3QgIyR7aWR9IGhhcyBiZWVuIG1lcmdlZC5gKTtcbiAgICAgIExvZy5kZWJ1ZyhlKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdGhyb3cgZTtcbiAgfVxufVxuIl19