import { assertValidGithubConfig, ConfigValidationError, getConfig } from '../../utils/config.js';
import { bold, Log } from '../../utils/logging.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { isGithubApiError } from '../../utils/git/github.js';
import { GITHUB_TOKEN_GENERATE_URL } from '../../utils/git/github-urls.js';
import { assertValidPullRequestConfig } from '../config/index.js';
import { MergeTool } from './merge-tool.js';
import { FatalMergeToolError, PullRequestValidationError, UserAbortedMergeToolError, } from './failures.js';
import { InvalidTargetBranchError, InvalidTargetLabelError, } from '../common/targeting/target-label.js';
export async function mergePullRequest(prNumber, flags) {
    process.env['HUSKY'] = '0';
    const tool = await createPullRequestMergeTool(flags);
    if (!(await performMerge())) {
        process.exit(1);
    }
    async function performMerge(validationConfig = {
        assertCompletedReviews: !flags.ignorePendingReviews,
    }) {
        try {
            await tool.merge(prNumber, validationConfig);
            return true;
        }
        catch (e) {
            if (isGithubApiError(e) && e.status === 401) {
                Log.error('Github API request failed: ' + bold(e.message));
                Log.error('Please ensure that your provided token is valid.');
                Log.warn(`You can generate a token here: ${GITHUB_TOKEN_GENERATE_URL}`);
                return false;
            }
            if (isGithubApiError(e) &&
                e.status === 405 &&
                e.message.startsWith('Repository rule violations found')) {
                Log.error('  ✘  Repository Rule Violation. This typically indicates that you are not');
                Log.error('     currently a member of the expected group for merge permissions in this');
                Log.error('     repository. Have you been placed in the expected caretaking group?');
                Log.debug('Github API request failed: ' + bold(e.message));
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
            if (e instanceof FatalMergeToolError) {
                Log.error(`Could not merge the specified pull request. Error:`);
                Log.error(` -> ${bold(e.message)}`);
                return false;
            }
            throw e;
        }
    }
}
async function createPullRequestMergeTool(flags) {
    try {
        const config = await getConfig();
        assertValidGithubConfig(config);
        assertValidPullRequestConfig(config);
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
export function parsePrNumber(prUrlOrNumber) {
    const prNumber = parseInt(prUrlOrNumber.split('/').pop());
    if (isNaN(prNumber)) {
        throw new Error('Pull Request was unable to be parsed from the parameters');
    }
    return prNumber;
}
//# sourceMappingURL=merge-pull-request.js.map