/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { dirname, join } from 'path';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { bold, green, Log } from '../../utils/logging.js';
import { Prompt } from '../../utils/prompt.js';
import { fileURLToPath } from 'url';
/** List of accounts that are supported for takeover. */
const takeoverAccounts = ['angular-robot'];
/**
 * Checkout the provided pull request in preperation for a new takeover pull request to be made
 */
export async function checkoutAsPrTakeover(prNumber, { resetGitState, pullRequest }) {
    /** An authenticated git client. */
    const git = await AuthenticatedGitClient.get();
    /** The branch name to be used for the takeover attempt. */
    const branchName = `pr-takeover-${prNumber}`;
    if (git.runGraceful(['rev-parse', '-q', '--verify', branchName]).status === 0) {
        Log.error(` ✘ Expected branch name \`${branchName}\` already exists locally`);
        return;
    }
    // Validate that the takeover attempt is being made against a pull request created by an
    // expected account.
    if (!takeoverAccounts.includes(pullRequest.author.login)) {
        Log.warn(` ⚠ ${bold(pullRequest.author.login)} is not an account fully supported for takeover.`);
        Log.warn(`   Supported accounts: ${bold(takeoverAccounts.join(', '))}`);
        if (await Prompt.confirm({
            message: `Continue with pull request takeover anyway?`,
            default: true,
        })) {
            Log.debug('Continuing per user confirmation in prompt');
        }
        else {
            Log.info('Aborting takeover..');
            resetGitState();
            return;
        }
    }
    Log.info(`Setting local branch name based on the pull request`);
    git.run(['checkout', '-q', '-b', branchName]);
    Log.info('Updating commit messages to close previous pull request');
    git.run([
        'filter-branch',
        '-f',
        '--msg-filter',
        `${getCommitMessageFilterScriptPath()} ${prNumber}`,
        `${pullRequest.baseRefOid}..HEAD`,
    ]);
    Log.info(` ${green('✔')} Checked out pull request #${prNumber} into branch: ${branchName}`);
}
/** Gets the absolute file path to the commit-message filter script. */
function getCommitMessageFilterScriptPath() {
    // This file is getting bundled and ends up in `<pkg-root>/bundles/<chunk>`. We also
    // bundle the commit-message-filter script as another entry-point and can reference
    // it relatively as the path is preserved inside `bundles/`.
    // *Note*: Relying on package resolution is problematic within ESM and with `local-dev.sh`
    const bundlesDir = dirname(fileURLToPath(import.meta.url));
    return join(bundlesDir, './pr/checkout/commit-message-filter.mjs');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFrZW92ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvY2hlY2tvdXQvdGFrZW92ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFDbkMsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFDbkYsT0FBTyxFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDeEQsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBRTdDLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxLQUFLLENBQUM7QUFFbEMsd0RBQXdEO0FBQ3hELE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUUzQzs7R0FFRztBQUNILE1BQU0sQ0FBQyxLQUFLLFVBQVUsb0JBQW9CLENBQ3hDLFFBQWdCLEVBQ2hCLEVBQUMsYUFBYSxFQUFFLFdBQVcsRUFBeUQ7SUFFcEYsbUNBQW1DO0lBQ25DLE1BQU0sR0FBRyxHQUFHLE1BQU0sc0JBQXNCLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDL0MsMkRBQTJEO0lBQzNELE1BQU0sVUFBVSxHQUFHLGVBQWUsUUFBUSxFQUFFLENBQUM7SUFFN0MsSUFBSSxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsV0FBVyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDOUUsR0FBRyxDQUFDLEtBQUssQ0FBQyw2QkFBNkIsVUFBVSwyQkFBMkIsQ0FBQyxDQUFDO1FBQzlFLE9BQU87SUFDVCxDQUFDO0lBRUQsd0ZBQXdGO0lBQ3hGLG9CQUFvQjtJQUNwQixJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUN6RCxHQUFHLENBQUMsSUFBSSxDQUNOLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGtEQUFrRCxDQUN2RixDQUFDO1FBQ0YsR0FBRyxDQUFDLElBQUksQ0FBQywwQkFBMEIsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUN4RSxJQUNFLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQztZQUNuQixPQUFPLEVBQUUsNkNBQTZDO1lBQ3RELE9BQU8sRUFBRSxJQUFJO1NBQ2QsQ0FBQyxFQUNGLENBQUM7WUFDRCxHQUFHLENBQUMsS0FBSyxDQUFDLDRDQUE0QyxDQUFDLENBQUM7UUFDMUQsQ0FBQzthQUFNLENBQUM7WUFDTixHQUFHLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7WUFDaEMsYUFBYSxFQUFFLENBQUM7WUFDaEIsT0FBTztRQUNULENBQUM7SUFDSCxDQUFDO0lBRUQsR0FBRyxDQUFDLElBQUksQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO0lBQ2hFLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBRTlDLEdBQUcsQ0FBQyxJQUFJLENBQUMseURBQXlELENBQUMsQ0FBQztJQUNwRSxHQUFHLENBQUMsR0FBRyxDQUFDO1FBQ04sZUFBZTtRQUNmLElBQUk7UUFDSixjQUFjO1FBQ2QsR0FBRyxnQ0FBZ0MsRUFBRSxJQUFJLFFBQVEsRUFBRTtRQUNuRCxHQUFHLFdBQVcsQ0FBQyxVQUFVLFFBQVE7S0FDbEMsQ0FBQyxDQUFDO0lBRUgsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsOEJBQThCLFFBQVEsaUJBQWlCLFVBQVUsRUFBRSxDQUFDLENBQUM7QUFDOUYsQ0FBQztBQUVELHVFQUF1RTtBQUN2RSxTQUFTLGdDQUFnQztJQUN2QyxvRkFBb0Y7SUFDcEYsbUZBQW1GO0lBQ25GLDREQUE0RDtJQUM1RCwwRkFBMEY7SUFDMUYsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDM0QsT0FBTyxJQUFJLENBQUMsVUFBVSxFQUFFLHlDQUF5QyxDQUFDLENBQUM7QUFDckUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2Rpcm5hbWUsIGpvaW59IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtBdXRoZW50aWNhdGVkR2l0Q2xpZW50fSBmcm9tICcuLi8uLi91dGlscy9naXQvYXV0aGVudGljYXRlZC1naXQtY2xpZW50LmpzJztcbmltcG9ydCB7Ym9sZCwgZ3JlZW4sIExvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge1Byb21wdH0gZnJvbSAnLi4vLi4vdXRpbHMvcHJvbXB0LmpzJztcbmltcG9ydCB7Y2hlY2tPdXRQdWxsUmVxdWVzdExvY2FsbHl9IGZyb20gJy4uL2NvbW1vbi9jaGVja291dC1wci5qcyc7XG5pbXBvcnQge2ZpbGVVUkxUb1BhdGh9IGZyb20gJ3VybCc7XG5cbi8qKiBMaXN0IG9mIGFjY291bnRzIHRoYXQgYXJlIHN1cHBvcnRlZCBmb3IgdGFrZW92ZXIuICovXG5jb25zdCB0YWtlb3ZlckFjY291bnRzID0gWydhbmd1bGFyLXJvYm90J107XG5cbi8qKlxuICogQ2hlY2tvdXQgdGhlIHByb3ZpZGVkIHB1bGwgcmVxdWVzdCBpbiBwcmVwZXJhdGlvbiBmb3IgYSBuZXcgdGFrZW92ZXIgcHVsbCByZXF1ZXN0IHRvIGJlIG1hZGVcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNoZWNrb3V0QXNQclRha2VvdmVyKFxuICBwck51bWJlcjogbnVtYmVyLFxuICB7cmVzZXRHaXRTdGF0ZSwgcHVsbFJlcXVlc3R9OiBBd2FpdGVkPFJldHVyblR5cGU8dHlwZW9mIGNoZWNrT3V0UHVsbFJlcXVlc3RMb2NhbGx5Pj4sXG4pIHtcbiAgLyoqIEFuIGF1dGhlbnRpY2F0ZWQgZ2l0IGNsaWVudC4gKi9cbiAgY29uc3QgZ2l0ID0gYXdhaXQgQXV0aGVudGljYXRlZEdpdENsaWVudC5nZXQoKTtcbiAgLyoqIFRoZSBicmFuY2ggbmFtZSB0byBiZSB1c2VkIGZvciB0aGUgdGFrZW92ZXIgYXR0ZW1wdC4gKi9cbiAgY29uc3QgYnJhbmNoTmFtZSA9IGBwci10YWtlb3Zlci0ke3ByTnVtYmVyfWA7XG5cbiAgaWYgKGdpdC5ydW5HcmFjZWZ1bChbJ3Jldi1wYXJzZScsICctcScsICctLXZlcmlmeScsIGJyYW5jaE5hbWVdKS5zdGF0dXMgPT09IDApIHtcbiAgICBMb2cuZXJyb3IoYCDinJggRXhwZWN0ZWQgYnJhbmNoIG5hbWUgXFxgJHticmFuY2hOYW1lfVxcYCBhbHJlYWR5IGV4aXN0cyBsb2NhbGx5YCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gVmFsaWRhdGUgdGhhdCB0aGUgdGFrZW92ZXIgYXR0ZW1wdCBpcyBiZWluZyBtYWRlIGFnYWluc3QgYSBwdWxsIHJlcXVlc3QgY3JlYXRlZCBieSBhblxuICAvLyBleHBlY3RlZCBhY2NvdW50LlxuICBpZiAoIXRha2VvdmVyQWNjb3VudHMuaW5jbHVkZXMocHVsbFJlcXVlc3QuYXV0aG9yLmxvZ2luKSkge1xuICAgIExvZy53YXJuKFxuICAgICAgYCDimqAgJHtib2xkKHB1bGxSZXF1ZXN0LmF1dGhvci5sb2dpbil9IGlzIG5vdCBhbiBhY2NvdW50IGZ1bGx5IHN1cHBvcnRlZCBmb3IgdGFrZW92ZXIuYCxcbiAgICApO1xuICAgIExvZy53YXJuKGAgICBTdXBwb3J0ZWQgYWNjb3VudHM6ICR7Ym9sZCh0YWtlb3ZlckFjY291bnRzLmpvaW4oJywgJykpfWApO1xuICAgIGlmIChcbiAgICAgIGF3YWl0IFByb21wdC5jb25maXJtKHtcbiAgICAgICAgbWVzc2FnZTogYENvbnRpbnVlIHdpdGggcHVsbCByZXF1ZXN0IHRha2VvdmVyIGFueXdheT9gLFxuICAgICAgICBkZWZhdWx0OiB0cnVlLFxuICAgICAgfSlcbiAgICApIHtcbiAgICAgIExvZy5kZWJ1ZygnQ29udGludWluZyBwZXIgdXNlciBjb25maXJtYXRpb24gaW4gcHJvbXB0Jyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIExvZy5pbmZvKCdBYm9ydGluZyB0YWtlb3Zlci4uJyk7XG4gICAgICByZXNldEdpdFN0YXRlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG5cbiAgTG9nLmluZm8oYFNldHRpbmcgbG9jYWwgYnJhbmNoIG5hbWUgYmFzZWQgb24gdGhlIHB1bGwgcmVxdWVzdGApO1xuICBnaXQucnVuKFsnY2hlY2tvdXQnLCAnLXEnLCAnLWInLCBicmFuY2hOYW1lXSk7XG5cbiAgTG9nLmluZm8oJ1VwZGF0aW5nIGNvbW1pdCBtZXNzYWdlcyB0byBjbG9zZSBwcmV2aW91cyBwdWxsIHJlcXVlc3QnKTtcbiAgZ2l0LnJ1bihbXG4gICAgJ2ZpbHRlci1icmFuY2gnLFxuICAgICctZicsXG4gICAgJy0tbXNnLWZpbHRlcicsXG4gICAgYCR7Z2V0Q29tbWl0TWVzc2FnZUZpbHRlclNjcmlwdFBhdGgoKX0gJHtwck51bWJlcn1gLFxuICAgIGAke3B1bGxSZXF1ZXN0LmJhc2VSZWZPaWR9Li5IRUFEYCxcbiAgXSk7XG5cbiAgTG9nLmluZm8oYCAke2dyZWVuKCfinJQnKX0gQ2hlY2tlZCBvdXQgcHVsbCByZXF1ZXN0ICMke3ByTnVtYmVyfSBpbnRvIGJyYW5jaDogJHticmFuY2hOYW1lfWApO1xufVxuXG4vKiogR2V0cyB0aGUgYWJzb2x1dGUgZmlsZSBwYXRoIHRvIHRoZSBjb21taXQtbWVzc2FnZSBmaWx0ZXIgc2NyaXB0LiAqL1xuZnVuY3Rpb24gZ2V0Q29tbWl0TWVzc2FnZUZpbHRlclNjcmlwdFBhdGgoKTogc3RyaW5nIHtcbiAgLy8gVGhpcyBmaWxlIGlzIGdldHRpbmcgYnVuZGxlZCBhbmQgZW5kcyB1cCBpbiBgPHBrZy1yb290Pi9idW5kbGVzLzxjaHVuaz5gLiBXZSBhbHNvXG4gIC8vIGJ1bmRsZSB0aGUgY29tbWl0LW1lc3NhZ2UtZmlsdGVyIHNjcmlwdCBhcyBhbm90aGVyIGVudHJ5LXBvaW50IGFuZCBjYW4gcmVmZXJlbmNlXG4gIC8vIGl0IHJlbGF0aXZlbHkgYXMgdGhlIHBhdGggaXMgcHJlc2VydmVkIGluc2lkZSBgYnVuZGxlcy9gLlxuICAvLyAqTm90ZSo6IFJlbHlpbmcgb24gcGFja2FnZSByZXNvbHV0aW9uIGlzIHByb2JsZW1hdGljIHdpdGhpbiBFU00gYW5kIHdpdGggYGxvY2FsLWRldi5zaGBcbiAgY29uc3QgYnVuZGxlc0RpciA9IGRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKTtcbiAgcmV0dXJuIGpvaW4oYnVuZGxlc0RpciwgJy4vcHIvY2hlY2tvdXQvY29tbWl0LW1lc3NhZ2UtZmlsdGVyLm1qcycpO1xufVxuIl19