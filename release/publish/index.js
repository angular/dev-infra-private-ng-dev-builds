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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9wdWJsaXNoL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sUUFBNkIsTUFBTSxVQUFVLENBQUM7QUFLckQsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sd0NBQXdDLENBQUM7QUFDM0UsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBQ3hELE9BQU8sRUFBQyx3QkFBd0IsRUFBQyxNQUFNLHNDQUFzQyxDQUFDO0FBQzlFLE9BQU8sRUFBQyxpQkFBaUIsRUFBcUIsTUFBTSxtQ0FBbUMsQ0FBQztBQUd4RixPQUFPLEVBQUMsdUJBQXVCLEVBQUUsNkJBQTZCLEVBQUMsTUFBTSxvQkFBb0IsQ0FBQztBQUMxRixPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDM0MsT0FBTyxFQUFDLHlCQUF5QixFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDdkUsT0FBTyxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNuRCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sdUJBQXVCLENBQUM7QUFFN0MsTUFBTSxDQUFOLElBQVksZUFJWDtBQUpELFdBQVksZUFBZTtJQUN6QiwyREFBTyxDQUFBO0lBQ1AsbUVBQVcsQ0FBQTtJQUNYLDZFQUFnQixDQUFBO0FBQ2xCLENBQUMsRUFKVyxlQUFlLEtBQWYsZUFBZSxRQUkxQjtBQUVELE1BQU0sT0FBTyxXQUFXO0lBSXRCLFlBQ1ksSUFBNEIsRUFDNUIsT0FBc0IsRUFDdEIsT0FBcUIsRUFDckIsWUFBb0I7UUFIcEIsU0FBSSxHQUFKLElBQUksQ0FBd0I7UUFDNUIsWUFBTyxHQUFQLE9BQU8sQ0FBZTtRQUN0QixZQUFPLEdBQVAsT0FBTyxDQUFjO1FBQ3JCLGlCQUFZLEdBQVosWUFB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LEtBQUssQ0FBQztZQUNmLENBQUM7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDRCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgaW5xdWlyZXIsIHtMaXN0Q2hvaWNlT3B0aW9uc30gZnJvbSAnaW5xdWlyZXInO1xuXG5pbXBvcnQge0dpdGh1YkNvbmZpZ30gZnJvbSAnLi4vLi4vdXRpbHMvY29uZmlnLmpzJztcbmltcG9ydCB7QXV0aGVudGljYXRlZEdpdENsaWVudH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2F1dGhlbnRpY2F0ZWQtZ2l0LWNsaWVudC5qcyc7XG5pbXBvcnQge1JlbGVhc2VDb25maWd9IGZyb20gJy4uL2NvbmZpZy9pbmRleC5qcyc7XG5pbXBvcnQge0FjdGl2ZVJlbGVhc2VUcmFpbnN9IGZyb20gJy4uL3ZlcnNpb25pbmcvYWN0aXZlLXJlbGVhc2UtdHJhaW5zLmpzJztcbmltcG9ydCB7TnBtQ29tbWFuZH0gZnJvbSAnLi4vdmVyc2lvbmluZy9ucG0tY29tbWFuZC5qcyc7XG5pbXBvcnQge3ByaW50QWN0aXZlUmVsZWFzZVRyYWluc30gZnJvbSAnLi4vdmVyc2lvbmluZy9wcmludC1hY3RpdmUtdHJhaW5zLmpzJztcbmltcG9ydCB7Z2V0TmV4dEJyYW5jaE5hbWUsIFJlbGVhc2VSZXBvV2l0aEFwaX0gZnJvbSAnLi4vdmVyc2lvbmluZy92ZXJzaW9uLWJyYW5jaGVzLmpzJztcblxuaW1wb3J0IHtSZWxlYXNlQWN0aW9ufSBmcm9tICcuL2FjdGlvbnMuanMnO1xuaW1wb3J0IHtGYXRhbFJlbGVhc2VBY3Rpb25FcnJvciwgVXNlckFib3J0ZWRSZWxlYXNlQWN0aW9uRXJyb3J9IGZyb20gJy4vYWN0aW9ucy1lcnJvci5qcyc7XG5pbXBvcnQge2FjdGlvbnN9IGZyb20gJy4vYWN0aW9ucy9pbmRleC5qcyc7XG5pbXBvcnQge3ZlcmlmeU5nRGV2VG9vbElzVXBUb0RhdGV9IGZyb20gJy4uLy4uL3V0aWxzL3ZlcnNpb24tY2hlY2suanMnO1xuaW1wb3J0IHtMb2csIHllbGxvd30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge1Byb21wdH0gZnJvbSAnLi4vLi4vdXRpbHMvcHJvbXB0LmpzJztcblxuZXhwb3J0IGVudW0gQ29tcGxldGlvblN0YXRlIHtcbiAgU1VDQ0VTUyxcbiAgRkFUQUxfRVJST1IsXG4gIE1BTlVBTExZX0FCT1JURUQsXG59XG5cbmV4cG9ydCBjbGFzcyBSZWxlYXNlVG9vbCB7XG4gIC8qKiBUaGUgcHJldmlvdXMgZ2l0IGNvbW1pdCB0byByZXR1cm4gYmFjayB0byBhZnRlciB0aGUgcmVsZWFzZSB0b29sIHJ1bnMuICovXG4gIHByaXZhdGUgcHJldmlvdXNHaXRCcmFuY2hPclJldmlzaW9uID0gdGhpcy5fZ2l0LmdldEN1cnJlbnRCcmFuY2hPclJldmlzaW9uKCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJvdGVjdGVkIF9naXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4gICAgcHJvdGVjdGVkIF9jb25maWc6IFJlbGVhc2VDb25maWcsXG4gICAgcHJvdGVjdGVkIF9naXRodWI6IEdpdGh1YkNvbmZpZyxcbiAgICBwcm90ZWN0ZWQgX3Byb2plY3RSb290OiBzdHJpbmcsXG4gICkge31cblxuICAvKiogUnVucyB0aGUgaW50ZXJhY3RpdmUgcmVsZWFzZSB0b29sLiAqL1xuICBhc3luYyBydW4oKTogUHJvbWlzZTxDb21wbGV0aW9uU3RhdGU+IHtcbiAgICBMb2cuaW5mbygpO1xuICAgIExvZy5pbmZvKHllbGxvdygnLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0nKSk7XG4gICAgTG9nLmluZm8oeWVsbG93KCcgIEFuZ3VsYXIgRGV2LUluZnJhIHJlbGVhc2Ugc3RhZ2luZyBzY3JpcHQnKSk7XG4gICAgTG9nLmluZm8oeWVsbG93KCctLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLScpKTtcbiAgICBMb2cuaW5mbygpO1xuXG4gICAgY29uc3Qge293bmVyLCBuYW1lfSA9IHRoaXMuX2dpdGh1YjtcbiAgICBjb25zdCBuZXh0QnJhbmNoTmFtZSA9IGdldE5leHRCcmFuY2hOYW1lKHRoaXMuX2dpdGh1Yik7XG5cbiAgICBpZiAoXG4gICAgICAhKGF3YWl0IHRoaXMuX3ZlcmlmeU5vVW5jb21taXR0ZWRDaGFuZ2VzKCkpIHx8XG4gICAgICAhKGF3YWl0IHRoaXMuX3ZlcmlmeVJ1bm5pbmdGcm9tTmV4dEJyYW5jaChuZXh0QnJhbmNoTmFtZSkpIHx8XG4gICAgICAhKGF3YWl0IHRoaXMuX3ZlcmlmeU5vU2hhbGxvd1JlcG9zaXRvcnkoKSkgfHxcbiAgICAgICEoYXdhaXQgdmVyaWZ5TmdEZXZUb29sSXNVcFRvRGF0ZSh0aGlzLl9wcm9qZWN0Um9vdCkpXG4gICAgKSB7XG4gICAgICByZXR1cm4gQ29tcGxldGlvblN0YXRlLkZBVEFMX0VSUk9SO1xuICAgIH1cblxuICAgIGlmICghKGF3YWl0IHRoaXMuX3ZlcmlmeU5wbUxvZ2luU3RhdGUoKSkpIHtcbiAgICAgIHJldHVybiBDb21wbGV0aW9uU3RhdGUuTUFOVUFMTFlfQUJPUlRFRDtcbiAgICB9XG5cbiAgICAvLyBTZXQgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlIHRvIHNraXAgYWxsIGdpdCBjb21taXQgaG9va3MgdHJpZ2dlcmVkIGJ5IGh1c2t5LiBXZSBhcmUgdW5hYmxlIHRvXG4gICAgLy8gcmVseSBvbiBgLS1uby12ZXJpZnlgIGFzIHNvbWUgaG9va3Mgc3RpbGwgcnVuLCBub3RhYmx5IHRoZSBgcHJlcGFyZS1jb21taXQtbXNnYCBob29rLlxuICAgIC8vIFJ1bm5pbmcgaG9va3MgaGFzIHRoZSBkb3duc2lkZSBvZiBwb3RlbnRpYWxseSBydW5uaW5nIGNvZGUgKGxpa2UgdGhlIGBuZy1kZXZgIHRvb2wpIHdoZW4gYSB2ZXJzaW9uXG4gICAgLy8gYnJhbmNoIGlzIGNoZWNrZWQgb3V0LCBidXQgdGhlIG5vZGUgbW9kdWxlcyBhcmUgbm90IHJlLWluc3RhbGxlZC4gVGhlIHRvb2wgc3dpdGNoZXMgYnJhbmNoZXNcbiAgICAvLyBtdWx0aXBsZSB0aW1lcyBwZXIgZXhlY3V0aW9uLCBhbmQgaXQgaXMgbm90IGRlc2lyYWJsZSByZS1ydW5uaW5nIFlhcm4gYWxsIHRoZSB0aW1lLlxuICAgIHByb2Nlc3MuZW52WydIVVNLWSddID0gJzAnO1xuXG4gICAgY29uc3QgcmVwbzogUmVsZWFzZVJlcG9XaXRoQXBpID0ge293bmVyLCBuYW1lLCBhcGk6IHRoaXMuX2dpdC5naXRodWIsIG5leHRCcmFuY2hOYW1lfTtcbiAgICBjb25zdCByZWxlYXNlVHJhaW5zID0gYXdhaXQgQWN0aXZlUmVsZWFzZVRyYWlucy5mZXRjaChyZXBvKTtcblxuICAgIC8vIFByaW50IHRoZSBhY3RpdmUgcmVsZWFzZSB0cmFpbnMgc28gdGhhdCB0aGUgY2FyZXRha2VyIGNhbiBhY2Nlc3NcbiAgICAvLyB0aGUgY3VycmVudCBwcm9qZWN0IGJyYW5jaGluZyBzdGF0ZSB3aXRob3V0IHN3aXRjaGluZyBjb250ZXh0LlxuICAgIGF3YWl0IHByaW50QWN0aXZlUmVsZWFzZVRyYWlucyhyZWxlYXNlVHJhaW5zLCB0aGlzLl9jb25maWcpO1xuXG4gICAgY29uc3QgYWN0aW9uID0gYXdhaXQgdGhpcy5fcHJvbXB0Rm9yUmVsZWFzZUFjdGlvbihyZWxlYXNlVHJhaW5zKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBhY3Rpb24ucGVyZm9ybSgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgVXNlckFib3J0ZWRSZWxlYXNlQWN0aW9uRXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIENvbXBsZXRpb25TdGF0ZS5NQU5VQUxMWV9BQk9SVEVEO1xuICAgICAgfVxuICAgICAgLy8gT25seSBwcmludCB0aGUgZXJyb3IgbWVzc2FnZSBhbmQgc3RhY2sgaWYgdGhlIGVycm9yIGlzIG5vdCBhIGtub3duIGZhdGFsIHJlbGVhc2VcbiAgICAgIC8vIGFjdGlvbiBlcnJvciAoZm9yIHdoaWNoIHdlIHByaW50IHRoZSBlcnJvciBncmFjZWZ1bGx5IHRvIHRoZSBjb25zb2xlIHdpdGggY29sb3JzKS5cbiAgICAgIGlmICghKGUgaW5zdGFuY2VvZiBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcikgJiYgZSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gQ29tcGxldGlvblN0YXRlLkZBVEFMX0VSUk9SO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBhd2FpdCB0aGlzLmNsZWFudXAoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gQ29tcGxldGlvblN0YXRlLlNVQ0NFU1M7XG4gIH1cblxuICAvKiogUnVuIHBvc3QgcmVsZWFzZSB0b29sIGNsZWFudXBzLiAqL1xuICBwcml2YXRlIGFzeW5jIGNsZWFudXAoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gUmV0dXJuIGJhY2sgdG8gdGhlIGdpdCBzdGF0ZSBmcm9tIGJlZm9yZSB0aGUgcmVsZWFzZSB0b29sIHJhbi5cbiAgICB0aGlzLl9naXQuY2hlY2tvdXQodGhpcy5wcmV2aW91c0dpdEJyYW5jaE9yUmV2aXNpb24sIHRydWUpO1xuICAgIC8vIEVuc3VyZSBsb2cgb3V0IG9mIE5QTS5cbiAgICBhd2FpdCBOcG1Db21tYW5kLmxvZ291dCh0aGlzLl9jb25maWcucHVibGlzaFJlZ2lzdHJ5KTtcbiAgfVxuXG4gIC8qKiBQcm9tcHRzIHRoZSBjYXJldGFrZXIgZm9yIGEgcmVsZWFzZSBhY3Rpb24gdGhhdCBzaG91bGQgYmUgcGVyZm9ybWVkLiAqL1xuICBwcml2YXRlIGFzeW5jIF9wcm9tcHRGb3JSZWxlYXNlQWN0aW9uKGFjdGl2ZVRyYWluczogQWN0aXZlUmVsZWFzZVRyYWlucykge1xuICAgIGNvbnN0IGNob2ljZXM6IExpc3RDaG9pY2VPcHRpb25zW10gPSBbXTtcblxuICAgIC8vIEZpbmQgYW5kIGluc3RhbnRpYXRlIGFsbCByZWxlYXNlIGFjdGlvbnMgd2hpY2ggYXJlIGN1cnJlbnRseSB2YWxpZC5cbiAgICBmb3IgKGxldCBhY3Rpb25UeXBlIG9mIGFjdGlvbnMpIHtcbiAgICAgIGlmIChhd2FpdCBhY3Rpb25UeXBlLmlzQWN0aXZlKGFjdGl2ZVRyYWlucywgdGhpcy5fY29uZmlnKSkge1xuICAgICAgICBjb25zdCBhY3Rpb246IFJlbGVhc2VBY3Rpb24gPSBuZXcgYWN0aW9uVHlwZShcbiAgICAgICAgICBhY3RpdmVUcmFpbnMsXG4gICAgICAgICAgdGhpcy5fZ2l0LFxuICAgICAgICAgIHRoaXMuX2NvbmZpZyxcbiAgICAgICAgICB0aGlzLl9wcm9qZWN0Um9vdCxcbiAgICAgICAgKTtcbiAgICAgICAgY2hvaWNlcy5wdXNoKHtuYW1lOiBhd2FpdCBhY3Rpb24uZ2V0RGVzY3JpcHRpb24oKSwgdmFsdWU6IGFjdGlvbn0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIExvZy5pbmZvKCdQbGVhc2Ugc2VsZWN0IHRoZSB0eXBlIG9mIHJlbGVhc2UgeW91IHdhbnQgdG8gcGVyZm9ybS4nKTtcblxuICAgIGNvbnN0IHtyZWxlYXNlQWN0aW9ufSA9IGF3YWl0IGlucXVpcmVyLnByb21wdDx7cmVsZWFzZUFjdGlvbjogUmVsZWFzZUFjdGlvbn0+KHtcbiAgICAgIG5hbWU6ICdyZWxlYXNlQWN0aW9uJyxcbiAgICAgIG1lc3NhZ2U6ICdQbGVhc2Ugc2VsZWN0IGFuIGFjdGlvbjonLFxuICAgICAgdHlwZTogJ2xpc3QnLFxuICAgICAgY2hvaWNlcyxcbiAgICB9KTtcblxuICAgIHJldHVybiByZWxlYXNlQWN0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIFZlcmlmaWVzIHRoYXQgdGhlcmUgYXJlIG5vIHVuY29tbWl0dGVkIGNoYW5nZXMgaW4gdGhlIHByb2plY3QuXG4gICAqIEByZXR1cm5zIGEgYm9vbGVhbiBpbmRpY2F0aW5nIHN1Y2Nlc3Mgb3IgZmFpbHVyZS5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgX3ZlcmlmeU5vVW5jb21taXR0ZWRDaGFuZ2VzKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGlmICh0aGlzLl9naXQuaGFzVW5jb21taXR0ZWRDaGFuZ2VzKCkpIHtcbiAgICAgIExvZy5lcnJvcignICDinJggICBUaGVyZSBhcmUgY2hhbmdlcyB3aGljaCBhcmUgbm90IGNvbW1pdHRlZCBhbmQgc2hvdWxkIGJlIGRpc2NhcmRlZC4nKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKipcbiAgICogVmVyaWZpZXMgdGhhdCB0aGUgbG9jYWwgcmVwb3NpdG9yeSBpcyBub3QgY29uZmlndXJlZCBhcyBzaGFsbG93LlxuICAgKiBAcmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyBzdWNjZXNzIG9yIGZhaWx1cmUuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIF92ZXJpZnlOb1NoYWxsb3dSZXBvc2l0b3J5KCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGlmICh0aGlzLl9naXQuaXNTaGFsbG93UmVwbygpKSB7XG4gICAgICBMb2cuZXJyb3IoJyAg4pyYICAgVGhlIGxvY2FsIHJlcG9zaXRvcnkgaXMgY29uZmlndXJlZCBhcyBzaGFsbG93LicpO1xuICAgICAgTG9nLmVycm9yKGAgICAgICBQbGVhc2UgY29udmVydCB0aGUgcmVwb3NpdG9yeSB0byBhIGNvbXBsZXRlIG9uZSBieSBzeW5jaW5nIHdpdGggdXBzdHJlYW0uYCk7XG4gICAgICBMb2cuZXJyb3IoYCAgICAgIGh0dHBzOi8vZ2l0LXNjbS5jb20vZG9jcy9naXQtZmV0Y2gjRG9jdW1lbnRhdGlvbi9naXQtZmV0Y2gudHh0LS0tdW5zaGFsbG93YCk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIFZlcmlmaWVzIHRoYXQgdGhlIG5leHQgYnJhbmNoIGZyb20gdGhlIGNvbmZpZ3VyZWQgcmVwb3NpdG9yeSBpcyBjaGVja2VkIG91dC5cbiAgICogQHJldHVybnMgYSBib29sZWFuIGluZGljYXRpbmcgc3VjY2VzcyBvciBmYWlsdXJlLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBfdmVyaWZ5UnVubmluZ0Zyb21OZXh0QnJhbmNoKG5leHRCcmFuY2hOYW1lOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBjb25zdCBoZWFkU2hhID0gdGhpcy5fZ2l0LnJ1bihbJ3Jldi1wYXJzZScsICdIRUFEJ10pLnN0ZG91dC50cmltKCk7XG4gICAgY29uc3Qge2RhdGF9ID0gYXdhaXQgdGhpcy5fZ2l0LmdpdGh1Yi5yZXBvcy5nZXRCcmFuY2goe1xuICAgICAgLi4udGhpcy5fZ2l0LnJlbW90ZVBhcmFtcyxcbiAgICAgIGJyYW5jaDogdGhpcy5fZ2l0Lm1haW5CcmFuY2hOYW1lLFxuICAgIH0pO1xuXG4gICAgaWYgKGhlYWRTaGEgIT09IGRhdGEuY29tbWl0LnNoYSkge1xuICAgICAgTG9nLmVycm9yKCcgIOKcmCAgIFJ1bm5pbmcgcmVsZWFzZSB0b29sIGZyb20gYW4gb3V0ZGF0ZWQgbG9jYWwgYnJhbmNoLicpO1xuICAgICAgTG9nLmVycm9yKGAgICAgICBQbGVhc2UgbWFrZSBzdXJlIHlvdSBhcmUgcnVubmluZyBmcm9tIHRoZSBcIiR7bmV4dEJyYW5jaE5hbWV9XCIgYnJhbmNoLmApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBWZXJpZmllcyB0aGF0IHRoZSB1c2VyIGlzIGxvZ2dlZCBpbnRvIE5QTSBhdCB0aGUgY29ycmVjdCByZWdpc3RyeSwgaWYgZGVmaW5lZCBmb3IgdGhlIHJlbGVhc2UuXG4gICAqIEByZXR1cm5zIGEgYm9vbGVhbiBpbmRpY2F0aW5nIHdoZXRoZXIgdGhlIHVzZXIgaXMgbG9nZ2VkIGludG8gTlBNLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBfdmVyaWZ5TnBtTG9naW5TdGF0ZSgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBjb25zdCByZWdpc3RyeSA9IGBOUE0gYXQgdGhlICR7dGhpcy5fY29uZmlnLnB1Ymxpc2hSZWdpc3RyeSA/PyAnZGVmYXVsdCBOUE0nfSByZWdpc3RyeWA7XG4gICAgLy8gVE9ETyhqb3NlcGhwZXJyb3R0KTogcmVtb3ZlIHdvbWJhdCBzcGVjaWZpYyBibG9jayBvbmNlIHdvbWJvdCBhbGxvd3MgYG5wbSB3aG9hbWlgIGNoZWNrIHRvXG4gICAgLy8gY2hlY2sgdGhlIHN0YXR1cyBvZiB0aGUgbG9jYWwgdG9rZW4gaW4gdGhlIC5ucG1yYyBmaWxlLlxuICAgIGlmICh0aGlzLl9jb25maWcucHVibGlzaFJlZ2lzdHJ5Py5pbmNsdWRlcygnd29tYmF0LWRyZXNzaW5nLXJvb20uYXBwc3BvdC5jb20nKSkge1xuICAgICAgTG9nLmluZm8oJ1VuYWJsZSB0byBkZXRlcm1pbmUgTlBNIGxvZ2luIHN0YXRlIGZvciB3b21iYXQgcHJveHksIHJlcXVpcmluZyBsb2dpbiBub3cuJyk7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBOcG1Db21tYW5kLnN0YXJ0SW50ZXJhY3RpdmVMb2dpbih0aGlzLl9jb25maWcucHVibGlzaFJlZ2lzdHJ5KTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGF3YWl0IE5wbUNvbW1hbmQuY2hlY2tJc0xvZ2dlZEluKHRoaXMuX2NvbmZpZy5wdWJsaXNoUmVnaXN0cnkpKSB7XG4gICAgICBMb2cuZGVidWcoYEFscmVhZHkgbG9nZ2VkIGludG8gJHtyZWdpc3RyeX0uYCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgTG9nLndhcm4oYCAg4pyYICAgTm90IGN1cnJlbnRseSBsb2dnZWQgaW50byAke3JlZ2lzdHJ5fS5gKTtcbiAgICBjb25zdCBzaG91bGRMb2dpbiA9IGF3YWl0IFByb21wdC5jb25maXJtKCdXb3VsZCB5b3UgbGlrZSB0byBsb2cgaW50byBOUE0gbm93PycpO1xuICAgIGlmIChzaG91bGRMb2dpbikge1xuICAgICAgTG9nLmRlYnVnKCdTdGFydGluZyBOUE0gbG9naW4uJyk7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBOcG1Db21tYW5kLnN0YXJ0SW50ZXJhY3RpdmVMb2dpbih0aGlzLl9jb25maWcucHVibGlzaFJlZ2lzdHJ5KTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG4iXX0=