import { dirname, join } from 'path';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { Log, bold, green } from '../../utils/logging.js';
import { checkOutPullRequestLocally } from '../common/checkout-pr.js';
import { fileURLToPath } from 'url';
import { ActiveReleaseTrains } from '../../release/versioning/active-release-trains.js';
import { getNextBranchName } from '../../release/versioning/version-branches.js';
import { addTokenToGitHttpsUrl } from '../../utils/git/github-urls.js';
import { Prompt } from '../../utils/prompt.js';
/** List of accounts that are supported for takeover. */
const takeoverAccounts = ['angular-robot'];
export async function checkoutPullRequest(params, config) {
    const { pr, takeover, target } = params;
    /** An authenticated git client. */
    const git = await AuthenticatedGitClient.get();
    if (takeover && target) {
        Log.error(` ✘ You cannot specify both takeover and target branch at the same time`);
        return;
    }
    // Make sure the local repository is clean.
    if (git.hasUncommittedChanges()) {
        Log.error(` ✘ Local working repository not clean. Please make sure there are no uncommitted changes`);
        return;
    }
    const { resetGitState, pullRequest, pushToUpstreamCommand } = await checkOutPullRequestLocally(pr, {
        allowIfMaintainerCannotModify: true,
    });
    if (!target) {
        const branchName = `pr-takeover-${pr}`;
        // if maintainer can modify is false or if takeover is provided do takeover
        if (pullRequest.maintainerCanModify === false || takeover) {
            if (takeover !== true) {
                Log.info('The author of this pull request does not allow maintainers to modify the pull');
                Log.info('request. Since you will not be able to push changes to the original pull request');
                Log.info('you will instead need to perform a "takeover." In a takeover the original pull');
                Log.info('request will be checked out, the commits are modified to close the original on');
                Log.info('merge of the newly created branch.\n');
                if (!(await Prompt.confirm({
                    message: `Would you like to create a takeover pull request?`,
                    default: true,
                }))) {
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
                if (await Prompt.confirm({
                    message: `Continue with pull request takeover anyway?`,
                    default: true,
                })) {
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
    else {
        const branchName = `pr-${target.toLowerCase().replaceAll(/[\W_]/gm, '-')}-${pr}`;
        const { owner, name: repo } = config.github;
        const activeReleaseTrains = await ActiveReleaseTrains.fetch({
            name: repo,
            owner: owner,
            nextBranchName: getNextBranchName(config.github),
            api: git.github,
        });
        let targetBranch = target;
        let targetName = target;
        if (target === 'patch' ||
            target === 'latest' ||
            activeReleaseTrains.latest.branchName === target) {
            targetName = 'patch';
            targetBranch = activeReleaseTrains.latest.branchName;
        }
        else if (target === 'main' ||
            target === 'next' ||
            target === 'minor' ||
            activeReleaseTrains.next.branchName === target) {
            targetName = 'main';
            targetBranch = activeReleaseTrains.next.branchName;
        }
        else if (activeReleaseTrains.releaseCandidate &&
            (target === 'rc' || activeReleaseTrains.releaseCandidate.branchName === target)) {
            targetName = 'rc';
            targetBranch = activeReleaseTrains.releaseCandidate.branchName;
        }
        Log.info(`Targeting '${targetBranch}' branch\n`);
        const baseRefUrl = addTokenToGitHttpsUrl(pullRequest.baseRef.repository.url, git.githubToken);
        git.run(['checkout', '-q', targetBranch]);
        git.run(['fetch', '-q', baseRefUrl, targetBranch, '--deepen=500']);
        git.run(['checkout', '-b', branchName]);
        Log.info(`Running cherry-pick\n`);
        try {
            const revisionRange = `${pullRequest.baseRefOid}..${pullRequest.headRefOid}`;
            git.run(['cherry-pick', revisionRange]);
            Log.info(`Cherry-pick is complete. You can now push to create a new pull request.`);
        }
        catch {
            Log.info(`Cherry-pick resulted in conflicts. Please resolve them manually and push to create your patch PR`);
            return;
        }
        return;
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hlY2tvdXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvY2hlY2tvdXQvY2hlY2tvdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFDbkMsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFDbkYsT0FBTyxFQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDeEQsT0FBTyxFQUFDLDBCQUEwQixFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFDcEUsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLEtBQUssQ0FBQztBQUNsQyxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxtREFBbUQsQ0FBQztBQUN0RixPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSw4Q0FBOEMsQ0FBQztBQUMvRSxPQUFPLEVBQUMscUJBQXFCLEVBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRSxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFFN0Msd0RBQXdEO0FBQ3hELE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztBQVEzQyxNQUFNLENBQUMsS0FBSyxVQUFVLG1CQUFtQixDQUN2QyxNQUFpQyxFQUNqQyxNQUEyQztJQUUzQyxNQUFNLEVBQUMsRUFBRSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUMsR0FBRyxNQUFNLENBQUM7SUFDdEMsbUNBQW1DO0lBQ25DLE1BQU0sR0FBRyxHQUFHLE1BQU0sc0JBQXNCLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFL0MsSUFBSSxRQUFRLElBQUksTUFBTSxFQUFFLENBQUM7UUFDdkIsR0FBRyxDQUFDLEtBQUssQ0FBQyx3RUFBd0UsQ0FBQyxDQUFDO1FBQ3BGLE9BQU87SUFDVCxDQUFDO0lB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QixDQUFDLENBQUM7UUFFbEMsSUFBSSxDQUFDO1lBQ0gsTUFBTSxhQUFhLEdBQUcsR0FBRyxXQUFXLENBQUMsVUFBVSxLQUFLLFdBQVcsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUM3RSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsYUFBYSxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUM7WUFDeEMsR0FBRyxDQUFDLElBQUksQ0FBQyx5RUFBeUUsQ0FBQyxDQUFDO1FBQ3RGLENBQUM7UUFBQyxNQUFNLENBQUM7WUFDUCxHQUFHLENBQUMsSUFBSSxDQUNOLGtHQUFrRyxDQUNuRyxDQUFDO1lBQ0YsT0FBTztRQUNULENBQUM7UUFFRCxPQUFPO0lBQ1QsQ0FBQztBQUNILENBQUM7QUFFRCx1RUFBdUU7QUFDdkUsU0FBUyxnQ0FBZ0M7SUFDdkMsb0ZBQW9GO0lBQ3BGLG1GQUFtRjtJQUNuRiw0REFBNEQ7SUFDNUQsMEZBQTBGO0lBQzFGLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzNELE9BQU8sSUFBSSxDQUFDLFVBQVUsRUFBRSx5Q0FBeUMsQ0FBQyxDQUFDO0FBQ3JFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0dpdGh1YkNvbmZpZywgTmdEZXZDb25maWd9IGZyb20gJy4uLy4uL3V0aWxzL2NvbmZpZy5qcyc7XG5pbXBvcnQge2Rpcm5hbWUsIGpvaW59IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtBdXRoZW50aWNhdGVkR2l0Q2xpZW50fSBmcm9tICcuLi8uLi91dGlscy9naXQvYXV0aGVudGljYXRlZC1naXQtY2xpZW50LmpzJztcbmltcG9ydCB7TG9nLCBib2xkLCBncmVlbn0gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge2NoZWNrT3V0UHVsbFJlcXVlc3RMb2NhbGx5fSBmcm9tICcuLi9jb21tb24vY2hlY2tvdXQtcHIuanMnO1xuaW1wb3J0IHtmaWxlVVJMVG9QYXRofSBmcm9tICd1cmwnO1xuaW1wb3J0IHtBY3RpdmVSZWxlYXNlVHJhaW5zfSBmcm9tICcuLi8uLi9yZWxlYXNlL3ZlcnNpb25pbmcvYWN0aXZlLXJlbGVhc2UtdHJhaW5zLmpzJztcbmltcG9ydCB7Z2V0TmV4dEJyYW5jaE5hbWV9IGZyb20gJy4uLy4uL3JlbGVhc2UvdmVyc2lvbmluZy92ZXJzaW9uLWJyYW5jaGVzLmpzJztcbmltcG9ydCB7YWRkVG9rZW5Ub0dpdEh0dHBzVXJsfSBmcm9tICcuLi8uLi91dGlscy9naXQvZ2l0aHViLXVybHMuanMnO1xuaW1wb3J0IHtQcm9tcHR9IGZyb20gJy4uLy4uL3V0aWxzL3Byb21wdC5qcyc7XG5cbi8qKiBMaXN0IG9mIGFjY291bnRzIHRoYXQgYXJlIHN1cHBvcnRlZCBmb3IgdGFrZW92ZXIuICovXG5jb25zdCB0YWtlb3ZlckFjY291bnRzID0gWydhbmd1bGFyLXJvYm90J107XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2hlY2tvdXRQdWxsUmVxdWVzdFBhcmFtcyB7XG4gIHByOiBudW1iZXI7XG4gIHRha2VvdmVyPzogYm9vbGVhbjtcbiAgdGFyZ2V0Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2hlY2tvdXRQdWxsUmVxdWVzdChcbiAgcGFyYW1zOiBDaGVja291dFB1bGxSZXF1ZXN0UGFyYW1zLFxuICBjb25maWc6IE5nRGV2Q29uZmlnPHtnaXRodWI6IEdpdGh1YkNvbmZpZ30+LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHtwciwgdGFrZW92ZXIsIHRhcmdldH0gPSBwYXJhbXM7XG4gIC8qKiBBbiBhdXRoZW50aWNhdGVkIGdpdCBjbGllbnQuICovXG4gIGNvbnN0IGdpdCA9IGF3YWl0IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQuZ2V0KCk7XG5cbiAgaWYgKHRha2VvdmVyICYmIHRhcmdldCkge1xuICAgIExvZy5lcnJvcihgIOKcmCBZb3UgY2Fubm90IHNwZWNpZnkgYm90aCB0YWtlb3ZlciBhbmQgdGFyZ2V0IGJyYW5jaCBhdCB0aGUgc2FtZSB0aW1lYCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gTWFrZSBzdXJlIHRoZSBsb2NhbCByZXBvc2l0b3J5IGlzIGNsZWFuLlxuICBpZiAoZ2l0Lmhhc1VuY29tbWl0dGVkQ2hhbmdlcygpKSB7XG4gICAgTG9nLmVycm9yKFxuICAgICAgYCDinJggTG9jYWwgd29ya2luZyByZXBvc2l0b3J5IG5vdCBjbGVhbi4gUGxlYXNlIG1ha2Ugc3VyZSB0aGVyZSBhcmUgbm8gdW5jb21taXR0ZWQgY2hhbmdlc2AsXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB7cmVzZXRHaXRTdGF0ZSwgcHVsbFJlcXVlc3QsIHB1c2hUb1Vwc3RyZWFtQ29tbWFuZH0gPSBhd2FpdCBjaGVja091dFB1bGxSZXF1ZXN0TG9jYWxseShwciwge1xuICAgIGFsbG93SWZNYWludGFpbmVyQ2Fubm90TW9kaWZ5OiB0cnVlLFxuICB9KTtcblxuICBpZiAoIXRhcmdldCkge1xuICAgIGNvbnN0IGJyYW5jaE5hbWUgPSBgcHItdGFrZW92ZXItJHtwcn1gO1xuICAgIC8vIGlmIG1haW50YWluZXIgY2FuIG1vZGlmeSBpcyBmYWxzZSBvciBpZiB0YWtlb3ZlciBpcyBwcm92aWRlZCBkbyB0YWtlb3ZlclxuXG4gICAgaWYgKHB1bGxSZXF1ZXN0Lm1haW50YWluZXJDYW5Nb2RpZnkgPT09IGZhbHNlIHx8IHRha2VvdmVyKSB7XG4gICAgICBpZiAodGFrZW92ZXIgIT09IHRydWUpIHtcbiAgICAgICAgTG9nLmluZm8oJ1RoZSBhdXRob3Igb2YgdGhpcyBwdWxsIHJlcXVlc3QgZG9lcyBub3QgYWxsb3cgbWFpbnRhaW5lcnMgdG8gbW9kaWZ5IHRoZSBwdWxsJyk7XG4gICAgICAgIExvZy5pbmZvKFxuICAgICAgICAgICdyZXF1ZXN0LiBTaW5jZSB5b3Ugd2lsbCBub3QgYmUgYWJsZSB0byBwdXNoIGNoYW5nZXMgdG8gdGhlIG9yaWdpbmFsIHB1bGwgcmVxdWVzdCcsXG4gICAgICAgICk7XG4gICAgICAgIExvZy5pbmZvKCd5b3Ugd2lsbCBpbnN0ZWFkIG5lZWQgdG8gcGVyZm9ybSBhIFwidGFrZW92ZXIuXCIgSW4gYSB0YWtlb3ZlciB0aGUgb3JpZ2luYWwgcHVsbCcpO1xuICAgICAgICBMb2cuaW5mbygncmVxdWVzdCB3aWxsIGJlIGNoZWNrZWQgb3V0LCB0aGUgY29tbWl0cyBhcmUgbW9kaWZpZWQgdG8gY2xvc2UgdGhlIG9yaWdpbmFsIG9uJyk7XG4gICAgICAgIExvZy5pbmZvKCdtZXJnZSBvZiB0aGUgbmV3bHkgY3JlYXRlZCBicmFuY2guXFxuJyk7XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICEoYXdhaXQgUHJvbXB0LmNvbmZpcm0oe1xuICAgICAgICAgICAgbWVzc2FnZTogYFdvdWxkIHlvdSBsaWtlIHRvIGNyZWF0ZSBhIHRha2VvdmVyIHB1bGwgcmVxdWVzdD9gLFxuICAgICAgICAgICAgZGVmYXVsdDogdHJ1ZSxcbiAgICAgICAgICB9KSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgTG9nLmluZm8oJ0Fib3J0aW5nIHRha2VvdmVyLi4nKTtcbiAgICAgICAgICBhd2FpdCByZXNldEdpdFN0YXRlKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChnaXQucnVuR3JhY2VmdWwoWydyZXYtcGFyc2UnLCAnLXEnLCAnLS12ZXJpZnknLCBicmFuY2hOYW1lXSkuc3RhdHVzID09PSAwKSB7XG4gICAgICAgIExvZy5lcnJvcihgIOKcmCBFeHBlY3RlZCBicmFuY2ggbmFtZSBcXGAke2JyYW5jaE5hbWV9XFxgIGFscmVhZHkgZXhpc3RzIGxvY2FsbHlgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBDb25maXJtIHRoYXQgdGhlIHRha2VvdmVyIHJlcXVlc3QgaXMgYmVpbmcgZG9uZSBvbiBhIHZhbGlkIHB1bGwgcmVxdWVzdC5cbiAgICAgIGlmICghdGFrZW92ZXJBY2NvdW50cy5pbmNsdWRlcyhwdWxsUmVxdWVzdC5hdXRob3IubG9naW4pKSB7XG4gICAgICAgIExvZy53YXJuKFxuICAgICAgICAgIGAg4pqgICR7Ym9sZChwdWxsUmVxdWVzdC5hdXRob3IubG9naW4pfSBpcyBub3QgYW4gYWNjb3VudCBmdWxseSBzdXBwb3J0ZWQgZm9yIHRha2VvdmVyLmAsXG4gICAgICAgICk7XG4gICAgICAgIExvZy53YXJuKGAgICBTdXBwb3J0ZWQgYWNjb3VudHM6ICR7Ym9sZCh0YWtlb3ZlckFjY291bnRzLmpvaW4oJywgJykpfWApO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgYXdhaXQgUHJvbXB0LmNvbmZpcm0oe1xuICAgICAgICAgICAgbWVzc2FnZTogYENvbnRpbnVlIHdpdGggcHVsbCByZXF1ZXN0IHRha2VvdmVyIGFueXdheT9gLFxuICAgICAgICAgICAgZGVmYXVsdDogdHJ1ZSxcbiAgICAgICAgICB9KVxuICAgICAgICApIHtcbiAgICAgICAgICBMb2cuZGVidWcoJ0NvbnRpbnVpbmcgcGVyIHVzZXIgY29uZmlybWF0aW9uIGluIHByb21wdCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIExvZy5pbmZvKCdBYm9ydGluZyB0YWtlb3Zlci4uJyk7XG4gICAgICAgICAgYXdhaXQgcmVzZXRHaXRTdGF0ZSgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBMb2cuaW5mbyhgU2V0dGluZyBsb2NhbCBicmFuY2ggbmFtZSBiYXNlZCBvbiB0aGUgcHVsbCByZXF1ZXN0YCk7XG4gICAgICBnaXQucnVuKFsnY2hlY2tvdXQnLCAnLXEnLCAnLWInLCBicmFuY2hOYW1lXSk7XG5cbiAgICAgIExvZy5pbmZvKCdVcGRhdGluZyBjb21taXQgbWVzc2FnZXMgdG8gY2xvc2UgcHJldmlvdXMgcHVsbCByZXF1ZXN0Jyk7XG4gICAgICBnaXQucnVuKFtcbiAgICAgICAgJ2ZpbHRlci1icmFuY2gnLFxuICAgICAgICAnLWYnLFxuICAgICAgICAnLS1tc2ctZmlsdGVyJyxcbiAgICAgICAgYCR7Z2V0Q29tbWl0TWVzc2FnZUZpbHRlclNjcmlwdFBhdGgoKX0gJHtwcn1gLFxuICAgICAgICBgJHtwdWxsUmVxdWVzdC5iYXNlUmVmT2lkfS4uSEVBRGAsXG4gICAgICBdKTtcblxuICAgICAgTG9nLmluZm8oYCAke2dyZWVuKCfinJQnKX0gQ2hlY2tlZCBvdXQgcHVsbCByZXF1ZXN0ICMke3ByfSBpbnRvIGJyYW5jaDogJHticmFuY2hOYW1lfWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIExvZy5pbmZvKGBDaGVja2VkIG91dCB0aGUgcmVtb3RlIGJyYW5jaCBmb3IgcHVsbCByZXF1ZXN0ICMke3ByfVxcbmApO1xuICAgIExvZy5pbmZvKCdUbyBwdXNoIHRoZSBjaGVja2VkIG91dCBicmFuY2ggYmFjayB0byBpdHMgUFIsIHJ1biB0aGUgZm9sbG93aW5nIGNvbW1hbmQ6Jyk7XG4gICAgTG9nLmluZm8oYCAgJCAke3B1c2hUb1Vwc3RyZWFtQ29tbWFuZH1gKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBicmFuY2hOYW1lID0gYHByLSR7dGFyZ2V0LnRvTG93ZXJDYXNlKCkucmVwbGFjZUFsbCgvW1xcV19dL2dtLCAnLScpfS0ke3ByfWA7XG4gICAgY29uc3Qge293bmVyLCBuYW1lOiByZXBvfSA9IGNvbmZpZy5naXRodWI7XG4gICAgY29uc3QgYWN0aXZlUmVsZWFzZVRyYWlucyA9IGF3YWl0IEFjdGl2ZVJlbGVhc2VUcmFpbnMuZmV0Y2goe1xuICAgICAgbmFtZTogcmVwbyxcbiAgICAgIG93bmVyOiBvd25lcixcbiAgICAgIG5leHRCcmFuY2hOYW1lOiBnZXROZXh0QnJhbmNoTmFtZShjb25maWcuZ2l0aHViKSxcbiAgICAgIGFwaTogZ2l0LmdpdGh1YixcbiAgICB9KTtcblxuICAgIGxldCB0YXJnZXRCcmFuY2ggPSB0YXJnZXQ7XG4gICAgbGV0IHRhcmdldE5hbWUgPSB0YXJnZXQ7XG5cbiAgICBpZiAoXG4gICAgICB0YXJnZXQgPT09ICdwYXRjaCcgfHxcbiAgICAgIHRhcmdldCA9PT0gJ2xhdGVzdCcgfHxcbiAgICAgIGFjdGl2ZVJlbGVhc2VUcmFpbnMubGF0ZXN0LmJyYW5jaE5hbWUgPT09IHRhcmdldFxuICAgICkge1xuICAgICAgdGFyZ2V0TmFtZSA9ICdwYXRjaCc7XG4gICAgICB0YXJnZXRCcmFuY2ggPSBhY3RpdmVSZWxlYXNlVHJhaW5zLmxhdGVzdC5icmFuY2hOYW1lO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICB0YXJnZXQgPT09ICdtYWluJyB8fFxuICAgICAgdGFyZ2V0ID09PSAnbmV4dCcgfHxcbiAgICAgIHRhcmdldCA9PT0gJ21pbm9yJyB8fFxuICAgICAgYWN0aXZlUmVsZWFzZVRyYWlucy5uZXh0LmJyYW5jaE5hbWUgPT09IHRhcmdldFxuICAgICkge1xuICAgICAgdGFyZ2V0TmFtZSA9ICdtYWluJztcbiAgICAgIHRhcmdldEJyYW5jaCA9IGFjdGl2ZVJlbGVhc2VUcmFpbnMubmV4dC5icmFuY2hOYW1lO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICBhY3RpdmVSZWxlYXNlVHJhaW5zLnJlbGVhc2VDYW5kaWRhdGUgJiZcbiAgICAgICh0YXJnZXQgPT09ICdyYycgfHwgYWN0aXZlUmVsZWFzZVRyYWlucy5yZWxlYXNlQ2FuZGlkYXRlLmJyYW5jaE5hbWUgPT09IHRhcmdldClcbiAgICApIHtcbiAgICAgIHRhcmdldE5hbWUgPSAncmMnO1xuICAgICAgdGFyZ2V0QnJhbmNoID0gYWN0aXZlUmVsZWFzZVRyYWlucy5yZWxlYXNlQ2FuZGlkYXRlLmJyYW5jaE5hbWU7XG4gICAgfVxuICAgIExvZy5pbmZvKGBUYXJnZXRpbmcgJyR7dGFyZ2V0QnJhbmNofScgYnJhbmNoXFxuYCk7XG5cbiAgICBjb25zdCBiYXNlUmVmVXJsID0gYWRkVG9rZW5Ub0dpdEh0dHBzVXJsKHB1bGxSZXF1ZXN0LmJhc2VSZWYucmVwb3NpdG9yeS51cmwsIGdpdC5naXRodWJUb2tlbik7XG5cbiAgICBnaXQucnVuKFsnY2hlY2tvdXQnLCAnLXEnLCB0YXJnZXRCcmFuY2hdKTtcbiAgICBnaXQucnVuKFsnZmV0Y2gnLCAnLXEnLCBiYXNlUmVmVXJsLCB0YXJnZXRCcmFuY2gsICctLWRlZXBlbj01MDAnXSk7XG4gICAgZ2l0LnJ1bihbJ2NoZWNrb3V0JywgJy1iJywgYnJhbmNoTmFtZV0pO1xuXG4gICAgTG9nLmluZm8oYFJ1bm5pbmcgY2hlcnJ5LXBpY2tcXG5gKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXZpc2lvblJhbmdlID0gYCR7cHVsbFJlcXVlc3QuYmFzZVJlZk9pZH0uLiR7cHVsbFJlcXVlc3QuaGVhZFJlZk9pZH1gO1xuICAgICAgZ2l0LnJ1bihbJ2NoZXJyeS1waWNrJywgcmV2aXNpb25SYW5nZV0pO1xuICAgICAgTG9nLmluZm8oYENoZXJyeS1waWNrIGlzIGNvbXBsZXRlLiBZb3UgY2FuIG5vdyBwdXNoIHRvIGNyZWF0ZSBhIG5ldyBwdWxsIHJlcXVlc3QuYCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICBMb2cuaW5mbyhcbiAgICAgICAgYENoZXJyeS1waWNrIHJlc3VsdGVkIGluIGNvbmZsaWN0cy4gUGxlYXNlIHJlc29sdmUgdGhlbSBtYW51YWxseSBhbmQgcHVzaCB0byBjcmVhdGUgeW91ciBwYXRjaCBQUmAsXG4gICAgICApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHJldHVybjtcbiAgfVxufVxuXG4vKiogR2V0cyB0aGUgYWJzb2x1dGUgZmlsZSBwYXRoIHRvIHRoZSBjb21taXQtbWVzc2FnZSBmaWx0ZXIgc2NyaXB0LiAqL1xuZnVuY3Rpb24gZ2V0Q29tbWl0TWVzc2FnZUZpbHRlclNjcmlwdFBhdGgoKTogc3RyaW5nIHtcbiAgLy8gVGhpcyBmaWxlIGlzIGdldHRpbmcgYnVuZGxlZCBhbmQgZW5kcyB1cCBpbiBgPHBrZy1yb290Pi9idW5kbGVzLzxjaHVuaz5gLiBXZSBhbHNvXG4gIC8vIGJ1bmRsZSB0aGUgY29tbWl0LW1lc3NhZ2UtZmlsdGVyIHNjcmlwdCBhcyBhbm90aGVyIGVudHJ5LXBvaW50IGFuZCBjYW4gcmVmZXJlbmNlXG4gIC8vIGl0IHJlbGF0aXZlbHkgYXMgdGhlIHBhdGggaXMgcHJlc2VydmVkIGluc2lkZSBgYnVuZGxlcy9gLlxuICAvLyAqTm90ZSo6IFJlbHlpbmcgb24gcGFja2FnZSByZXNvbHV0aW9uIGlzIHByb2JsZW1hdGljIHdpdGhpbiBFU00gYW5kIHdpdGggYGxvY2FsLWRldi5zaGBcbiAgY29uc3QgYnVuZGxlc0RpciA9IGRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKTtcbiAgcmV0dXJuIGpvaW4oYnVuZGxlc0RpciwgJy4vcHIvY2hlY2tvdXQvY29tbWl0LW1lc3NhZ2UtZmlsdGVyLm1qcycpO1xufVxuIl19