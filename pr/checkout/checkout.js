import { dirname, join } from 'path';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { Prompt } from '../../utils/prompt.js';
import { Log, bold, green } from '../../utils/logging.js';
import { checkOutPullRequestLocally } from '../common/checkout-pr.js';
import { fileURLToPath } from 'url';
import { ActiveReleaseTrains } from '../../release/versioning/active-release-trains.js';
import { getNextBranchName } from '../../release/versioning/version-branches.js';
import { addTokenToGitHttpsUrl } from '../../utils/git/github-urls.js';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hlY2tvdXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvY2hlY2tvdXQvY2hlY2tvdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFDbkMsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFDbkYsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQzdDLE9BQU8sRUFBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQ3hELE9BQU8sRUFBQywwQkFBMEIsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBQ3BFLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxLQUFLLENBQUM7QUFDbEMsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sbURBQW1ELENBQUM7QUFDdEYsT0FBTyxFQUFDLGlCQUFpQixFQUFDLE1BQU0sOENBQThDLENBQUM7QUFFL0UsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFFckUsd0RBQXdEO0FBQ3hELE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztBQVEzQyxNQUFNLENBQUMsS0FBSyxVQUFVLG1CQUFtQixDQUN2QyxNQUFpQyxFQUNqQyxNQUEyQztJQUUzQyxNQUFNLEVBQUMsRUFBRSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUMsR0FBRyxNQUFNLENBQUM7SUFDdEMsbUNBQW1DO0lBQ25DLE1BQU0sR0FBRyxHQUFHLE1BQU0sc0JBQXNCLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFL0MsSUFBSSxRQUFRLElBQUksTUFBTSxFQUFFLENBQUM7UUFDdkIsR0FBRyxDQUFDLEtBQUssQ0FBQyx3RUFBd0UsQ0FBQyxDQUFDO1FBQ3BGLE9BQU87SUFDVCxDQUFDO0lB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S0FBSyxXQUFXLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDN0UsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLGFBQWEsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDO1lBQ3hDLEdBQUcsQ0FBQyxJQUFJLENBQUMseUVBQXlFLENBQUMsQ0FBQztRQUN0RixDQUFDO1FBQUMsTUFBTSxDQUFDO1lBQ1AsR0FBRyxDQUFDLElBQUksQ0FDTixrR0FBa0csQ0FDbkcsQ0FBQztZQUNGLE9BQU87UUFDVCxDQUFDO1FBRUQsT0FBTztJQUNULENBQUM7QUFDSCxDQUFDO0FBRUQsdUVBQXVFO0FBQ3ZFLFNBQVMsZ0NBQWdDO0lBQ3ZDLG9GQUFvRjtJQUNwRixtRkFBbUY7SUFDbkYsNERBQTREO0lBQzVELDBGQUEwRjtJQUMxRixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUMzRCxPQUFPLElBQUksQ0FBQyxVQUFVLEVBQUUseUNBQXlDLENBQUMsQ0FBQztBQUNyRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtHaXRodWJDb25maWcsIE5nRGV2Q29uZmlnfSBmcm9tICcuLi8uLi91dGlscy9jb25maWcuanMnO1xuaW1wb3J0IHtkaXJuYW1lLCBqb2lufSBmcm9tICdwYXRoJztcbmltcG9ydCB7QXV0aGVudGljYXRlZEdpdENsaWVudH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2F1dGhlbnRpY2F0ZWQtZ2l0LWNsaWVudC5qcyc7XG5pbXBvcnQge1Byb21wdH0gZnJvbSAnLi4vLi4vdXRpbHMvcHJvbXB0LmpzJztcbmltcG9ydCB7TG9nLCBib2xkLCBncmVlbn0gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge2NoZWNrT3V0UHVsbFJlcXVlc3RMb2NhbGx5fSBmcm9tICcuLi9jb21tb24vY2hlY2tvdXQtcHIuanMnO1xuaW1wb3J0IHtmaWxlVVJMVG9QYXRofSBmcm9tICd1cmwnO1xuaW1wb3J0IHtBY3RpdmVSZWxlYXNlVHJhaW5zfSBmcm9tICcuLi8uLi9yZWxlYXNlL3ZlcnNpb25pbmcvYWN0aXZlLXJlbGVhc2UtdHJhaW5zLmpzJztcbmltcG9ydCB7Z2V0TmV4dEJyYW5jaE5hbWV9IGZyb20gJy4uLy4uL3JlbGVhc2UvdmVyc2lvbmluZy92ZXJzaW9uLWJyYW5jaGVzLmpzJztcbmltcG9ydCB7ZmV0Y2hQdWxsUmVxdWVzdEZyb21HaXRodWJ9IGZyb20gJy4uL2NvbW1vbi9mZXRjaC1wdWxsLXJlcXVlc3QuanMnO1xuaW1wb3J0IHthZGRUb2tlblRvR2l0SHR0cHNVcmx9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9naXRodWItdXJscy5qcyc7XG5cbi8qKiBMaXN0IG9mIGFjY291bnRzIHRoYXQgYXJlIHN1cHBvcnRlZCBmb3IgdGFrZW92ZXIuICovXG5jb25zdCB0YWtlb3ZlckFjY291bnRzID0gWydhbmd1bGFyLXJvYm90J107XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2hlY2tvdXRQdWxsUmVxdWVzdFBhcmFtcyB7XG4gIHByOiBudW1iZXI7XG4gIHRha2VvdmVyPzogYm9vbGVhbjtcbiAgdGFyZ2V0Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2hlY2tvdXRQdWxsUmVxdWVzdChcbiAgcGFyYW1zOiBDaGVja291dFB1bGxSZXF1ZXN0UGFyYW1zLFxuICBjb25maWc6IE5nRGV2Q29uZmlnPHtnaXRodWI6IEdpdGh1YkNvbmZpZ30+LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHtwciwgdGFrZW92ZXIsIHRhcmdldH0gPSBwYXJhbXM7XG4gIC8qKiBBbiBhdXRoZW50aWNhdGVkIGdpdCBjbGllbnQuICovXG4gIGNvbnN0IGdpdCA9IGF3YWl0IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQuZ2V0KCk7XG5cbiAgaWYgKHRha2VvdmVyICYmIHRhcmdldCkge1xuICAgIExvZy5lcnJvcihgIOKcmCBZb3UgY2Fubm90IHNwZWNpZnkgYm90aCB0YWtlb3ZlciBhbmQgdGFyZ2V0IGJyYW5jaCBhdCB0aGUgc2FtZSB0aW1lYCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gTWFrZSBzdXJlIHRoZSBsb2NhbCByZXBvc2l0b3J5IGlzIGNsZWFuLlxuICBpZiAoZ2l0Lmhhc1VuY29tbWl0dGVkQ2hhbmdlcygpKSB7XG4gICAgTG9nLmVycm9yKFxuICAgICAgYCDinJggTG9jYWwgd29ya2luZyByZXBvc2l0b3J5IG5vdCBjbGVhbi4gUGxlYXNlIG1ha2Ugc3VyZSB0aGVyZSBhcmUgbm8gdW5jb21taXR0ZWQgY2hhbmdlc2AsXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB7cmVzZXRHaXRTdGF0ZSwgcHVsbFJlcXVlc3QsIHB1c2hUb1Vwc3RyZWFtQ29tbWFuZH0gPSBhd2FpdCBjaGVja091dFB1bGxSZXF1ZXN0TG9jYWxseShwciwge1xuICAgIGFsbG93SWZNYWludGFpbmVyQ2Fubm90TW9kaWZ5OiB0cnVlLFxuICB9KTtcblxuICBpZiAoIXRhcmdldCkge1xuICAgIGNvbnN0IGJyYW5jaE5hbWUgPSBgcHItdGFrZW92ZXItJHtwcn1gO1xuICAgIC8vIGlmIG1haW50YWluZXIgY2FuIG1vZGlmeSBpcyBmYWxzZSBvciBpZiB0YWtlb3ZlciBpcyBwcm92aWRlZCBkbyB0YWtlb3ZlclxuXG4gICAgaWYgKHB1bGxSZXF1ZXN0Lm1haW50YWluZXJDYW5Nb2RpZnkgPT09IGZhbHNlIHx8IHRha2VvdmVyKSB7XG4gICAgICBpZiAodGFrZW92ZXIgIT09IHRydWUpIHtcbiAgICAgICAgTG9nLmluZm8oJ1RoZSBhdXRob3Igb2YgdGhpcyBwdWxsIHJlcXVlc3QgZG9lcyBub3QgYWxsb3cgbWFpbnRhaW5lcnMgdG8gbW9kaWZ5IHRoZSBwdWxsJyk7XG4gICAgICAgIExvZy5pbmZvKFxuICAgICAgICAgICdyZXF1ZXN0LiBTaW5jZSB5b3Ugd2lsbCBub3QgYmUgYWJsZSB0byBwdXNoIGNoYW5nZXMgdG8gdGhlIG9yaWdpbmFsIHB1bGwgcmVxdWVzdCcsXG4gICAgICAgICk7XG4gICAgICAgIExvZy5pbmZvKCd5b3Ugd2lsbCBpbnN0ZWFkIG5lZWQgdG8gcGVyZm9ybSBhIFwidGFrZW92ZXIuXCIgSW4gYSB0YWtlb3ZlciB0aGUgb3JpZ2luYWwgcHVsbCcpO1xuICAgICAgICBMb2cuaW5mbygncmVxdWVzdCB3aWxsIGJlIGNoZWNrZWQgb3V0LCB0aGUgY29tbWl0cyBhcmUgbW9kaWZpZWQgdG8gY2xvc2UgdGhlIG9yaWdpbmFsIG9uJyk7XG4gICAgICAgIExvZy5pbmZvKCdtZXJnZSBvZiB0aGUgbmV3bHkgY3JlYXRlZCBicmFuY2guXFxuJyk7XG5cbiAgICAgICAgaWYgKCEoYXdhaXQgUHJvbXB0LmNvbmZpcm0oYFdvdWxkIHlvdSBsaWtlIHRvIGNyZWF0ZSBhIHRha2VvdmVyIHB1bGwgcmVxdWVzdD9gLCB0cnVlKSkpIHtcbiAgICAgICAgICBMb2cuaW5mbygnQWJvcnRpbmcgdGFrZW92ZXIuLicpO1xuICAgICAgICAgIGF3YWl0IHJlc2V0R2l0U3RhdGUoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGdpdC5ydW5HcmFjZWZ1bChbJ3Jldi1wYXJzZScsICctcScsICctLXZlcmlmeScsIGJyYW5jaE5hbWVdKS5zdGF0dXMgPT09IDApIHtcbiAgICAgICAgTG9nLmVycm9yKGAg4pyYIEV4cGVjdGVkIGJyYW5jaCBuYW1lIFxcYCR7YnJhbmNoTmFtZX1cXGAgYWxyZWFkeSBleGlzdHMgbG9jYWxseWApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIENvbmZpcm0gdGhhdCB0aGUgdGFrZW92ZXIgcmVxdWVzdCBpcyBiZWluZyBkb25lIG9uIGEgdmFsaWQgcHVsbCByZXF1ZXN0LlxuICAgICAgaWYgKCF0YWtlb3ZlckFjY291bnRzLmluY2x1ZGVzKHB1bGxSZXF1ZXN0LmF1dGhvci5sb2dpbikpIHtcbiAgICAgICAgTG9nLndhcm4oXG4gICAgICAgICAgYCDimqAgJHtib2xkKHB1bGxSZXF1ZXN0LmF1dGhvci5sb2dpbil9IGlzIG5vdCBhbiBhY2NvdW50IGZ1bGx5IHN1cHBvcnRlZCBmb3IgdGFrZW92ZXIuYCxcbiAgICAgICAgKTtcbiAgICAgICAgTG9nLndhcm4oYCAgIFN1cHBvcnRlZCBhY2NvdW50czogJHtib2xkKHRha2VvdmVyQWNjb3VudHMuam9pbignLCAnKSl9YCk7XG4gICAgICAgIGlmIChhd2FpdCBQcm9tcHQuY29uZmlybShgQ29udGludWUgd2l0aCBwdWxsIHJlcXVlc3QgdGFrZW92ZXIgYW55d2F5P2AsIHRydWUpKSB7XG4gICAgICAgICAgTG9nLmRlYnVnKCdDb250aW51aW5nIHBlciB1c2VyIGNvbmZpcm1hdGlvbiBpbiBwcm9tcHQnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBMb2cuaW5mbygnQWJvcnRpbmcgdGFrZW92ZXIuLicpO1xuICAgICAgICAgIGF3YWl0IHJlc2V0R2l0U3RhdGUoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgTG9nLmluZm8oYFNldHRpbmcgbG9jYWwgYnJhbmNoIG5hbWUgYmFzZWQgb24gdGhlIHB1bGwgcmVxdWVzdGApO1xuICAgICAgZ2l0LnJ1bihbJ2NoZWNrb3V0JywgJy1xJywgJy1iJywgYnJhbmNoTmFtZV0pO1xuXG4gICAgICBMb2cuaW5mbygnVXBkYXRpbmcgY29tbWl0IG1lc3NhZ2VzIHRvIGNsb3NlIHByZXZpb3VzIHB1bGwgcmVxdWVzdCcpO1xuICAgICAgZ2l0LnJ1bihbXG4gICAgICAgICdmaWx0ZXItYnJhbmNoJyxcbiAgICAgICAgJy1mJyxcbiAgICAgICAgJy0tbXNnLWZpbHRlcicsXG4gICAgICAgIGAke2dldENvbW1pdE1lc3NhZ2VGaWx0ZXJTY3JpcHRQYXRoKCl9ICR7cHJ9YCxcbiAgICAgICAgYCR7cHVsbFJlcXVlc3QuYmFzZVJlZk9pZH0uLkhFQURgLFxuICAgICAgXSk7XG5cbiAgICAgIExvZy5pbmZvKGAgJHtncmVlbign4pyUJyl9IENoZWNrZWQgb3V0IHB1bGwgcmVxdWVzdCAjJHtwcn0gaW50byBicmFuY2g6ICR7YnJhbmNoTmFtZX1gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBMb2cuaW5mbyhgQ2hlY2tlZCBvdXQgdGhlIHJlbW90ZSBicmFuY2ggZm9yIHB1bGwgcmVxdWVzdCAjJHtwcn1cXG5gKTtcbiAgICBMb2cuaW5mbygnVG8gcHVzaCB0aGUgY2hlY2tlZCBvdXQgYnJhbmNoIGJhY2sgdG8gaXRzIFBSLCBydW4gdGhlIGZvbGxvd2luZyBjb21tYW5kOicpO1xuICAgIExvZy5pbmZvKGAgICQgJHtwdXNoVG9VcHN0cmVhbUNvbW1hbmR9YCk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgYnJhbmNoTmFtZSA9IGBwci0ke3RhcmdldC50b0xvd2VyQ2FzZSgpLnJlcGxhY2VBbGwoL1tcXFdfXS9nbSwgJy0nKX0tJHtwcn1gO1xuICAgIGNvbnN0IHtvd25lciwgbmFtZTogcmVwb30gPSBjb25maWcuZ2l0aHViO1xuICAgIGNvbnN0IGFjdGl2ZVJlbGVhc2VUcmFpbnMgPSBhd2FpdCBBY3RpdmVSZWxlYXNlVHJhaW5zLmZldGNoKHtcbiAgICAgIG5hbWU6IHJlcG8sXG4gICAgICBvd25lcjogb3duZXIsXG4gICAgICBuZXh0QnJhbmNoTmFtZTogZ2V0TmV4dEJyYW5jaE5hbWUoY29uZmlnLmdpdGh1YiksXG4gICAgICBhcGk6IGdpdC5naXRodWIsXG4gICAgfSk7XG5cbiAgICBsZXQgdGFyZ2V0QnJhbmNoID0gdGFyZ2V0O1xuICAgIGxldCB0YXJnZXROYW1lID0gdGFyZ2V0O1xuXG4gICAgaWYgKFxuICAgICAgdGFyZ2V0ID09PSAncGF0Y2gnIHx8XG4gICAgICB0YXJnZXQgPT09ICdsYXRlc3QnIHx8XG4gICAgICBhY3RpdmVSZWxlYXNlVHJhaW5zLmxhdGVzdC5icmFuY2hOYW1lID09PSB0YXJnZXRcbiAgICApIHtcbiAgICAgIHRhcmdldE5hbWUgPSAncGF0Y2gnO1xuICAgICAgdGFyZ2V0QnJhbmNoID0gYWN0aXZlUmVsZWFzZVRyYWlucy5sYXRlc3QuYnJhbmNoTmFtZTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgdGFyZ2V0ID09PSAnbWFpbicgfHxcbiAgICAgIHRhcmdldCA9PT0gJ25leHQnIHx8XG4gICAgICB0YXJnZXQgPT09ICdtaW5vcicgfHxcbiAgICAgIGFjdGl2ZVJlbGVhc2VUcmFpbnMubmV4dC5icmFuY2hOYW1lID09PSB0YXJnZXRcbiAgICApIHtcbiAgICAgIHRhcmdldE5hbWUgPSAnbWFpbic7XG4gICAgICB0YXJnZXRCcmFuY2ggPSBhY3RpdmVSZWxlYXNlVHJhaW5zLm5leHQuYnJhbmNoTmFtZTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgYWN0aXZlUmVsZWFzZVRyYWlucy5yZWxlYXNlQ2FuZGlkYXRlICYmXG4gICAgICAodGFyZ2V0ID09PSAncmMnIHx8IGFjdGl2ZVJlbGVhc2VUcmFpbnMucmVsZWFzZUNhbmRpZGF0ZS5icmFuY2hOYW1lID09PSB0YXJnZXQpXG4gICAgKSB7XG4gICAgICB0YXJnZXROYW1lID0gJ3JjJztcbiAgICAgIHRhcmdldEJyYW5jaCA9IGFjdGl2ZVJlbGVhc2VUcmFpbnMucmVsZWFzZUNhbmRpZGF0ZS5icmFuY2hOYW1lO1xuICAgIH1cbiAgICBMb2cuaW5mbyhgVGFyZ2V0aW5nICcke3RhcmdldEJyYW5jaH0nIGJyYW5jaFxcbmApO1xuXG4gICAgY29uc3QgYmFzZVJlZlVybCA9IGFkZFRva2VuVG9HaXRIdHRwc1VybChwdWxsUmVxdWVzdC5iYXNlUmVmLnJlcG9zaXRvcnkudXJsLCBnaXQuZ2l0aHViVG9rZW4pO1xuXG4gICAgZ2l0LnJ1bihbJ2NoZWNrb3V0JywgJy1xJywgdGFyZ2V0QnJhbmNoXSk7XG4gICAgZ2l0LnJ1bihbJ2ZldGNoJywgJy1xJywgYmFzZVJlZlVybCwgdGFyZ2V0QnJhbmNoLCAnLS1kZWVwZW49NTAwJ10pO1xuICAgIGdpdC5ydW4oWydjaGVja291dCcsICctYicsIGJyYW5jaE5hbWVdKTtcblxuICAgIExvZy5pbmZvKGBSdW5uaW5nIGNoZXJyeS1waWNrXFxuYCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmV2aXNpb25SYW5nZSA9IGAke3B1bGxSZXF1ZXN0LmJhc2VSZWZPaWR9Li4ke3B1bGxSZXF1ZXN0LmhlYWRSZWZPaWR9YDtcbiAgICAgIGdpdC5ydW4oWydjaGVycnktcGljaycsIHJldmlzaW9uUmFuZ2VdKTtcbiAgICAgIExvZy5pbmZvKGBDaGVycnktcGljayBpcyBjb21wbGV0ZS4gWW91IGNhbiBub3cgcHVzaCB0byBjcmVhdGUgYSBuZXcgcHVsbCByZXF1ZXN0LmApO1xuICAgIH0gY2F0Y2gge1xuICAgICAgTG9nLmluZm8oXG4gICAgICAgIGBDaGVycnktcGljayByZXN1bHRlZCBpbiBjb25mbGljdHMuIFBsZWFzZSByZXNvbHZlIHRoZW0gbWFudWFsbHkgYW5kIHB1c2ggdG8gY3JlYXRlIHlvdXIgcGF0Y2ggUFJgLFxuICAgICAgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICByZXR1cm47XG4gIH1cbn1cblxuLyoqIEdldHMgdGhlIGFic29sdXRlIGZpbGUgcGF0aCB0byB0aGUgY29tbWl0LW1lc3NhZ2UgZmlsdGVyIHNjcmlwdC4gKi9cbmZ1bmN0aW9uIGdldENvbW1pdE1lc3NhZ2VGaWx0ZXJTY3JpcHRQYXRoKCk6IHN0cmluZyB7XG4gIC8vIFRoaXMgZmlsZSBpcyBnZXR0aW5nIGJ1bmRsZWQgYW5kIGVuZHMgdXAgaW4gYDxwa2ctcm9vdD4vYnVuZGxlcy88Y2h1bms+YC4gV2UgYWxzb1xuICAvLyBidW5kbGUgdGhlIGNvbW1pdC1tZXNzYWdlLWZpbHRlciBzY3JpcHQgYXMgYW5vdGhlciBlbnRyeS1wb2ludCBhbmQgY2FuIHJlZmVyZW5jZVxuICAvLyBpdCByZWxhdGl2ZWx5IGFzIHRoZSBwYXRoIGlzIHByZXNlcnZlZCBpbnNpZGUgYGJ1bmRsZXMvYC5cbiAgLy8gKk5vdGUqOiBSZWx5aW5nIG9uIHBhY2thZ2UgcmVzb2x1dGlvbiBpcyBwcm9ibGVtYXRpYyB3aXRoaW4gRVNNIGFuZCB3aXRoIGBsb2NhbC1kZXYuc2hgXG4gIGNvbnN0IGJ1bmRsZXNEaXIgPSBkaXJuYW1lKGZpbGVVUkxUb1BhdGgoaW1wb3J0Lm1ldGEudXJsKSk7XG4gIHJldHVybiBqb2luKGJ1bmRsZXNEaXIsICcuL3ByL2NoZWNrb3V0L2NvbW1pdC1tZXNzYWdlLWZpbHRlci5tanMnKTtcbn1cbiJdfQ==