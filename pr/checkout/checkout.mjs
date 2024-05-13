import { dirname, join } from 'path';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { Prompt } from '../../utils/prompt.js';
import { Log, bold, green } from '../../utils/logging.js';
import { checkOutPullRequestLocally } from '../common/checkout-pr.js';
import { fileURLToPath } from 'url';
/** List of accounts that are supported for takeover. */
const takeoverAccounts = ['angular-robot'];
export async function checkoutPullRequest(params) {
    const { pr, takeover } = params;
    /** An authenticated git client. */
    const git = await AuthenticatedGitClient.get();
    /** The branch name used for the takeover change. */
    const branchName = `pr-takeover-${pr}`;
    // Make sure the local repository is clean.
    if (git.hasUncommittedChanges()) {
        Log.error(` ✘ Local working repository not clean. Please make sure there are no uncommitted changes`);
        return;
    }
    const { resetGitState, pullRequest, pushToUpstreamCommand } = await checkOutPullRequestLocally(pr, {
        allowIfMaintainerCannotModify: true,
    });
    // if maintainer can modify is false or if takeover is provided do takeover
    if (pullRequest.maintainerCanModify === false || takeover) {
        if (takeover !== true) {
            Log.info('The author of this pull request does not allow maintainers to modify the pull');
            Log.info('request. Since you will not be able to push changes to the original pull request');
            Log.info('you will instead need to perform a "takeover." In a takeover the original pull');
            Log.info('request will be checked out, the commits are modified to close the original on');
            Log.info('merge of the newly created branch.\n');
            if (!(await Prompt.confirm(`Would you like to create a takeover pull request?`, true))) {
                Log.info('Aborting takeover..');
                await resetGitState();
                return;
            }
        }
        if (git.runGraceful(['rev-parse', '-q', '--verify', branchName]).status === 0) {
            Log.error(` ✘ Expected branch name \`${branchName}\` already exists locally`);
            return;
        }
        // Confirm that the takeover request is being done on a valid pull request.
        if (!takeoverAccounts.includes(pullRequest.author.login)) {
            Log.warn(` ⚠ ${bold(pullRequest.author.login)} is not an account fully supported for takeover.`);
            Log.warn(`   Supported accounts: ${bold(takeoverAccounts.join(', '))}`);
            if (await Prompt.confirm(`Continue with pull request takeover anyway?`, true)) {
                Log.debug('Continuing per user confirmation in prompt');
            }
            else {
                Log.info('Aborting takeover..');
                await resetGitState();
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
            `${getCommitMessageFilterScriptPath()} ${pr}`,
            `${pullRequest.baseRefOid}..HEAD`,
        ]);
        Log.info(` ${green('✔')} Checked out pull request #${pr} into branch: ${branchName}`);
        return;
    }
    Log.info(`Checked out the remote branch for pull request #${pr}\n`);
    Log.info('To push the checked out branch back to its PR, run the following command:');
    Log.info(`  $ ${pushToUpstreamCommand}`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hlY2tvdXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvY2hlY2tvdXQvY2hlY2tvdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFDbkMsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFDbkYsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQzdDLE9BQU8sRUFBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQ3hELE9BQU8sRUFBQywwQkFBMEIsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBQ3BFLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxLQUFLLENBQUM7QUFFbEMsd0RBQXdEO0FBQ3hELE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztBQU8zQyxNQUFNLENBQUMsS0FBSyxVQUFVLG1CQUFtQixDQUFDLE1BQWlDO0lBQ3pFLE1BQU0sRUFBQyxFQUFFLEVBQUUsUUFBUSxFQUFDLEdBQUcsTUFBTSxDQUFDO0lBQzlCLG1DQUFtQztJQUNuQyxNQUFNLEdBQUcsR0FBRyxNQUFNLHNCQUFzQixDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQy9DLG9EQUFvRDtJQUNwRCxNQUFNLFVBQVUsR0FBRyxlQUFlLEVBQUUsRUFBRSxDQUFDO0lBRXZDLDJDQUEyQztJQUMzQyxJQUFJLEdBQUcsQ0FBQyxxQkFBcUIsRUFBRSxFQUFFLENBQUM7UUFDaEMsR0FBRyxDQUFDLEtBQUssQ0FDUCwwRkFBMEYsQ0FDM0YsQ0FBQztRQUNGLE9BQU87SUFDVCxDQUFDO0lBRUQsTUFBTSxFQUFDLGFBQWEsRUFBRSxXQUFXLEVBQUUscUJBQXFCLEVBQUMsR0FBRyxNQUFNLDBCQUEwQixDQUFDLEVBQUUsRUFBRTtRQUMvRiw2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QzNDLENBQUM7QUFFRCx1RUFBdUU7QUFDdkUsU0FBUyxnQ0FBZ0M7SUFDdkMsb0ZBQW9GO0lBQ3BGLG1GQUFtRjtJQUNuRiw0REFBNEQ7SUFDNUQsMEZBQTBGO0lBQzFGLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzNELE9BQU8sSUFBSSxDQUFDLFVBQVUsRUFBRSx5Q0FBeUMsQ0FBQyxDQUFDO0FBQ3JFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge2Rpcm5hbWUsIGpvaW59IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtBdXRoZW50aWNhdGVkR2l0Q2xpZW50fSBmcm9tICcuLi8uLi91dGlscy9naXQvYXV0aGVudGljYXRlZC1naXQtY2xpZW50LmpzJztcbmltcG9ydCB7UHJvbXB0fSBmcm9tICcuLi8uLi91dGlscy9wcm9tcHQuanMnO1xuaW1wb3J0IHtMb2csIGJvbGQsIGdyZWVufSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7Y2hlY2tPdXRQdWxsUmVxdWVzdExvY2FsbHl9IGZyb20gJy4uL2NvbW1vbi9jaGVja291dC1wci5qcyc7XG5pbXBvcnQge2ZpbGVVUkxUb1BhdGh9IGZyb20gJ3VybCc7XG5cbi8qKiBMaXN0IG9mIGFjY291bnRzIHRoYXQgYXJlIHN1cHBvcnRlZCBmb3IgdGFrZW92ZXIuICovXG5jb25zdCB0YWtlb3ZlckFjY291bnRzID0gWydhbmd1bGFyLXJvYm90J107XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2hlY2tvdXRQdWxsUmVxdWVzdFBhcmFtcyB7XG4gIHByOiBudW1iZXI7XG4gIHRha2VvdmVyPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNoZWNrb3V0UHVsbFJlcXVlc3QocGFyYW1zOiBDaGVja291dFB1bGxSZXF1ZXN0UGFyYW1zKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHtwciwgdGFrZW92ZXJ9ID0gcGFyYW1zO1xuICAvKiogQW4gYXV0aGVudGljYXRlZCBnaXQgY2xpZW50LiAqL1xuICBjb25zdCBnaXQgPSBhd2FpdCBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LmdldCgpO1xuICAvKiogVGhlIGJyYW5jaCBuYW1lIHVzZWQgZm9yIHRoZSB0YWtlb3ZlciBjaGFuZ2UuICovXG4gIGNvbnN0IGJyYW5jaE5hbWUgPSBgcHItdGFrZW92ZXItJHtwcn1gO1xuXG4gIC8vIE1ha2Ugc3VyZSB0aGUgbG9jYWwgcmVwb3NpdG9yeSBpcyBjbGVhbi5cbiAgaWYgKGdpdC5oYXNVbmNvbW1pdHRlZENoYW5nZXMoKSkge1xuICAgIExvZy5lcnJvcihcbiAgICAgIGAg4pyYIExvY2FsIHdvcmtpbmcgcmVwb3NpdG9yeSBub3QgY2xlYW4uIFBsZWFzZSBtYWtlIHN1cmUgdGhlcmUgYXJlIG5vIHVuY29tbWl0dGVkIGNoYW5nZXNgLFxuICAgICk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3Qge3Jlc2V0R2l0U3RhdGUsIHB1bGxSZXF1ZXN0LCBwdXNoVG9VcHN0cmVhbUNvbW1hbmR9ID0gYXdhaXQgY2hlY2tPdXRQdWxsUmVxdWVzdExvY2FsbHkocHIsIHtcbiAgICBhbGxvd0lmTWFpbnRhaW5lckNhbm5vdE1vZGlmeTogdHJ1ZSxcbiAgfSk7XG5cbiAgLy8gaWYgbWFpbnRhaW5lciBjYW4gbW9kaWZ5IGlzIGZhbHNlIG9yIGlmIHRha2VvdmVyIGlzIHByb3ZpZGVkIGRvIHRha2VvdmVyXG5cbiAgaWYgKHB1bGxSZXF1ZXN0Lm1haW50YWluZXJDYW5Nb2RpZnkgPT09IGZhbHNlIHx8IHRha2VvdmVyKSB7XG4gICAgaWYgKHRha2VvdmVyICE9PSB0cnVlKSB7XG4gICAgICBMb2cuaW5mbygnVGhlIGF1dGhvciBvZiB0aGlzIHB1bGwgcmVxdWVzdCBkb2VzIG5vdCBhbGxvdyBtYWludGFpbmVycyB0byBtb2RpZnkgdGhlIHB1bGwnKTtcbiAgICAgIExvZy5pbmZvKCdyZXF1ZXN0LiBTaW5jZSB5b3Ugd2lsbCBub3QgYmUgYWJsZSB0byBwdXNoIGNoYW5nZXMgdG8gdGhlIG9yaWdpbmFsIHB1bGwgcmVxdWVzdCcpO1xuICAgICAgTG9nLmluZm8oJ3lvdSB3aWxsIGluc3RlYWQgbmVlZCB0byBwZXJmb3JtIGEgXCJ0YWtlb3Zlci5cIiBJbiBhIHRha2VvdmVyIHRoZSBvcmlnaW5hbCBwdWxsJyk7XG4gICAgICBMb2cuaW5mbygncmVxdWVzdCB3aWxsIGJlIGNoZWNrZWQgb3V0LCB0aGUgY29tbWl0cyBhcmUgbW9kaWZpZWQgdG8gY2xvc2UgdGhlIG9yaWdpbmFsIG9uJyk7XG4gICAgICBMb2cuaW5mbygnbWVyZ2Ugb2YgdGhlIG5ld2x5IGNyZWF0ZWQgYnJhbmNoLlxcbicpO1xuXG4gICAgICBpZiAoIShhd2FpdCBQcm9tcHQuY29uZmlybShgV291bGQgeW91IGxpa2UgdG8gY3JlYXRlIGEgdGFrZW92ZXIgcHVsbCByZXF1ZXN0P2AsIHRydWUpKSkge1xuICAgICAgICBMb2cuaW5mbygnQWJvcnRpbmcgdGFrZW92ZXIuLicpO1xuICAgICAgICBhd2FpdCByZXNldEdpdFN0YXRlKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZ2l0LnJ1bkdyYWNlZnVsKFsncmV2LXBhcnNlJywgJy1xJywgJy0tdmVyaWZ5JywgYnJhbmNoTmFtZV0pLnN0YXR1cyA9PT0gMCkge1xuICAgICAgTG9nLmVycm9yKGAg4pyYIEV4cGVjdGVkIGJyYW5jaCBuYW1lIFxcYCR7YnJhbmNoTmFtZX1cXGAgYWxyZWFkeSBleGlzdHMgbG9jYWxseWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIENvbmZpcm0gdGhhdCB0aGUgdGFrZW92ZXIgcmVxdWVzdCBpcyBiZWluZyBkb25lIG9uIGEgdmFsaWQgcHVsbCByZXF1ZXN0LlxuICAgIGlmICghdGFrZW92ZXJBY2NvdW50cy5pbmNsdWRlcyhwdWxsUmVxdWVzdC5hdXRob3IubG9naW4pKSB7XG4gICAgICBMb2cud2FybihcbiAgICAgICAgYCDimqAgJHtib2xkKHB1bGxSZXF1ZXN0LmF1dGhvci5sb2dpbil9IGlzIG5vdCBhbiBhY2NvdW50IGZ1bGx5IHN1cHBvcnRlZCBmb3IgdGFrZW92ZXIuYCxcbiAgICAgICk7XG4gICAgICBMb2cud2FybihgICAgU3VwcG9ydGVkIGFjY291bnRzOiAke2JvbGQodGFrZW92ZXJBY2NvdW50cy5qb2luKCcsICcpKX1gKTtcbiAgICAgIGlmIChhd2FpdCBQcm9tcHQuY29uZmlybShgQ29udGludWUgd2l0aCBwdWxsIHJlcXVlc3QgdGFrZW92ZXIgYW55d2F5P2AsIHRydWUpKSB7XG4gICAgICAgIExvZy5kZWJ1ZygnQ29udGludWluZyBwZXIgdXNlciBjb25maXJtYXRpb24gaW4gcHJvbXB0Jyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBMb2cuaW5mbygnQWJvcnRpbmcgdGFrZW92ZXIuLicpO1xuICAgICAgICBhd2FpdCByZXNldEdpdFN0YXRlKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBMb2cuaW5mbyhgU2V0dGluZyBsb2NhbCBicmFuY2ggbmFtZSBiYXNlZCBvbiB0aGUgcHVsbCByZXF1ZXN0YCk7XG4gICAgZ2l0LnJ1bihbJ2NoZWNrb3V0JywgJy1xJywgJy1iJywgYnJhbmNoTmFtZV0pO1xuXG4gICAgTG9nLmluZm8oJ1VwZGF0aW5nIGNvbW1pdCBtZXNzYWdlcyB0byBjbG9zZSBwcmV2aW91cyBwdWxsIHJlcXVlc3QnKTtcbiAgICBnaXQucnVuKFtcbiAgICAgICdmaWx0ZXItYnJhbmNoJyxcbiAgICAgICctZicsXG4gICAgICAnLS1tc2ctZmlsdGVyJyxcbiAgICAgIGAke2dldENvbW1pdE1lc3NhZ2VGaWx0ZXJTY3JpcHRQYXRoKCl9ICR7cHJ9YCxcbiAgICAgIGAke3B1bGxSZXF1ZXN0LmJhc2VSZWZPaWR9Li5IRUFEYCxcbiAgICBdKTtcblxuICAgIExvZy5pbmZvKGAgJHtncmVlbign4pyUJyl9IENoZWNrZWQgb3V0IHB1bGwgcmVxdWVzdCAjJHtwcn0gaW50byBicmFuY2g6ICR7YnJhbmNoTmFtZX1gKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBMb2cuaW5mbyhgQ2hlY2tlZCBvdXQgdGhlIHJlbW90ZSBicmFuY2ggZm9yIHB1bGwgcmVxdWVzdCAjJHtwcn1cXG5gKTtcbiAgTG9nLmluZm8oJ1RvIHB1c2ggdGhlIGNoZWNrZWQgb3V0IGJyYW5jaCBiYWNrIHRvIGl0cyBQUiwgcnVuIHRoZSBmb2xsb3dpbmcgY29tbWFuZDonKTtcbiAgTG9nLmluZm8oYCAgJCAke3B1c2hUb1Vwc3RyZWFtQ29tbWFuZH1gKTtcbn1cblxuLyoqIEdldHMgdGhlIGFic29sdXRlIGZpbGUgcGF0aCB0byB0aGUgY29tbWl0LW1lc3NhZ2UgZmlsdGVyIHNjcmlwdC4gKi9cbmZ1bmN0aW9uIGdldENvbW1pdE1lc3NhZ2VGaWx0ZXJTY3JpcHRQYXRoKCk6IHN0cmluZyB7XG4gIC8vIFRoaXMgZmlsZSBpcyBnZXR0aW5nIGJ1bmRsZWQgYW5kIGVuZHMgdXAgaW4gYDxwa2ctcm9vdD4vYnVuZGxlcy88Y2h1bms+YC4gV2UgYWxzb1xuICAvLyBidW5kbGUgdGhlIGNvbW1pdC1tZXNzYWdlLWZpbHRlciBzY3JpcHQgYXMgYW5vdGhlciBlbnRyeS1wb2ludCBhbmQgY2FuIHJlZmVyZW5jZVxuICAvLyBpdCByZWxhdGl2ZWx5IGFzIHRoZSBwYXRoIGlzIHByZXNlcnZlZCBpbnNpZGUgYGJ1bmRsZXMvYC5cbiAgLy8gKk5vdGUqOiBSZWx5aW5nIG9uIHBhY2thZ2UgcmVzb2x1dGlvbiBpcyBwcm9ibGVtYXRpYyB3aXRoaW4gRVNNIGFuZCB3aXRoIGBsb2NhbC1kZXYuc2hgXG4gIGNvbnN0IGJ1bmRsZXNEaXIgPSBkaXJuYW1lKGZpbGVVUkxUb1BhdGgoaW1wb3J0Lm1ldGEudXJsKSk7XG4gIHJldHVybiBqb2luKGJ1bmRsZXNEaXIsICcuL3ByL2NoZWNrb3V0L2NvbW1pdC1tZXNzYWdlLWZpbHRlci5tanMnKTtcbn1cbiJdfQ==