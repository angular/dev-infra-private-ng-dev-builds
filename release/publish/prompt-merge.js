import { bold, green, Log } from '../../utils/logging.js';
import { isGithubApiError } from '../../utils/git/github.js';
import { isPullRequestMerged } from './pull-request-state.js';
import { Prompt } from '../../utils/prompt.js';
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
    while (true) {
        if (!(await Prompt.confirm({ message: `Do you want to continue with merging PR #${id}?` }))) {
            continue;
        }
        Log.info(`      Attempting to merge pull request #${id}..`);
        Log.info(``);
        try {
            if (await gracefulCheckIfPullRequestIsMerged(git, id)) {
                break;
            }
            const { data, status, headers } = await git.github.pulls.merge({
                ...git.remoteParams,
                pull_number: id,
                merge_method: 'rebase',
            });
            if (data.merged) {
                break;
            }
            Log.error(`  ✘   Pull request #${id} could not be merged.`);
            Log.error(`      ${data.message} (${status})`);
            Log.debug(data, status, headers);
        }
        catch (e) {
            if (!isGithubApiError(e)) {
                throw e;
            }
            Log.error(`  ✘   Pull request #${id} could not be merged.`);
            Log.error(`      ${e.message} (${e.status})`);
            Log.debug(e);
        }
    }
    Log.info(green(`  ✓   Pull request #${id} has been merged.`));
}
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
//# sourceMappingURL=prompt-merge.js.map