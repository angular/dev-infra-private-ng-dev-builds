import { bold, green, Log, red, yellow } from '../../utils/logging.js';
import { getCaretakerNotePromptMessage, getTargetedBranchesConfirmationPromptMessage, getTargetedBranchesMessage, } from './messages.js';
import { loadAndValidatePullRequest } from './pull-request.js';
import { GithubApiMergeStrategy } from './strategies/api-merge.js';
import { AutosquashMergeStrategy } from './strategies/autosquash-merge.js';
import { assertValidReleaseConfig } from '../../release/config/index.js';
import { ActiveReleaseTrains, fetchLongTermSupportBranchesFromNpm, getNextBranchName, } from '../../release/versioning/index.js';
import { FatalMergeToolError, PullRequestValidationError, UserAbortedMergeToolError, } from './failures.js';
import { createPullRequestValidationConfig } from '../common/validation/validation-config.js';
import { Prompt } from '../../utils/prompt.js';
const defaultPullRequestMergeFlags = {
    branchPrompt: true,
    forceManualBranches: false,
    dryRun: false,
    ignorePendingReviews: false,
};
export class MergeTool {
    constructor(config, git, flags) {
        this.config = config;
        this.git = git;
        this.flags = { ...defaultPullRequestMergeFlags, ...flags };
    }
    async merge(prNumber, partialValidationConfig) {
        const validationConfig = createPullRequestValidationConfig({
            ...this.config.pullRequest.validators,
            ...partialValidationConfig,
        });
        if (this.git.hasUncommittedChanges()) {
            throw new FatalMergeToolError('Local working repository not clean. Please make sure there are ' +
                'no uncommitted changes.');
        }
        if (this.git.isShallowRepo()) {
            throw new FatalMergeToolError(`Unable to perform merge in a local repository that is configured as shallow.\n` +
                `Please convert the repository to a complete one by syncing with upstream.\n` +
                `https://git-scm.com/docs/git-fetch#Documentation/git-fetch.txt---unshallow`);
        }
        await this.confirmMergeAccess();
        const pullRequest = await loadAndValidatePullRequest(this, prNumber, validationConfig);
        if (pullRequest.validationFailures.length > 0) {
            Log.error(`Pull request did not pass one or more validation checks. Error:`);
            for (const failure of pullRequest.validationFailures) {
                Log.error(` -> ${bold(failure.message)}`);
            }
            Log.info();
            if (pullRequest.validationFailures.some((failure) => !failure.canBeForceIgnored)) {
                Log.debug('Discovered a fatal error, which cannot be forced');
                throw new PullRequestValidationError();
            }
            Log.info(yellow(`All discovered validations are non-fatal and can be forcibly ignored.`));
            if (!(await Prompt.confirm({
                message: 'Do you want to forcibly ignore these validation failures?',
            }))) {
                throw new PullRequestValidationError();
            }
        }
        if (this.flags.forceManualBranches) {
            await this.updatePullRequestTargetedBranchesFromPrompt(pullRequest);
        }
        if (pullRequest.hasCaretakerNote &&
            !(await Prompt.confirm({ message: getCaretakerNotePromptMessage(pullRequest) }))) {
            throw new UserAbortedMergeToolError();
        }
        const strategy = this.config.pullRequest.githubApiMerge
            ? new GithubApiMergeStrategy(this.git, this.config.pullRequest.githubApiMerge)
            : new AutosquashMergeStrategy(this.git);
        const previousBranchOrRevision = this.git.getCurrentBranchOrRevision();
        try {
            await strategy.prepare(pullRequest);
            Log.info();
            Log.info(getTargetedBranchesMessage(pullRequest));
            await strategy.check(pullRequest);
            Log.info('');
            Log.info(green(`     PR: ${bold(pullRequest.title)}`));
            Log.info(green(`  ✓  Pull request can be merged into all target branches.`));
            Log.info();
            if (this.flags.dryRun) {
                Log.info(green(`  ✓  Exiting due to dry run mode.`));
                return;
            }
            if (!this.config.pullRequest.__noTargetLabeling &&
                !this.flags.forceManualBranches &&
                this.flags.branchPrompt &&
                !(await Prompt.confirm({ message: getTargetedBranchesConfirmationPromptMessage() }))) {
                throw new UserAbortedMergeToolError();
            }
            await strategy.merge(pullRequest);
            Log.info(green(`  ✓  Successfully merged the pull request: #${prNumber}`));
        }
        finally {
            this.git.run(['checkout', '-f', previousBranchOrRevision]);
            await strategy.cleanup(pullRequest);
        }
    }
    async updatePullRequestTargetedBranchesFromPrompt(pullRequest) {
        const { name: repoName, owner } = this.config.github;
        let ltsBranches = [];
        try {
            assertValidReleaseConfig(this.config);
            const ltsBranchesFromNpm = await fetchLongTermSupportBranchesFromNpm(this.config.release);
            ltsBranches = ltsBranchesFromNpm.active.map(({ name, version }) => ({
                branchName: name,
                version,
            }));
        }
        catch {
            Log.warn('Unable to determine the active LTS branches as a release config is not set for this repo.');
        }
        const { latest, next, releaseCandidate } = await ActiveReleaseTrains.fetch({
            name: repoName,
            nextBranchName: getNextBranchName(this.config.github),
            owner,
            api: this.git.github,
        });
        const activeBranches = [
            next,
            latest,
            ...ltsBranches,
        ];
        if (releaseCandidate !== null) {
            activeBranches.splice(1, 0, releaseCandidate);
        }
        const selectedBranches = await Prompt.checkbox({
            choices: activeBranches.map(({ branchName, version }) => {
                return {
                    checked: pullRequest.targetBranches.includes(branchName),
                    value: branchName,
                    short: branchName,
                    name: `${branchName} (${version})${branchName === pullRequest.githubTargetBranch ? ' [Targeted via Github UI]' : ''}`,
                };
            }),
            message: 'Select branches to merge pull request into:',
        });
        const confirmation = await Prompt.confirm({
            default: false,
            message: red('!!!!!! WARNING !!!!!!!\n') +
                yellow('Using manual branch selection disables protective checks provided by the merge ' +
                    'tooling. This means that the merge tooling will not prevent changes which are not ' +
                    'allowed for the targeted branches. Please proceed with caution.\n') +
                'Are you sure you would like to proceed with the selected branches?',
        });
        if (confirmation === false) {
            throw new UserAbortedMergeToolError();
        }
        if (!selectedBranches.includes(pullRequest.githubTargetBranch)) {
            throw new FatalMergeToolError(`Pull Requests must merge into their targeted Github branch. If this branch (${pullRequest.githubTargetBranch}) ` +
                'should not be included, please change the targeted branch via the Github UI.');
        }
        pullRequest.targetBranches = selectedBranches;
    }
    async confirmMergeAccess() {
        if (this.git.userType === 'user') {
            const hasOauthScopes = await this.git.hasOauthScopes((scopes, missing) => {
                if (!scopes.includes('repo')) {
                    if (this.config.github.private) {
                        missing.push('repo');
                    }
                    else if (!scopes.includes('public_repo')) {
                        missing.push('public_repo');
                    }
                }
                if (!scopes.includes('workflow')) {
                    missing.push('workflow');
                }
            });
            if (hasOauthScopes !== true) {
                throw new FatalMergeToolError(hasOauthScopes.error);
            }
            return;
        }
        else {
            Log.debug('Assuming correct access because this a bot account.');
        }
    }
}
//# sourceMappingURL=merge-tool.js.map