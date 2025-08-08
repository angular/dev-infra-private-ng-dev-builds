import { dirname, join } from 'path';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { bold, green, Log } from '../../utils/logging.js';
import { Prompt } from '../../utils/prompt.js';
import { fileURLToPath } from 'url';
const takeoverAccounts = ['angular-robot'];
export async function checkoutAsPrTakeover(prNumber, { resetGitState, pullRequest }) {
    const git = await AuthenticatedGitClient.get();
    const branchName = `pr-takeover-${prNumber}`;
    if (git.runGraceful(['rev-parse', '-q', '--verify', branchName]).status === 0) {
        Log.error(` ✘ Expected branch name \`${branchName}\` already exists locally`);
        return;
    }
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
function getCommitMessageFilterScriptPath() {
    const bundlesDir = dirname(fileURLToPath(import.meta.url));
    return join(bundlesDir, './pr/checkout/commit-message-filter.mjs');
}
//# sourceMappingURL=takeover.js.map