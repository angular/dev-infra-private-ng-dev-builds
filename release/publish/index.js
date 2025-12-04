import { getCurrentMergeMode } from '../../utils/git/repository-merge-mode.js';
import { ActiveReleaseTrains } from '../versioning/active-release-trains.js';
import { NpmCommand } from '../versioning/npm-command.js';
import { printActiveReleaseTrains } from '../versioning/print-active-trains.js';
import { getNextBranchName } from '../versioning/version-branches.js';
import { FatalReleaseActionError, UserAbortedReleaseActionError } from './actions-error.js';
import { actions } from './actions/index.js';
import { verifyNgDevToolIsUpToDate } from '../../utils/version-check.js';
import { Log, yellow } from '../../utils/logging.js';
import { Prompt } from '../../utils/prompt.js';
export var CompletionState;
(function (CompletionState) {
    CompletionState[CompletionState["SUCCESS"] = 0] = "SUCCESS";
    CompletionState[CompletionState["FATAL_ERROR"] = 1] = "FATAL_ERROR";
    CompletionState[CompletionState["MANUALLY_ABORTED"] = 2] = "MANUALLY_ABORTED";
})(CompletionState || (CompletionState = {}));
export class ReleaseTool {
    constructor(_git, _config, _github, _projectRoot) {
        this._git = _git;
        this._config = _config;
        this._github = _github;
        this._projectRoot = _projectRoot;
        this.previousGitBranchOrRevision = this._git.getCurrentBranchOrRevision();
    }
    async run() {
        Log.info();
        Log.info(yellow('--------------------------------------------'));
        Log.info(yellow('  Angular Dev-Infra release staging script'));
        Log.info(yellow('--------------------------------------------'));
        Log.info();
        const { owner, name } = this._github;
        const nextBranchName = getNextBranchName(this._github);
        if (!(await this._verifyNoUncommittedChanges()) ||
            !(await this._verifyRunningFromNextBranch(nextBranchName)) ||
            !(await this._verifyNoShallowRepository()) ||
            !(await verifyNgDevToolIsUpToDate(this._projectRoot)) ||
            !(await this._verifyInReleaseMergeMode())) {
            return CompletionState.FATAL_ERROR;
        }
        if (!(await this._verifyNpmLoginState())) {
            return CompletionState.MANUALLY_ABORTED;
        }
        process.env['HUSKY'] = '0';
        const repo = { owner, name, api: this._git.github, nextBranchName };
        const releaseTrains = await ActiveReleaseTrains.fetch(repo);
        await printActiveReleaseTrains(releaseTrains, this._config);
        const action = await this._promptForReleaseAction(releaseTrains);
        try {
            await action.perform();
        }
        catch (e) {
            if (e instanceof UserAbortedReleaseActionError) {
                return CompletionState.MANUALLY_ABORTED;
            }
            if (!(e instanceof FatalReleaseActionError) && e instanceof Error) {
                console.error(e);
            }
            return CompletionState.FATAL_ERROR;
        }
        finally {
            await this.cleanup();
        }
        return CompletionState.SUCCESS;
    }
    async cleanup() {
        this._git.checkout(this.previousGitBranchOrRevision, true);
        await NpmCommand.logout(this._config.publishRegistry);
    }
    async _promptForReleaseAction(activeTrains) {
        const choices = [];
        for (let actionType of actions) {
            if (await actionType.isActive(activeTrains, this._config)) {
                const action = new actionType(activeTrains, this._git, this._config, this._projectRoot);
                choices.push({ name: await action.getDescription(), value: action });
            }
        }
        Log.info('Please select the type of release you want to perform.');
        const releaseAction = await Prompt.select({
            message: 'Please select an action:',
            choices,
        });
        return releaseAction;
    }
    async _verifyNoUncommittedChanges() {
        if (this._git.hasUncommittedChanges()) {
            Log.error('  ✘   There are changes which are not committed and should be discarded.');
            return false;
        }
        return true;
    }
    async _verifyInReleaseMergeMode() {
        if (this._github.requireReleaseModeForRelease !== true) {
            Log.debug('Skipping check for release mode before merge as the repository does not have');
            Log.debug('requireReleaseModeForRelease set to true in the GithubConfig.');
            return true;
        }
        const mode = await getCurrentMergeMode();
        if (mode !== 'release') {
            Log.error(`  ✘   The repository merge-mode is set to ${mode} but must be set to release`);
            Log.error('      prior to publishing releases. You can set merge-mode for release using:');
            Log.error('      ng-dev caretaker merge-mode release');
            return false;
        }
        return true;
    }
    async _verifyNoShallowRepository() {
        if (this._git.isShallowRepo()) {
            Log.error('  ✘   The local repository is configured as shallow.');
            Log.error(`      Please convert the repository to a complete one by syncing with upstream.`);
            Log.error(`      https://git-scm.com/docs/git-fetch#Documentation/git-fetch.txt---unshallow`);
            return false;
        }
        return true;
    }
    async _verifyRunningFromNextBranch(nextBranchName) {
        const headSha = this._git.run(['rev-parse', 'HEAD']).stdout.trim();
        const { data } = await this._git.github.repos.getBranch({
            ...this._git.remoteParams,
            branch: this._git.mainBranchName,
        });
        if (headSha !== data.commit.sha) {
            Log.error('  ✘   Running release tool from an outdated local branch.');
            Log.error(`      Please make sure you are running from the "${nextBranchName}" branch.`);
            return false;
        }
        return true;
    }
    async _verifyNpmLoginState() {
        const registry = `NPM at the ${this._config.publishRegistry ?? 'default NPM'} registry`;
        if (await NpmCommand.checkIsLoggedIn(this._config.publishRegistry)) {
            Log.debug(`Already logged into ${registry}.`);
            return true;
        }
        Log.warn(`  ✘   Not currently logged into ${registry}.`);
        const shouldLogin = await Prompt.confirm({ message: 'Would you like to log into NPM now?' });
        if (shouldLogin) {
            Log.debug('Starting NPM login.');
            try {
                await NpmCommand.startInteractiveLogin(this._config.publishRegistry);
            }
            catch {
                return false;
            }
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=index.js.map