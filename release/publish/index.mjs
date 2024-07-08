/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import inquirer from 'inquirer';
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
        /** The previous git commit to return back to after the release tool runs. */
        this.previousGitBranchOrRevision = this._git.getCurrentBranchOrRevision();
    }
    /** Runs the interactive release tool. */
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
            !(await verifyNgDevToolIsUpToDate(this._projectRoot))) {
            return CompletionState.FATAL_ERROR;
        }
        if (!(await this._verifyNpmLoginState())) {
            return CompletionState.MANUALLY_ABORTED;
        }
        // Set the environment variable to skip all git commit hooks triggered by husky. We are unable to
        // rely on `--no-verify` as some hooks still run, notably the `prepare-commit-msg` hook.
        // Running hooks has the downside of potentially running code (like the `ng-dev` tool) when a version
        // branch is checked out, but the node modules are not re-installed. The tool switches branches
        // multiple times per execution, and it is not desirable re-running Yarn all the time.
        process.env['HUSKY'] = '0';
        const repo = { owner, name, api: this._git.github, nextBranchName };
        const releaseTrains = await ActiveReleaseTrains.fetch(repo);
        // Print the active release trains so that the caretaker can access
        // the current project branching state without switching context.
        await printActiveReleaseTrains(releaseTrains, this._config);
        const action = await this._promptForReleaseAction(releaseTrains);
        try {
            await action.perform();
        }
        catch (e) {
            if (e instanceof UserAbortedReleaseActionError) {
                return CompletionState.MANUALLY_ABORTED;
            }
            // Only print the error message and stack if the error is not a known fatal release
            // action error (for which we print the error gracefully to the console with colors).
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
    /** Run post release tool cleanups. */
    async cleanup() {
        // Return back to the git state from before the release tool ran.
        this._git.checkout(this.previousGitBranchOrRevision, true);
        // Ensure log out of NPM.
        await NpmCommand.logout(this._config.publishRegistry);
    }
    /** Prompts the caretaker for a release action that should be performed. */
    async _promptForReleaseAction(activeTrains) {
        const choices = [];
        // Find and instantiate all release actions which are currently valid.
        for (let actionType of actions) {
            if (await actionType.isActive(activeTrains, this._config)) {
                const action = new actionType(activeTrains, this._git, this._config, this._projectRoot);
                choices.push({ name: await action.getDescription(), value: action });
            }
        }
        Log.info('Please select the type of release you want to perform.');
        const { releaseAction } = await inquirer.prompt({
            name: 'releaseAction',
            message: 'Please select an action:',
            type: 'list',
            choices,
        });
        return releaseAction;
    }
    /**
     * Verifies that there are no uncommitted changes in the project.
     * @returns a boolean indicating success or failure.
     */
    async _verifyNoUncommittedChanges() {
        if (this._git.hasUncommittedChanges()) {
            Log.error('  ✘   There are changes which are not committed and should be discarded.');
            return false;
        }
        return true;
    }
    /**
     * Verifies that the local repository is not configured as shallow.
     * @returns a boolean indicating success or failure.
     */
    async _verifyNoShallowRepository() {
        if (this._git.isShallowRepo()) {
            Log.error('  ✘   The local repository is configured as shallow.');
            Log.error(`      Please convert the repository to a complete one by syncing with upstream.`);
            Log.error(`      https://git-scm.com/docs/git-fetch#Documentation/git-fetch.txt---unshallow`);
            return false;
        }
        return true;
    }
    /**
     * Verifies that the next branch from the configured repository is checked out.
     * @returns a boolean indicating success or failure.
     */
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
    /**
     * Verifies that the user is logged into NPM at the correct registry, if defined for the release.
     * @returns a boolean indicating whether the user is logged into NPM.
     */
    async _verifyNpmLoginState() {
        const registry = `NPM at the ${this._config.publishRegistry ?? 'default NPM'} registry`;
        // TODO(josephperrott): remove wombat specific block once wombot allows `npm whoami` check to
        // check the status of the local token in the .npmrc file.
        if (this._config.publishRegistry?.includes('wombat-dressing-room.appspot.com')) {
            Log.info('Unable to determine NPM login state for wombat proxy, requiring login now.');
            try {
                await NpmCommand.startInteractiveLogin(this._config.publishRegistry);
            }
            catch {
                return false;
            }
            return true;
        }
        if (await NpmCommand.checkIsLoggedIn(this._config.publishRegistry)) {
            Log.debug(`Already logged into ${registry}.`);
            return true;
        }
        Log.warn(`  ✘   Not currently logged into ${registry}.`);
        const shouldLogin = await Prompt.confirm('Would you like to log into NPM now?');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9wdWJsaXNoL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sUUFBUSxNQUFNLFVBQVUsQ0FBQztBQUtoQyxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSx3Q0FBd0MsQ0FBQztBQUMzRSxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDeEQsT0FBTyxFQUFDLHdCQUF3QixFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFDOUUsT0FBTyxFQUFDLGlCQUFpQixFQUFxQixNQUFNLG1DQUFtQyxDQUFDO0FBR3hGLE9BQU8sRUFBQyx1QkFBdUIsRUFBRSw2QkFBNkIsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQzFGLE9BQU8sRUFBQyxPQUFPLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUMzQyxPQUFPLEVBQUMseUJBQXlCLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUN2RSxPQUFPLEVBQUMsR0FBRyxFQUFFLE1BQU0sRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQ25ELE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUU3QyxNQUFNLENBQU4sSUFBWSxlQUlYO0FBSkQsV0FBWSxlQUFlO0lBQ3pCLDJEQUFPLENBQUE7SUFDUCxtRUFBVyxDQUFBO0lBQ1gsNkVBQWdCLENBQUE7QUFDbEIsQ0FBQyxFQUpXLGVBQWUsS0FBZixlQUFlLFFBSTFCO0FBRUQsTUFBTSxPQUFPLFdBQVc7SUFJdEIsWUFDWSxJQUE0QixFQUM1QixPQUFzQixFQUN0QixPQUFxQixFQUNyQixZQUFvQjtRQUhwQixTQUFJLEdBQUosSUFBSSxDQUF3QjtRQUM1QixZQUFPLEdBQVAsT0FBTyxDQUFlO1FBQ3RCLFlBQU8sR0FBUCxPQUFPLENBQWM7UUFDckIsaUJBQVksR0FBWixZQUFZLENBQVE7UUFQaEMsNkVBQTZFO1FBQ3JFLGdDQUEyQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztJQU8xRSxDQUFDO0lBRUoseUNBQXlDO0lBQ3pDLEtBQUssQ0FBQyxHQUFHO1FBQ1AsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ1gsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsOENBQThDLENBQUMsQ0FBQyxDQUFDO1FBQ2pFLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLDRDQUE0QyxDQUFDLENBQUMsQ0FBQztRQUMvRCxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDLENBQUM7UUFDakUsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO1FBRVgsTUFBTSxFQUFDLEtBQUssRUFBRSxJQUFJLEVBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO1FBQ25DLE1BQU0sY0FBYyxHQUFHLGlCQUFpQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUV2RCxJQUNFLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1lBQzNDLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUMxRCxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztZQUMxQyxDQUFDLENBQUMsTUFBTSx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsRUFDckQsQ0FBQztZQUNELE9BQU8sZUFBZSxDQUFDLFdBQVcsQ0FBQztRQUNyQyxDQUFDO1FBRUQsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQyxFQUFFLENBQUM7WUFDekMsT0FBTyxlQUFlLENBQUMsZ0JBQWdCLENBQUM7UUFDMUMsQ0FBQztRQUVELGlHQUFpRztRQUNqRyx3RkFBd0Y7UUFDeEYscUdBQXFHO1FBQ3JHLCtGQUErRjtRQUMvRixzRkFBc0Y7UUFDdEYsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLENBQUM7UUFFM0IsTUFBTSxJQUFJLEdBQXVCLEVBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsY0FBYyxFQUFDLENBQUM7UUFDdEYsTUFBTSxhQUFhLEdBQUcsTUFBTSxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFNUQsbUVBQW1FO1FBQ25FLGlFQUFpRTtRQUNqRSxNQUFNLHdCQUF3QixDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFNUQsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsdUJBQXVCLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFakUsSUFBSSxDQUFDO1lBQ0gsTUFBTSxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDekIsQ0FBQztRQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDWCxJQUFJLENBQUMsWUFBWSw2QkFBNkIsRUFBRSxDQUFDO2dCQUMvQyxPQUFPLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQztZQUMxQyxDQUFDO1lBQ0QsbUZBQW1GO1lBQ25GLHFGQUFxRjtZQUNyRixJQUFJLENBQUMsQ0FBQyxDQUFDLFlBQVksdUJBQXVCLENBQUMsSUFBSSxDQUFDLFlBQVksS0FBSyxFQUFFLENBQUM7Z0JBQ2xFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbkIsQ0FBQztZQUNELE9BQU8sZUFBZSxDQUFDLFdBQVcsQ0FBQztRQUNyQyxDQUFDO2dCQUFTLENBQUM7WUFDVCxNQUFNLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN2QixDQUFDO1FBRUQsT0FBTyxlQUFlLENBQUMsT0FBTyxDQUFDO0lBQ2pDLENBQUM7SUFFRCxzQ0FBc0M7SUFDOUIsS0FBSyxDQUFDLE9BQU87UUFDbkIsaUVBQWlFO1FBQ2pFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMzRCx5QkFBeUI7UUFDekIsTUFBTSxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDeEQsQ0FBQztJQUVELDJFQUEyRTtJQUNuRSxLQUFLLENBQUMsdUJBQXVCLENBQUMsWUFBaUM7UUFDckUsTUFBTSxPQUFPLEdBQTJDLEVBQUUsQ0FBQztRQUUzRCxzRUFBc0U7UUFDdEUsS0FBSyxJQUFJLFVBQVUsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUMvQixJQUFJLE1BQU0sVUFBVSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQzFELE1BQU0sTUFBTSxHQUFrQixJQUFJLFVBQVUsQ0FDMUMsWUFBWSxFQUNaLElBQUksQ0FBQyxJQUFJLEVBQ1QsSUFBSSxDQUFDLE9BQU8sRUFDWixJQUFJLENBQUMsWUFBWSxDQUNsQixDQUFDO2dCQUNGLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBQyxJQUFJLEVBQUUsTUFBTSxNQUFNLENBQUMsY0FBYyxFQUFFLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBQyxDQUFDLENBQUM7WUFDckUsQ0FBQztRQUNILENBQUM7UUFFRCxHQUFHLENBQUMsSUFBSSxDQUFDLHdEQUF3RCxDQUFDLENBQUM7UUFFbkUsTUFBTSxFQUFDLGFBQWEsRUFBQyxHQUFHLE1BQU0sUUFBUSxDQUFDLE1BQU0sQ0FBaUM7WUFDNUUsSUFBSSxFQUFFLGVBQWU7WUFDckIsT0FBTyxFQUFFLDBCQUEwQjtZQUNuQyxJQUFJLEVBQUUsTUFBTTtZQUNaLE9BQU87U0FDUixDQUFDLENBQUM7UUFFSCxPQUFPLGFBQWEsQ0FBQztJQUN2QixDQUFDO0lBRUQ7OztPQUdHO0lBQ0ssS0FBSyxDQUFDLDJCQUEyQjtRQUN2QyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMscUJBQXFCLEVBQUUsRUFBRSxDQUFDO1lBQ3RDLEdBQUcsQ0FBQyxLQUFLLENBQUMsMEVBQTBFLENBQUMsQ0FBQztZQUN0RixPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSyxLQUFLLENBQUMsMEJBQTBCO1FBQ3RDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsRUFBRSxDQUFDO1lBQzlCLEdBQUcsQ0FBQyxLQUFLLENBQUMsc0RBQXNELENBQUMsQ0FBQztZQUNsRSxHQUFHLENBQUMsS0FBSyxDQUFDLGlGQUFpRixDQUFDLENBQUM7WUFDN0YsR0FBRyxDQUFDLEtBQUssQ0FBQyxrRkFBa0YsQ0FBQyxDQUFDO1lBQzlGLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNLLEtBQUssQ0FBQyw0QkFBNEIsQ0FBQyxjQUFzQjtRQUMvRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNuRSxNQUFNLEVBQUMsSUFBSSxFQUFDLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDO1lBQ3BELEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZO1lBQ3pCLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWM7U0FDakMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxPQUFPLEtBQUssSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNoQyxHQUFHLENBQUMsS0FBSyxDQUFDLDJEQUEyRCxDQUFDLENBQUM7WUFDdkUsR0FBRyxDQUFDLEtBQUssQ0FBQyxvREFBb0QsY0FBYyxXQUFXLENBQUMsQ0FBQztZQUN6RixPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSyxLQUFLLENBQUMsb0JBQW9CO1FBQ2hDLE1BQU0sUUFBUSxHQUFHLGNBQWMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxlQUFlLElBQUksYUFBYSxXQUFXLENBQUM7UUFDeEYsNkZBQTZGO1FBQzdGLDBEQUEwRDtRQUMxRCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxFQUFFLFFBQVEsQ0FBQyxrQ0FBa0MsQ0FBQyxFQUFFLENBQUM7WUFDL0UsR0FBRyxDQUFDLElBQUksQ0FBQyw0RUFBNEUsQ0FBQyxDQUFDO1lBQ3ZGLElBQUksQ0FBQztnQkFDSCxNQUFNLFVBQVUsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQ3ZFLENBQUM7WUFBQyxNQUFNLENBQUM7Z0JBQ1AsT0FBTyxLQUFLLENBQUM7WUFDZixDQUFDO1lBQ0QsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQ0QsSUFBSSxNQUFNLFVBQVUsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDO1lBQ25FLEdBQUcsQ0FBQyxLQUFLLENBQUMsdUJBQXVCLFFBQVEsR0FBRyxDQUFDLENBQUM7WUFDOUMsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQ0QsR0FBRyxDQUFDLElBQUksQ0FBQyxtQ0FBbUMsUUFBUSxHQUFHLENBQUMsQ0FBQztRQUN6RCxNQUFNLFdBQVcsR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMscUNBQXFDLENBQUMsQ0FBQztRQUNoRixJQUFJLFdBQVcsRUFBRSxDQUFDO1lBQ2hCLEdBQUcsQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQztZQUNqQyxJQUFJLENBQUM7Z0JBQ0gsTUFBTSxVQUFVLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUN2RSxDQUFDO1lBQUMsTUFBTSxDQUFDO2dCQUNQLE9BQU8sS0FBSyxDQUFDO1lBQ2YsQ0FBQztZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBpbnF1aXJlciBmcm9tICdpbnF1aXJlcic7XG5cbmltcG9ydCB7R2l0aHViQ29uZmlnfSBmcm9tICcuLi8uLi91dGlscy9jb25maWcuanMnO1xuaW1wb3J0IHtBdXRoZW50aWNhdGVkR2l0Q2xpZW50fSBmcm9tICcuLi8uLi91dGlscy9naXQvYXV0aGVudGljYXRlZC1naXQtY2xpZW50LmpzJztcbmltcG9ydCB7UmVsZWFzZUNvbmZpZ30gZnJvbSAnLi4vY29uZmlnL2luZGV4LmpzJztcbmltcG9ydCB7QWN0aXZlUmVsZWFzZVRyYWluc30gZnJvbSAnLi4vdmVyc2lvbmluZy9hY3RpdmUtcmVsZWFzZS10cmFpbnMuanMnO1xuaW1wb3J0IHtOcG1Db21tYW5kfSBmcm9tICcuLi92ZXJzaW9uaW5nL25wbS1jb21tYW5kLmpzJztcbmltcG9ydCB7cHJpbnRBY3RpdmVSZWxlYXNlVHJhaW5zfSBmcm9tICcuLi92ZXJzaW9uaW5nL3ByaW50LWFjdGl2ZS10cmFpbnMuanMnO1xuaW1wb3J0IHtnZXROZXh0QnJhbmNoTmFtZSwgUmVsZWFzZVJlcG9XaXRoQXBpfSBmcm9tICcuLi92ZXJzaW9uaW5nL3ZlcnNpb24tYnJhbmNoZXMuanMnO1xuXG5pbXBvcnQge1JlbGVhc2VBY3Rpb259IGZyb20gJy4vYWN0aW9ucy5qcyc7XG5pbXBvcnQge0ZhdGFsUmVsZWFzZUFjdGlvbkVycm9yLCBVc2VyQWJvcnRlZFJlbGVhc2VBY3Rpb25FcnJvcn0gZnJvbSAnLi9hY3Rpb25zLWVycm9yLmpzJztcbmltcG9ydCB7YWN0aW9uc30gZnJvbSAnLi9hY3Rpb25zL2luZGV4LmpzJztcbmltcG9ydCB7dmVyaWZ5TmdEZXZUb29sSXNVcFRvRGF0ZX0gZnJvbSAnLi4vLi4vdXRpbHMvdmVyc2lvbi1jaGVjay5qcyc7XG5pbXBvcnQge0xvZywgeWVsbG93fSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7UHJvbXB0fSBmcm9tICcuLi8uLi91dGlscy9wcm9tcHQuanMnO1xuXG5leHBvcnQgZW51bSBDb21wbGV0aW9uU3RhdGUge1xuICBTVUNDRVNTLFxuICBGQVRBTF9FUlJPUixcbiAgTUFOVUFMTFlfQUJPUlRFRCxcbn1cblxuZXhwb3J0IGNsYXNzIFJlbGVhc2VUb29sIHtcbiAgLyoqIFRoZSBwcmV2aW91cyBnaXQgY29tbWl0IHRvIHJldHVybiBiYWNrIHRvIGFmdGVyIHRoZSByZWxlYXNlIHRvb2wgcnVucy4gKi9cbiAgcHJpdmF0ZSBwcmV2aW91c0dpdEJyYW5jaE9yUmV2aXNpb24gPSB0aGlzLl9naXQuZ2V0Q3VycmVudEJyYW5jaE9yUmV2aXNpb24oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcm90ZWN0ZWQgX2dpdDogQXV0aGVudGljYXRlZEdpdENsaWVudCxcbiAgICBwcm90ZWN0ZWQgX2NvbmZpZzogUmVsZWFzZUNvbmZpZyxcbiAgICBwcm90ZWN0ZWQgX2dpdGh1YjogR2l0aHViQ29uZmlnLFxuICAgIHByb3RlY3RlZCBfcHJvamVjdFJvb3Q6IHN0cmluZyxcbiAgKSB7fVxuXG4gIC8qKiBSdW5zIHRoZSBpbnRlcmFjdGl2ZSByZWxlYXNlIHRvb2wuICovXG4gIGFzeW5jIHJ1bigpOiBQcm9taXNlPENvbXBsZXRpb25TdGF0ZT4ge1xuICAgIExvZy5pbmZvKCk7XG4gICAgTG9nLmluZm8oeWVsbG93KCctLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLScpKTtcbiAgICBMb2cuaW5mbyh5ZWxsb3coJyAgQW5ndWxhciBEZXYtSW5mcmEgcmVsZWFzZSBzdGFnaW5nIHNjcmlwdCcpKTtcbiAgICBMb2cuaW5mbyh5ZWxsb3coJy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tJykpO1xuICAgIExvZy5pbmZvKCk7XG5cbiAgICBjb25zdCB7b3duZXIsIG5hbWV9ID0gdGhpcy5fZ2l0aHViO1xuICAgIGNvbnN0IG5leHRCcmFuY2hOYW1lID0gZ2V0TmV4dEJyYW5jaE5hbWUodGhpcy5fZ2l0aHViKTtcblxuICAgIGlmIChcbiAgICAgICEoYXdhaXQgdGhpcy5fdmVyaWZ5Tm9VbmNvbW1pdHRlZENoYW5nZXMoKSkgfHxcbiAgICAgICEoYXdhaXQgdGhpcy5fdmVyaWZ5UnVubmluZ0Zyb21OZXh0QnJhbmNoKG5leHRCcmFuY2hOYW1lKSkgfHxcbiAgICAgICEoYXdhaXQgdGhpcy5fdmVyaWZ5Tm9TaGFsbG93UmVwb3NpdG9yeSgpKSB8fFxuICAgICAgIShhd2FpdCB2ZXJpZnlOZ0RldlRvb2xJc1VwVG9EYXRlKHRoaXMuX3Byb2plY3RSb290KSlcbiAgICApIHtcbiAgICAgIHJldHVybiBDb21wbGV0aW9uU3RhdGUuRkFUQUxfRVJST1I7XG4gICAgfVxuXG4gICAgaWYgKCEoYXdhaXQgdGhpcy5fdmVyaWZ5TnBtTG9naW5TdGF0ZSgpKSkge1xuICAgICAgcmV0dXJuIENvbXBsZXRpb25TdGF0ZS5NQU5VQUxMWV9BQk9SVEVEO1xuICAgIH1cblxuICAgIC8vIFNldCB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGUgdG8gc2tpcCBhbGwgZ2l0IGNvbW1pdCBob29rcyB0cmlnZ2VyZWQgYnkgaHVza3kuIFdlIGFyZSB1bmFibGUgdG9cbiAgICAvLyByZWx5IG9uIGAtLW5vLXZlcmlmeWAgYXMgc29tZSBob29rcyBzdGlsbCBydW4sIG5vdGFibHkgdGhlIGBwcmVwYXJlLWNvbW1pdC1tc2dgIGhvb2suXG4gICAgLy8gUnVubmluZyBob29rcyBoYXMgdGhlIGRvd25zaWRlIG9mIHBvdGVudGlhbGx5IHJ1bm5pbmcgY29kZSAobGlrZSB0aGUgYG5nLWRldmAgdG9vbCkgd2hlbiBhIHZlcnNpb25cbiAgICAvLyBicmFuY2ggaXMgY2hlY2tlZCBvdXQsIGJ1dCB0aGUgbm9kZSBtb2R1bGVzIGFyZSBub3QgcmUtaW5zdGFsbGVkLiBUaGUgdG9vbCBzd2l0Y2hlcyBicmFuY2hlc1xuICAgIC8vIG11bHRpcGxlIHRpbWVzIHBlciBleGVjdXRpb24sIGFuZCBpdCBpcyBub3QgZGVzaXJhYmxlIHJlLXJ1bm5pbmcgWWFybiBhbGwgdGhlIHRpbWUuXG4gICAgcHJvY2Vzcy5lbnZbJ0hVU0tZJ10gPSAnMCc7XG5cbiAgICBjb25zdCByZXBvOiBSZWxlYXNlUmVwb1dpdGhBcGkgPSB7b3duZXIsIG5hbWUsIGFwaTogdGhpcy5fZ2l0LmdpdGh1YiwgbmV4dEJyYW5jaE5hbWV9O1xuICAgIGNvbnN0IHJlbGVhc2VUcmFpbnMgPSBhd2FpdCBBY3RpdmVSZWxlYXNlVHJhaW5zLmZldGNoKHJlcG8pO1xuXG4gICAgLy8gUHJpbnQgdGhlIGFjdGl2ZSByZWxlYXNlIHRyYWlucyBzbyB0aGF0IHRoZSBjYXJldGFrZXIgY2FuIGFjY2Vzc1xuICAgIC8vIHRoZSBjdXJyZW50IHByb2plY3QgYnJhbmNoaW5nIHN0YXRlIHdpdGhvdXQgc3dpdGNoaW5nIGNvbnRleHQuXG4gICAgYXdhaXQgcHJpbnRBY3RpdmVSZWxlYXNlVHJhaW5zKHJlbGVhc2VUcmFpbnMsIHRoaXMuX2NvbmZpZyk7XG5cbiAgICBjb25zdCBhY3Rpb24gPSBhd2FpdCB0aGlzLl9wcm9tcHRGb3JSZWxlYXNlQWN0aW9uKHJlbGVhc2VUcmFpbnMpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGFjdGlvbi5wZXJmb3JtKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBVc2VyQWJvcnRlZFJlbGVhc2VBY3Rpb25FcnJvcikge1xuICAgICAgICByZXR1cm4gQ29tcGxldGlvblN0YXRlLk1BTlVBTExZX0FCT1JURUQ7XG4gICAgICB9XG4gICAgICAvLyBPbmx5IHByaW50IHRoZSBlcnJvciBtZXNzYWdlIGFuZCBzdGFjayBpZiB0aGUgZXJyb3IgaXMgbm90IGEga25vd24gZmF0YWwgcmVsZWFzZVxuICAgICAgLy8gYWN0aW9uIGVycm9yIChmb3Igd2hpY2ggd2UgcHJpbnQgdGhlIGVycm9yIGdyYWNlZnVsbHkgdG8gdGhlIGNvbnNvbGUgd2l0aCBjb2xvcnMpLlxuICAgICAgaWYgKCEoZSBpbnN0YW5jZW9mIEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKSAmJiBlIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBDb21wbGV0aW9uU3RhdGUuRkFUQUxfRVJST1I7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGF3YWl0IHRoaXMuY2xlYW51cCgpO1xuICAgIH1cblxuICAgIHJldHVybiBDb21wbGV0aW9uU3RhdGUuU1VDQ0VTUztcbiAgfVxuXG4gIC8qKiBSdW4gcG9zdCByZWxlYXNlIHRvb2wgY2xlYW51cHMuICovXG4gIHByaXZhdGUgYXN5bmMgY2xlYW51cCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBSZXR1cm4gYmFjayB0byB0aGUgZ2l0IHN0YXRlIGZyb20gYmVmb3JlIHRoZSByZWxlYXNlIHRvb2wgcmFuLlxuICAgIHRoaXMuX2dpdC5jaGVja291dCh0aGlzLnByZXZpb3VzR2l0QnJhbmNoT3JSZXZpc2lvbiwgdHJ1ZSk7XG4gICAgLy8gRW5zdXJlIGxvZyBvdXQgb2YgTlBNLlxuICAgIGF3YWl0IE5wbUNvbW1hbmQubG9nb3V0KHRoaXMuX2NvbmZpZy5wdWJsaXNoUmVnaXN0cnkpO1xuICB9XG5cbiAgLyoqIFByb21wdHMgdGhlIGNhcmV0YWtlciBmb3IgYSByZWxlYXNlIGFjdGlvbiB0aGF0IHNob3VsZCBiZSBwZXJmb3JtZWQuICovXG4gIHByaXZhdGUgYXN5bmMgX3Byb21wdEZvclJlbGVhc2VBY3Rpb24oYWN0aXZlVHJhaW5zOiBBY3RpdmVSZWxlYXNlVHJhaW5zKSB7XG4gICAgY29uc3QgY2hvaWNlczoge25hbWU6IHN0cmluZzsgdmFsdWU6IFJlbGVhc2VBY3Rpb259W10gPSBbXTtcblxuICAgIC8vIEZpbmQgYW5kIGluc3RhbnRpYXRlIGFsbCByZWxlYXNlIGFjdGlvbnMgd2hpY2ggYXJlIGN1cnJlbnRseSB2YWxpZC5cbiAgICBmb3IgKGxldCBhY3Rpb25UeXBlIG9mIGFjdGlvbnMpIHtcbiAgICAgIGlmIChhd2FpdCBhY3Rpb25UeXBlLmlzQWN0aXZlKGFjdGl2ZVRyYWlucywgdGhpcy5fY29uZmlnKSkge1xuICAgICAgICBjb25zdCBhY3Rpb246IFJlbGVhc2VBY3Rpb24gPSBuZXcgYWN0aW9uVHlwZShcbiAgICAgICAgICBhY3RpdmVUcmFpbnMsXG4gICAgICAgICAgdGhpcy5fZ2l0LFxuICAgICAgICAgIHRoaXMuX2NvbmZpZyxcbiAgICAgICAgICB0aGlzLl9wcm9qZWN0Um9vdCxcbiAgICAgICAgKTtcbiAgICAgICAgY2hvaWNlcy5wdXNoKHtuYW1lOiBhd2FpdCBhY3Rpb24uZ2V0RGVzY3JpcHRpb24oKSwgdmFsdWU6IGFjdGlvbn0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIExvZy5pbmZvKCdQbGVhc2Ugc2VsZWN0IHRoZSB0eXBlIG9mIHJlbGVhc2UgeW91IHdhbnQgdG8gcGVyZm9ybS4nKTtcblxuICAgIGNvbnN0IHtyZWxlYXNlQWN0aW9ufSA9IGF3YWl0IGlucXVpcmVyLnByb21wdDx7cmVsZWFzZUFjdGlvbjogUmVsZWFzZUFjdGlvbn0+KHtcbiAgICAgIG5hbWU6ICdyZWxlYXNlQWN0aW9uJyxcbiAgICAgIG1lc3NhZ2U6ICdQbGVhc2Ugc2VsZWN0IGFuIGFjdGlvbjonLFxuICAgICAgdHlwZTogJ2xpc3QnLFxuICAgICAgY2hvaWNlcyxcbiAgICB9KTtcblxuICAgIHJldHVybiByZWxlYXNlQWN0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIFZlcmlmaWVzIHRoYXQgdGhlcmUgYXJlIG5vIHVuY29tbWl0dGVkIGNoYW5nZXMgaW4gdGhlIHByb2plY3QuXG4gICAqIEByZXR1cm5zIGEgYm9vbGVhbiBpbmRpY2F0aW5nIHN1Y2Nlc3Mgb3IgZmFpbHVyZS5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgX3ZlcmlmeU5vVW5jb21taXR0ZWRDaGFuZ2VzKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGlmICh0aGlzLl9naXQuaGFzVW5jb21taXR0ZWRDaGFuZ2VzKCkpIHtcbiAgICAgIExvZy5lcnJvcignICDinJggICBUaGVyZSBhcmUgY2hhbmdlcyB3aGljaCBhcmUgbm90IGNvbW1pdHRlZCBhbmQgc2hvdWxkIGJlIGRpc2NhcmRlZC4nKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKipcbiAgICogVmVyaWZpZXMgdGhhdCB0aGUgbG9jYWwgcmVwb3NpdG9yeSBpcyBub3QgY29uZmlndXJlZCBhcyBzaGFsbG93LlxuICAgKiBAcmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyBzdWNjZXNzIG9yIGZhaWx1cmUuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIF92ZXJpZnlOb1NoYWxsb3dSZXBvc2l0b3J5KCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGlmICh0aGlzLl9naXQuaXNTaGFsbG93UmVwbygpKSB7XG4gICAgICBMb2cuZXJyb3IoJyAg4pyYICAgVGhlIGxvY2FsIHJlcG9zaXRvcnkgaXMgY29uZmlndXJlZCBhcyBzaGFsbG93LicpO1xuICAgICAgTG9nLmVycm9yKGAgICAgICBQbGVhc2UgY29udmVydCB0aGUgcmVwb3NpdG9yeSB0byBhIGNvbXBsZXRlIG9uZSBieSBzeW5jaW5nIHdpdGggdXBzdHJlYW0uYCk7XG4gICAgICBMb2cuZXJyb3IoYCAgICAgIGh0dHBzOi8vZ2l0LXNjbS5jb20vZG9jcy9naXQtZmV0Y2gjRG9jdW1lbnRhdGlvbi9naXQtZmV0Y2gudHh0LS0tdW5zaGFsbG93YCk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIFZlcmlmaWVzIHRoYXQgdGhlIG5leHQgYnJhbmNoIGZyb20gdGhlIGNvbmZpZ3VyZWQgcmVwb3NpdG9yeSBpcyBjaGVja2VkIG91dC5cbiAgICogQHJldHVybnMgYSBib29sZWFuIGluZGljYXRpbmcgc3VjY2VzcyBvciBmYWlsdXJlLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBfdmVyaWZ5UnVubmluZ0Zyb21OZXh0QnJhbmNoKG5leHRCcmFuY2hOYW1lOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBjb25zdCBoZWFkU2hhID0gdGhpcy5fZ2l0LnJ1bihbJ3Jldi1wYXJzZScsICdIRUFEJ10pLnN0ZG91dC50cmltKCk7XG4gICAgY29uc3Qge2RhdGF9ID0gYXdhaXQgdGhpcy5fZ2l0LmdpdGh1Yi5yZXBvcy5nZXRCcmFuY2goe1xuICAgICAgLi4udGhpcy5fZ2l0LnJlbW90ZVBhcmFtcyxcbiAgICAgIGJyYW5jaDogdGhpcy5fZ2l0Lm1haW5CcmFuY2hOYW1lLFxuICAgIH0pO1xuXG4gICAgaWYgKGhlYWRTaGEgIT09IGRhdGEuY29tbWl0LnNoYSkge1xuICAgICAgTG9nLmVycm9yKCcgIOKcmCAgIFJ1bm5pbmcgcmVsZWFzZSB0b29sIGZyb20gYW4gb3V0ZGF0ZWQgbG9jYWwgYnJhbmNoLicpO1xuICAgICAgTG9nLmVycm9yKGAgICAgICBQbGVhc2UgbWFrZSBzdXJlIHlvdSBhcmUgcnVubmluZyBmcm9tIHRoZSBcIiR7bmV4dEJyYW5jaE5hbWV9XCIgYnJhbmNoLmApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBWZXJpZmllcyB0aGF0IHRoZSB1c2VyIGlzIGxvZ2dlZCBpbnRvIE5QTSBhdCB0aGUgY29ycmVjdCByZWdpc3RyeSwgaWYgZGVmaW5lZCBmb3IgdGhlIHJlbGVhc2UuXG4gICAqIEByZXR1cm5zIGEgYm9vbGVhbiBpbmRpY2F0aW5nIHdoZXRoZXIgdGhlIHVzZXIgaXMgbG9nZ2VkIGludG8gTlBNLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBfdmVyaWZ5TnBtTG9naW5TdGF0ZSgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBjb25zdCByZWdpc3RyeSA9IGBOUE0gYXQgdGhlICR7dGhpcy5fY29uZmlnLnB1Ymxpc2hSZWdpc3RyeSA/PyAnZGVmYXVsdCBOUE0nfSByZWdpc3RyeWA7XG4gICAgLy8gVE9ETyhqb3NlcGhwZXJyb3R0KTogcmVtb3ZlIHdvbWJhdCBzcGVjaWZpYyBibG9jayBvbmNlIHdvbWJvdCBhbGxvd3MgYG5wbSB3aG9hbWlgIGNoZWNrIHRvXG4gICAgLy8gY2hlY2sgdGhlIHN0YXR1cyBvZiB0aGUgbG9jYWwgdG9rZW4gaW4gdGhlIC5ucG1yYyBmaWxlLlxuICAgIGlmICh0aGlzLl9jb25maWcucHVibGlzaFJlZ2lzdHJ5Py5pbmNsdWRlcygnd29tYmF0LWRyZXNzaW5nLXJvb20uYXBwc3BvdC5jb20nKSkge1xuICAgICAgTG9nLmluZm8oJ1VuYWJsZSB0byBkZXRlcm1pbmUgTlBNIGxvZ2luIHN0YXRlIGZvciB3b21iYXQgcHJveHksIHJlcXVpcmluZyBsb2dpbiBub3cuJyk7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBOcG1Db21tYW5kLnN0YXJ0SW50ZXJhY3RpdmVMb2dpbih0aGlzLl9jb25maWcucHVibGlzaFJlZ2lzdHJ5KTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGF3YWl0IE5wbUNvbW1hbmQuY2hlY2tJc0xvZ2dlZEluKHRoaXMuX2NvbmZpZy5wdWJsaXNoUmVnaXN0cnkpKSB7XG4gICAgICBMb2cuZGVidWcoYEFscmVhZHkgbG9nZ2VkIGludG8gJHtyZWdpc3RyeX0uYCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgTG9nLndhcm4oYCAg4pyYICAgTm90IGN1cnJlbnRseSBsb2dnZWQgaW50byAke3JlZ2lzdHJ5fS5gKTtcbiAgICBjb25zdCBzaG91bGRMb2dpbiA9IGF3YWl0IFByb21wdC5jb25maXJtKCdXb3VsZCB5b3UgbGlrZSB0byBsb2cgaW50byBOUE0gbm93PycpO1xuICAgIGlmIChzaG91bGRMb2dpbikge1xuICAgICAgTG9nLmRlYnVnKCdTdGFydGluZyBOUE0gbG9naW4uJyk7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBOcG1Db21tYW5kLnN0YXJ0SW50ZXJhY3RpdmVMb2dpbih0aGlzLl9jb25maWcucHVibGlzaFJlZ2lzdHJ5KTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG4iXX0=