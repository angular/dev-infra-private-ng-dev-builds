/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { bold, green, Log } from '../../utils/logging.js';
import { isGithubApiError } from '../../utils/git/github.js';
import { isPullRequestMerged } from './pull-request-state.js';
import { Prompt } from '../../utils/prompt.js';
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
        if (!(await Prompt.confirm({ message: `Do you want to continue with merging PR #${id}?` }))) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0LW1lcmdlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3JlbGVhc2UvcHVibGlzaC9wcm9tcHQtbWVyZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBR0gsT0FBTyxFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDeEQsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFHM0QsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDNUQsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBRTdDOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLENBQUMsS0FBSyxVQUFVLGdDQUFnQyxDQUNwRCxHQUEyQixFQUMzQixFQUFDLEVBQUUsRUFBRSxHQUFHLEVBQWM7SUFFdEIsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ1gsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ1gsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLHVCQUF1QixFQUFFLDRCQUE0QixHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsRixHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyx1RUFBdUUsQ0FBQyxDQUFDLENBQUM7SUFDeEYsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNiLEdBQUcsQ0FBQyxJQUFJLENBQUMscUJBQXFCLElBQUksQ0FBQyxLQUFLLENBQUMsa0RBQWtELENBQUMsQ0FBQztJQUM3RixHQUFHLENBQUMsSUFBSSxDQUFDLHlFQUF5RSxDQUFDLENBQUM7SUFDcEYsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNiLEdBQUcsQ0FBQyxJQUFJLENBQUMscUZBQXFGLENBQUMsQ0FBQztJ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bGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QXV0aGVudGljYXRlZEdpdENsaWVudH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2F1dGhlbnRpY2F0ZWQtZ2l0LWNsaWVudC5qcyc7XG5pbXBvcnQge2JvbGQsIGdyZWVuLCBMb2d9IGZyb20gJy4uLy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuaW1wb3J0IHtpc0dpdGh1YkFwaUVycm9yfSBmcm9tICcuLi8uLi91dGlscy9naXQvZ2l0aHViLmpzJztcblxuaW1wb3J0IHtQdWxsUmVxdWVzdH0gZnJvbSAnLi9hY3Rpb25zLmpzJztcbmltcG9ydCB7aXNQdWxsUmVxdWVzdE1lcmdlZH0gZnJvbSAnLi9wdWxsLXJlcXVlc3Qtc3RhdGUuanMnO1xuaW1wb3J0IHtQcm9tcHR9IGZyb20gJy4uLy4uL3V0aWxzL3Byb21wdC5qcyc7XG5cbi8qKlxuICogUHJpbnRzIHRoZSBwdWxsIHJlcXVlc3QgdG8gdGhlIGNvbnNvbGUgYW5kIGluZm9ybXMgdGhlIHVzZXIgYWJvdXRcbiAqIHRoZSBwcm9jZXNzIG9mIGdldHRpbmcgdGhlIHB1bGwgcmVxdWVzdCBtZXJnZWQuXG4gKlxuICogVGhlIHVzZXIgd2lsbCB0aGVuIGJlIHByb21wdGVkLCBhbGxvd2luZyB0aGUgdXNlciB0byBpbml0aWF0ZSB0aGVcbiAqIG1lcmdpbmcuIFRoZSB0b29sIHdpbGwgdGhlbiBhdHRlbXB0IHRvIG1lcmdlIHRoZSBwdWxsIHJlcXVlc3RcbiAqIGF1dG9tYXRpY2FsbHkuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcm9tcHRUb0luaXRpYXRlUHVsbFJlcXVlc3RNZXJnZShcbiAgZ2l0OiBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LFxuICB7aWQsIHVybH06IFB1bGxSZXF1ZXN0LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIExvZy5pbmZvKCk7XG4gIExvZy5pbmZvKCk7XG4gIExvZy5pbmZvKGdyZWVuKGJvbGQoYCAgICAgIFB1bGwgcmVxdWVzdCAjJHtpZH0gaXMgc2VudCBvdXQgZm9yIHJldmlldzogJHt1cmx9YCkpKTtcbiAgTG9nLndhcm4oYm9sZChgICAgICAgRG8gbm90IG1lcmdlIGl0IG1hbnVhbGx5LiBUaGUgdG9vbCB3aWxsIGF1dG9tYXRpY2FsbHkgbWVyZ2UgaXQuYCkpO1xuICBMb2cuaW5mbygnJyk7XG4gIExvZy53YXJuKGAgICAgICBUaGUgdG9vbCBpcyAke2JvbGQoJ25vdCcpfSBlbnN1cmluZyB0aGF0IGFsbCB0ZXN0cyBwYXNzLiBCcmFuY2ggcHJvdGVjdGlvbmApO1xuICBMb2cud2FybignICAgICAgcnVsZXMgYWx3YXlzIGFwcGx5LCBidXQgb3RoZXIgbm9uLXJlcXVpcmVkIGNoZWNrcyBjYW4gYmUgc2tpcHBlZC4nKTtcbiAgTG9nLmluZm8oJycpO1xuICBMb2cuaW5mbyhgICAgICAgSWYgeW91IHRoaW5rIGl0IGlzIHJlYWR5IChpLmUuIGhhcyB0aGUgbmVjZXNzYXJ5IGFwcHJvdmFscyksIHlvdSBjYW4gY29udGludWVgKTtcbiAgTG9nLmluZm8oYCAgICAgIGJ5IGNvbmZpcm1pbmcgdGhlIHByb21wdC4gVGhlIHRvb2wgd2lsbCB0aGVuIGF1dG8tbWVyZ2UgdGhlIFBSIGlmIHBvc3NpYmxlLmApO1xuICBMb2cuaW5mbygnJyk7XG5cbiAgLy8gV2Ugd2lsbCBsb29wIGZvcmV2ZXIgdW50aWwgdGhlIFBSIGhhcyBiZWVuIG1lcmdlZC4gSWYgYSB1c2VyIHdhbnRzIHRvIGFib3J0LFxuICAvLyB0aGUgc2NyaXB0IG5lZWRzIHRvIGJlIGFib3J0ZWQgZS5nLiB1c2luZyBDVFJMICsgQy5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBpZiAoIShhd2FpdCBQcm9tcHQuY29uZmlybSh7bWVzc2FnZTogYERvIHlvdSB3YW50IHRvIGNvbnRpbnVlIHdpdGggbWVyZ2luZyBQUiAjJHtpZH0/YH0pKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgTG9nLmluZm8oYCAgICAgIEF0dGVtcHRpbmcgdG8gbWVyZ2UgcHVsbCByZXF1ZXN0ICMke2lkfS4uYCk7XG4gICAgTG9nLmluZm8oYGApO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFNwZWNpYWwgbG9naWMgdGhhdCB3aWxsIGNoZWNrIGlmIHRoZSBwdWxsIHJlcXVlc3QgaXMgYWxyZWFkeSBtZXJnZWQuIFRoaXMgc2hvdWxkIG5ldmVyXG4gICAgICAvLyBoYXBwZW4gYnV0IHRoZXJlIG1heSBiZSBzaXR1YXRpb25zIHdoZXJlIGEgY2FyZXRha2VyIG1lcmdlZCBtYW51YWxseS4gV2Ugd291bGRuJ3Qgd2FudFxuICAgICAgLy8gdGhlIHByb2Nlc3MgdG8gc3R1Y2sgZm9yZXZlciBoZXJlIGJ1dCBjb250aW51ZSBnaXZlbiB0aGUgY2FyZXRha2VyIGV4cGxpY2l0bHkgY29uZmlybWluZ1xuICAgICAgLy8gdGhhdCB0aGV5IHdvdWxkIGxpa2UgdG8gY29udGludWUgKGFzc3VtaW5nIHRoZXkgZXhwZWN0IHRoZSBQUiB0byBiZSByZWNvZ25pemVkIGFzIG1lcmdlZCkuXG4gICAgICBpZiAoYXdhaXQgZ3JhY2VmdWxDaGVja0lmUHVsbFJlcXVlc3RJc01lcmdlZChnaXQsIGlkKSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY29uc3Qge2RhdGEsIHN0YXR1cywgaGVhZGVyc30gPSBhd2FpdCBnaXQuZ2l0aHViLnB1bGxzLm1lcmdlKHtcbiAgICAgICAgLi4uZ2l0LnJlbW90ZVBhcmFtcyxcbiAgICAgICAgcHVsbF9udW1iZXI6IGlkLFxuICAgICAgICBtZXJnZV9tZXRob2Q6ICdyZWJhc2UnLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIElmIG1lcmdlIGlzIHN1Y2Nlc3NmdWwsIGJyZWFrIG91dCBvZiB0aGUgbG9vcCBhbmQgY29tcGxldGUgdGhlIGZ1bmN0aW9uLlxuICAgICAgaWYgKGRhdGEubWVyZ2VkKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICAvLyBPY3Rva2l0IHRocm93cyBmb3Igbm9uLTIwMCBzdGF0dXMgY29kZXMsIGJ1dCB0aGVyZSBtYXkgYmUgdW5rbm93biBjYXNlc1xuICAgICAgLy8gd2hlcmUgYG1lcmdlZGAgaXMgZmFsc2UgYnV0IHdlIGhhdmUgYSAyMDAgc3RhdHVzIGNvZGUuIFdlIGhhbmRsZSB0aGlzIGhlcmVcbiAgICAgIC8vIGFuZCBhbGxvdyBmb3IgdGhlIG1lcmdlIHRvIGJlIHJlLWF0dGVtcHRlZC5cbiAgICAgIExvZy5lcnJvcihgICDinJggICBQdWxsIHJlcXVlc3QgIyR7aWR9IGNvdWxkIG5vdCBiZSBtZXJnZWQuYCk7XG4gICAgICBMb2cuZXJyb3IoYCAgICAgICR7ZGF0YS5tZXNzYWdlfSAoJHtzdGF0dXN9KWApO1xuICAgICAgTG9nLmRlYnVnKGRhdGEsIHN0YXR1cywgaGVhZGVycyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKCFpc0dpdGh1YkFwaUVycm9yKGUpKSB7XG4gICAgICAgIHRocm93IGU7XG4gICAgICB9XG5cbiAgICAgIC8vIElmIHRoZXJlIGlzIGFuIHJlcXVlc3QgZXJyb3IsIGUuZy4gNDAzIHBlcm1pc3Npb25zIG9yIGluc3VmZmljaWVudCBwZXJtaXNzaW9uc1xuICAgICAgLy8gZHVlIHRvIGFjdGl2ZSBicmFuY2ggcHJvdGVjdGlvbnMsIHRoZW4gd2Ugd2FudCB0byBwcmludCB0aGUgbWVzc2FnZSBhbmQgYWxsb3dcbiAgICAgIC8vIGZvciB0aGUgdXNlciB0byByZS1hdHRlbXB0IHRoZSBtZXJnZSAoYnkgY29udGludWluZyBpbiB0aGUgbG9vcCkuXG4gICAgICBMb2cuZXJyb3IoYCAg4pyYICAgUHVsbCByZXF1ZXN0ICMke2lkfSBjb3VsZCBub3QgYmUgbWVyZ2VkLmApO1xuICAgICAgTG9nLmVycm9yKGAgICAgICAke2UubWVzc2FnZX0gKCR7ZS5zdGF0dXN9KWApO1xuICAgICAgTG9nLmRlYnVnKGUpO1xuICAgIH1cbiAgfVxuXG4gIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIFB1bGwgcmVxdWVzdCAjJHtpZH0gaGFzIGJlZW4gbWVyZ2VkLmApKTtcbn1cblxuLyoqIEdyYWNlZnVsbHkgY2hlY2tzIHdoZXRoZXIgdGhlIGdpdmVuIHB1bGwgcmVxdWVzdCBoYXMgYmVlbiBtZXJnZWQuICovXG5hc3luYyBmdW5jdGlvbiBncmFjZWZ1bENoZWNrSWZQdWxsUmVxdWVzdElzTWVyZ2VkKFxuICBnaXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4gIGlkOiBudW1iZXIsXG4pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgaXNQdWxsUmVxdWVzdE1lcmdlZChnaXQsIGlkKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGlmIChpc0dpdGh1YkFwaUVycm9yKGUpKSB7XG4gICAgICBMb2cuZGVidWcoYFVuYWJsZSB0byBkZXRlcm1pbmUgaWYgcHVsbCByZXF1ZXN0ICMke2lkfSBoYXMgYmVlbiBtZXJnZWQuYCk7XG4gICAgICBMb2cuZGVidWcoZSk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHRocm93IGU7XG4gIH1cbn1cbiJdfQ==