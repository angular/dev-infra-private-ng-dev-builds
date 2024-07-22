/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
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
        const releaseAction = await Prompt.select({
            message: 'Please select an action:',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9wdWJsaXNoL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUtILE9BQU8sRUFBQyxtQkFBbUIsRUFBQyxNQUFNLHdDQUF3QyxDQUFDO0FBQzNFLE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUN4RCxPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSxzQ0FBc0MsQ0FBQztBQUM5RSxPQUFPLEVBQUMsaUJBQWlCLEVBQXFCLE1BQU0sbUNBQW1DLENBQUM7QUFHeEYsT0FBTyxFQUFDLHVCQUF1QixFQUFFLDZCQUE2QixFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDMUYsT0FBTyxFQUFDLE9BQU8sRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQzNDLE9BQU8sRUFBQyx5QkFBeUIsRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBQ3ZFLE9BQU8sRUFBQyxHQUFHLEVBQUUsTUFBTSxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDbkQsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBRTdDLE1BQU0sQ0FBTixJQUFZLGVBSVg7QUFKRCxXQUFZLGVBQWU7SUFDekIsMkRBQU8sQ0FBQTtJQUNQLG1FQUFXLENBQUE7SUFDWCw2RUFBZ0IsQ0FBQTtBQUNsQixDQUFDLEVBSlcsZUFBZSxLQUFmLGVBQWUsUUFJMUI7QUFFRCxNQUFNLE9BQU8sV0FBVztJQUl0QixZQUNZLElBQTRCLEVBQzVCLE9BQXNCLEVBQ3RCLE9BQXFCLEVBQ3JCLFlBQW9CO1FBSHBCLFNBQUksR0FBSixJQUFJLENBQXdCO1FBQzVCLFlBQU8sR0FBUCxPQUFPLENBQWU7UUFDdEIsWUFBTyxHQUFQLE9BQU8sQ0FBYztRQUNyQixpQkFBWSxHQUFaLFlBQVksQ0FBUTtRQVBoQyw2RUFBNkU7UUFDckUsZ0NBQTJC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QUssQ0FBQztJQUNmLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0dpdGh1YkNvbmZpZ30gZnJvbSAnLi4vLi4vdXRpbHMvY29uZmlnLmpzJztcbmltcG9ydCB7QXV0aGVudGljYXRlZEdpdENsaWVudH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2F1dGhlbnRpY2F0ZWQtZ2l0LWNsaWVudC5qcyc7XG5pbXBvcnQge1JlbGVhc2VDb25maWd9IGZyb20gJy4uL2NvbmZpZy9pbmRleC5qcyc7XG5pbXBvcnQge0FjdGl2ZVJlbGVhc2VUcmFpbnN9IGZyb20gJy4uL3ZlcnNpb25pbmcvYWN0aXZlLXJlbGVhc2UtdHJhaW5zLmpzJztcbmltcG9ydCB7TnBtQ29tbWFuZH0gZnJvbSAnLi4vdmVyc2lvbmluZy9ucG0tY29tbWFuZC5qcyc7XG5pbXBvcnQge3ByaW50QWN0aXZlUmVsZWFzZVRyYWluc30gZnJvbSAnLi4vdmVyc2lvbmluZy9wcmludC1hY3RpdmUtdHJhaW5zLmpzJztcbmltcG9ydCB7Z2V0TmV4dEJyYW5jaE5hbWUsIFJlbGVhc2VSZXBvV2l0aEFwaX0gZnJvbSAnLi4vdmVyc2lvbmluZy92ZXJzaW9uLWJyYW5jaGVzLmpzJztcblxuaW1wb3J0IHtSZWxlYXNlQWN0aW9ufSBmcm9tICcuL2FjdGlvbnMuanMnO1xuaW1wb3J0IHtGYXRhbFJlbGVhc2VBY3Rpb25FcnJvciwgVXNlckFib3J0ZWRSZWxlYXNlQWN0aW9uRXJyb3J9IGZyb20gJy4vYWN0aW9ucy1lcnJvci5qcyc7XG5pbXBvcnQge2FjdGlvbnN9IGZyb20gJy4vYWN0aW9ucy9pbmRleC5qcyc7XG5pbXBvcnQge3ZlcmlmeU5nRGV2VG9vbElzVXBUb0RhdGV9IGZyb20gJy4uLy4uL3V0aWxzL3ZlcnNpb24tY2hlY2suanMnO1xuaW1wb3J0IHtMb2csIHllbGxvd30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge1Byb21wdH0gZnJvbSAnLi4vLi4vdXRpbHMvcHJvbXB0LmpzJztcblxuZXhwb3J0IGVudW0gQ29tcGxldGlvblN0YXRlIHtcbiAgU1VDQ0VTUyxcbiAgRkFUQUxfRVJST1IsXG4gIE1BTlVBTExZX0FCT1JURUQsXG59XG5cbmV4cG9ydCBjbGFzcyBSZWxlYXNlVG9vbCB7XG4gIC8qKiBUaGUgcHJldmlvdXMgZ2l0IGNvbW1pdCB0byByZXR1cm4gYmFjayB0byBhZnRlciB0aGUgcmVsZWFzZSB0b29sIHJ1bnMuICovXG4gIHByaXZhdGUgcHJldmlvdXNHaXRCcmFuY2hPclJldmlzaW9uID0gdGhpcy5fZ2l0LmdldEN1cnJlbnRCcmFuY2hPclJldmlzaW9uKCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJvdGVjdGVkIF9naXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4gICAgcHJvdGVjdGVkIF9jb25maWc6IFJlbGVhc2VDb25maWcsXG4gICAgcHJvdGVjdGVkIF9naXRodWI6IEdpdGh1YkNvbmZpZyxcbiAgICBwcm90ZWN0ZWQgX3Byb2plY3RSb290OiBzdHJpbmcsXG4gICkge31cblxuICAvKiogUnVucyB0aGUgaW50ZXJhY3RpdmUgcmVsZWFzZSB0b29sLiAqL1xuICBhc3luYyBydW4oKTogUHJvbWlzZTxDb21wbGV0aW9uU3RhdGU+IHtcbiAgICBMb2cuaW5mbygpO1xuICAgIExvZy5pbmZvKHllbGxvdygnLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0nKSk7XG4gICAgTG9nLmluZm8oeWVsbG93KCcgIEFuZ3VsYXIgRGV2LUluZnJhIHJlbGVhc2Ugc3RhZ2luZyBzY3JpcHQnKSk7XG4gICAgTG9nLmluZm8oeWVsbG93KCctLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLScpKTtcbiAgICBMb2cuaW5mbygpO1xuXG4gICAgY29uc3Qge293bmVyLCBuYW1lfSA9IHRoaXMuX2dpdGh1YjtcbiAgICBjb25zdCBuZXh0QnJhbmNoTmFtZSA9IGdldE5leHRCcmFuY2hOYW1lKHRoaXMuX2dpdGh1Yik7XG5cbiAgICBpZiAoXG4gICAgICAhKGF3YWl0IHRoaXMuX3ZlcmlmeU5vVW5jb21taXR0ZWRDaGFuZ2VzKCkpIHx8XG4gICAgICAhKGF3YWl0IHRoaXMuX3ZlcmlmeVJ1bm5pbmdGcm9tTmV4dEJyYW5jaChuZXh0QnJhbmNoTmFtZSkpIHx8XG4gICAgICAhKGF3YWl0IHRoaXMuX3ZlcmlmeU5vU2hhbGxvd1JlcG9zaXRvcnkoKSkgfHxcbiAgICAgICEoYXdhaXQgdmVyaWZ5TmdEZXZUb29sSXNVcFRvRGF0ZSh0aGlzLl9wcm9qZWN0Um9vdCkpXG4gICAgKSB7XG4gICAgICByZXR1cm4gQ29tcGxldGlvblN0YXRlLkZBVEFMX0VSUk9SO1xuICAgIH1cblxuICAgIGlmICghKGF3YWl0IHRoaXMuX3ZlcmlmeU5wbUxvZ2luU3RhdGUoKSkpIHtcbiAgICAgIHJldHVybiBDb21wbGV0aW9uU3RhdGUuTUFOVUFMTFlfQUJPUlRFRDtcbiAgICB9XG5cbiAgICAvLyBTZXQgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlIHRvIHNraXAgYWxsIGdpdCBjb21taXQgaG9va3MgdHJpZ2dlcmVkIGJ5IGh1c2t5LiBXZSBhcmUgdW5hYmxlIHRvXG4gICAgLy8gcmVseSBvbiBgLS1uby12ZXJpZnlgIGFzIHNvbWUgaG9va3Mgc3RpbGwgcnVuLCBub3RhYmx5IHRoZSBgcHJlcGFyZS1jb21taXQtbXNnYCBob29rLlxuICAgIC8vIFJ1bm5pbmcgaG9va3MgaGFzIHRoZSBkb3duc2lkZSBvZiBwb3RlbnRpYWxseSBydW5uaW5nIGNvZGUgKGxpa2UgdGhlIGBuZy1kZXZgIHRvb2wpIHdoZW4gYSB2ZXJzaW9uXG4gICAgLy8gYnJhbmNoIGlzIGNoZWNrZWQgb3V0LCBidXQgdGhlIG5vZGUgbW9kdWxlcyBhcmUgbm90IHJlLWluc3RhbGxlZC4gVGhlIHRvb2wgc3dpdGNoZXMgYnJhbmNoZXNcbiAgICAvLyBtdWx0aXBsZSB0aW1lcyBwZXIgZXhlY3V0aW9uLCBhbmQgaXQgaXMgbm90IGRlc2lyYWJsZSByZS1ydW5uaW5nIFlhcm4gYWxsIHRoZSB0aW1lLlxuICAgIHByb2Nlc3MuZW52WydIVVNLWSddID0gJzAnO1xuXG4gICAgY29uc3QgcmVwbzogUmVsZWFzZVJlcG9XaXRoQXBpID0ge293bmVyLCBuYW1lLCBhcGk6IHRoaXMuX2dpdC5naXRodWIsIG5leHRCcmFuY2hOYW1lfTtcbiAgICBjb25zdCByZWxlYXNlVHJhaW5zID0gYXdhaXQgQWN0aXZlUmVsZWFzZVRyYWlucy5mZXRjaChyZXBvKTtcblxuICAgIC8vIFByaW50IHRoZSBhY3RpdmUgcmVsZWFzZSB0cmFpbnMgc28gdGhhdCB0aGUgY2FyZXRha2VyIGNhbiBhY2Nlc3NcbiAgICAvLyB0aGUgY3VycmVudCBwcm9qZWN0IGJyYW5jaGluZyBzdGF0ZSB3aXRob3V0IHN3aXRjaGluZyBjb250ZXh0LlxuICAgIGF3YWl0IHByaW50QWN0aXZlUmVsZWFzZVRyYWlucyhyZWxlYXNlVHJhaW5zLCB0aGlzLl9jb25maWcpO1xuXG4gICAgY29uc3QgYWN0aW9uID0gYXdhaXQgdGhpcy5fcHJvbXB0Rm9yUmVsZWFzZUFjdGlvbihyZWxlYXNlVHJhaW5zKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBhY3Rpb24ucGVyZm9ybSgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgVXNlckFib3J0ZWRSZWxlYXNlQWN0aW9uRXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIENvbXBsZXRpb25TdGF0ZS5NQU5VQUxMWV9BQk9SVEVEO1xuICAgICAgfVxuICAgICAgLy8gT25seSBwcmludCB0aGUgZXJyb3IgbWVzc2FnZSBhbmQgc3RhY2sgaWYgdGhlIGVycm9yIGlzIG5vdCBhIGtub3duIGZhdGFsIHJlbGVhc2VcbiAgICAgIC8vIGFjdGlvbiBlcnJvciAoZm9yIHdoaWNoIHdlIHByaW50IHRoZSBlcnJvciBncmFjZWZ1bGx5IHRvIHRoZSBjb25zb2xlIHdpdGggY29sb3JzKS5cbiAgICAgIGlmICghKGUgaW5zdGFuY2VvZiBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcikgJiYgZSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gQ29tcGxldGlvblN0YXRlLkZBVEFMX0VSUk9SO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBhd2FpdCB0aGlzLmNsZWFudXAoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gQ29tcGxldGlvblN0YXRlLlNVQ0NFU1M7XG4gIH1cblxuICAvKiogUnVuIHBvc3QgcmVsZWFzZSB0b29sIGNsZWFudXBzLiAqL1xuICBwcml2YXRlIGFzeW5jIGNsZWFudXAoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gUmV0dXJuIGJhY2sgdG8gdGhlIGdpdCBzdGF0ZSBmcm9tIGJlZm9yZSB0aGUgcmVsZWFzZSB0b29sIHJhbi5cbiAgICB0aGlzLl9naXQuY2hlY2tvdXQodGhpcy5wcmV2aW91c0dpdEJyYW5jaE9yUmV2aXNpb24sIHRydWUpO1xuICAgIC8vIEVuc3VyZSBsb2cgb3V0IG9mIE5QTS5cbiAgICBhd2FpdCBOcG1Db21tYW5kLmxvZ291dCh0aGlzLl9jb25maWcucHVibGlzaFJlZ2lzdHJ5KTtcbiAgfVxuXG4gIC8qKiBQcm9tcHRzIHRoZSBjYXJldGFrZXIgZm9yIGEgcmVsZWFzZSBhY3Rpb24gdGhhdCBzaG91bGQgYmUgcGVyZm9ybWVkLiAqL1xuICBwcml2YXRlIGFzeW5jIF9wcm9tcHRGb3JSZWxlYXNlQWN0aW9uKGFjdGl2ZVRyYWluczogQWN0aXZlUmVsZWFzZVRyYWlucykge1xuICAgIGNvbnN0IGNob2ljZXM6IHtuYW1lOiBzdHJpbmc7IHZhbHVlOiBSZWxlYXNlQWN0aW9ufVtdID0gW107XG5cbiAgICAvLyBGaW5kIGFuZCBpbnN0YW50aWF0ZSBhbGwgcmVsZWFzZSBhY3Rpb25zIHdoaWNoIGFyZSBjdXJyZW50bHkgdmFsaWQuXG4gICAgZm9yIChsZXQgYWN0aW9uVHlwZSBvZiBhY3Rpb25zKSB7XG4gICAgICBpZiAoYXdhaXQgYWN0aW9uVHlwZS5pc0FjdGl2ZShhY3RpdmVUcmFpbnMsIHRoaXMuX2NvbmZpZykpIHtcbiAgICAgICAgY29uc3QgYWN0aW9uOiBSZWxlYXNlQWN0aW9uID0gbmV3IGFjdGlvblR5cGUoXG4gICAgICAgICAgYWN0aXZlVHJhaW5zLFxuICAgICAgICAgIHRoaXMuX2dpdCxcbiAgICAgICAgICB0aGlzLl9jb25maWcsXG4gICAgICAgICAgdGhpcy5fcHJvamVjdFJvb3QsXG4gICAgICAgICk7XG4gICAgICAgIGNob2ljZXMucHVzaCh7bmFtZTogYXdhaXQgYWN0aW9uLmdldERlc2NyaXB0aW9uKCksIHZhbHVlOiBhY3Rpb259KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBMb2cuaW5mbygnUGxlYXNlIHNlbGVjdCB0aGUgdHlwZSBvZiByZWxlYXNlIHlvdSB3YW50IHRvIHBlcmZvcm0uJyk7XG5cbiAgICBjb25zdCByZWxlYXNlQWN0aW9uID0gYXdhaXQgUHJvbXB0LnNlbGVjdDxSZWxlYXNlQWN0aW9uPih7XG4gICAgICBtZXNzYWdlOiAnUGxlYXNlIHNlbGVjdCBhbiBhY3Rpb246JyxcbiAgICAgIGNob2ljZXMsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVsZWFzZUFjdGlvbjtcbiAgfVxuXG4gIC8qKlxuICAgKiBWZXJpZmllcyB0aGF0IHRoZXJlIGFyZSBubyB1bmNvbW1pdHRlZCBjaGFuZ2VzIGluIHRoZSBwcm9qZWN0LlxuICAgKiBAcmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyBzdWNjZXNzIG9yIGZhaWx1cmUuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIF92ZXJpZnlOb1VuY29tbWl0dGVkQ2hhbmdlcygpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBpZiAodGhpcy5fZ2l0Lmhhc1VuY29tbWl0dGVkQ2hhbmdlcygpKSB7XG4gICAgICBMb2cuZXJyb3IoJyAg4pyYICAgVGhlcmUgYXJlIGNoYW5nZXMgd2hpY2ggYXJlIG5vdCBjb21taXR0ZWQgYW5kIHNob3VsZCBiZSBkaXNjYXJkZWQuJyk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIFZlcmlmaWVzIHRoYXQgdGhlIGxvY2FsIHJlcG9zaXRvcnkgaXMgbm90IGNvbmZpZ3VyZWQgYXMgc2hhbGxvdy5cbiAgICogQHJldHVybnMgYSBib29sZWFuIGluZGljYXRpbmcgc3VjY2VzcyBvciBmYWlsdXJlLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBfdmVyaWZ5Tm9TaGFsbG93UmVwb3NpdG9yeSgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBpZiAodGhpcy5fZ2l0LmlzU2hhbGxvd1JlcG8oKSkge1xuICAgICAgTG9nLmVycm9yKCcgIOKcmCAgIFRoZSBsb2NhbCByZXBvc2l0b3J5IGlzIGNvbmZpZ3VyZWQgYXMgc2hhbGxvdy4nKTtcbiAgICAgIExvZy5lcnJvcihgICAgICAgUGxlYXNlIGNvbnZlcnQgdGhlIHJlcG9zaXRvcnkgdG8gYSBjb21wbGV0ZSBvbmUgYnkgc3luY2luZyB3aXRoIHVwc3RyZWFtLmApO1xuICAgICAgTG9nLmVycm9yKGAgICAgICBodHRwczovL2dpdC1zY20uY29tL2RvY3MvZ2l0LWZldGNoI0RvY3VtZW50YXRpb24vZ2l0LWZldGNoLnR4dC0tLXVuc2hhbGxvd2ApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBWZXJpZmllcyB0aGF0IHRoZSBuZXh0IGJyYW5jaCBmcm9tIHRoZSBjb25maWd1cmVkIHJlcG9zaXRvcnkgaXMgY2hlY2tlZCBvdXQuXG4gICAqIEByZXR1cm5zIGEgYm9vbGVhbiBpbmRpY2F0aW5nIHN1Y2Nlc3Mgb3IgZmFpbHVyZS5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgX3ZlcmlmeVJ1bm5pbmdGcm9tTmV4dEJyYW5jaChuZXh0QnJhbmNoTmFtZTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgaGVhZFNoYSA9IHRoaXMuX2dpdC5ydW4oWydyZXYtcGFyc2UnLCAnSEVBRCddKS5zdGRvdXQudHJpbSgpO1xuICAgIGNvbnN0IHtkYXRhfSA9IGF3YWl0IHRoaXMuX2dpdC5naXRodWIucmVwb3MuZ2V0QnJhbmNoKHtcbiAgICAgIC4uLnRoaXMuX2dpdC5yZW1vdGVQYXJhbXMsXG4gICAgICBicmFuY2g6IHRoaXMuX2dpdC5tYWluQnJhbmNoTmFtZSxcbiAgICB9KTtcblxuICAgIGlmIChoZWFkU2hhICE9PSBkYXRhLmNvbW1pdC5zaGEpIHtcbiAgICAgIExvZy5lcnJvcignICDinJggICBSdW5uaW5nIHJlbGVhc2UgdG9vbCBmcm9tIGFuIG91dGRhdGVkIGxvY2FsIGJyYW5jaC4nKTtcbiAgICAgIExvZy5lcnJvcihgICAgICAgUGxlYXNlIG1ha2Ugc3VyZSB5b3UgYXJlIHJ1bm5pbmcgZnJvbSB0aGUgXCIke25leHRCcmFuY2hOYW1lfVwiIGJyYW5jaC5gKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKipcbiAgICogVmVyaWZpZXMgdGhhdCB0aGUgdXNlciBpcyBsb2dnZWQgaW50byBOUE0gYXQgdGhlIGNvcnJlY3QgcmVnaXN0cnksIGlmIGRlZmluZWQgZm9yIHRoZSByZWxlYXNlLlxuICAgKiBAcmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyB3aGV0aGVyIHRoZSB1c2VyIGlzIGxvZ2dlZCBpbnRvIE5QTS5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgX3ZlcmlmeU5wbUxvZ2luU3RhdGUoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgcmVnaXN0cnkgPSBgTlBNIGF0IHRoZSAke3RoaXMuX2NvbmZpZy5wdWJsaXNoUmVnaXN0cnkgPz8gJ2RlZmF1bHQgTlBNJ30gcmVnaXN0cnlgO1xuICAgIC8vIFRPRE8oam9zZXBocGVycm90dCk6IHJlbW92ZSB3b21iYXQgc3BlY2lmaWMgYmxvY2sgb25jZSB3b21ib3QgYWxsb3dzIGBucG0gd2hvYW1pYCBjaGVjayB0b1xuICAgIC8vIGNoZWNrIHRoZSBzdGF0dXMgb2YgdGhlIGxvY2FsIHRva2VuIGluIHRoZSAubnBtcmMgZmlsZS5cbiAgICBpZiAodGhpcy5fY29uZmlnLnB1Ymxpc2hSZWdpc3RyeT8uaW5jbHVkZXMoJ3dvbWJhdC1kcmVzc2luZy1yb29tLmFwcHNwb3QuY29tJykpIHtcbiAgICAgIExvZy5pbmZvKCdVbmFibGUgdG8gZGV0ZXJtaW5lIE5QTSBsb2dpbiBzdGF0ZSBmb3Igd29tYmF0IHByb3h5LCByZXF1aXJpbmcgbG9naW4gbm93LicpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgTnBtQ29tbWFuZC5zdGFydEludGVyYWN0aXZlTG9naW4odGhpcy5fY29uZmlnLnB1Ymxpc2hSZWdpc3RyeSk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmIChhd2FpdCBOcG1Db21tYW5kLmNoZWNrSXNMb2dnZWRJbih0aGlzLl9jb25maWcucHVibGlzaFJlZ2lzdHJ5KSkge1xuICAgICAgTG9nLmRlYnVnKGBBbHJlYWR5IGxvZ2dlZCBpbnRvICR7cmVnaXN0cnl9LmApO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIExvZy53YXJuKGAgIOKcmCAgIE5vdCBjdXJyZW50bHkgbG9nZ2VkIGludG8gJHtyZWdpc3RyeX0uYCk7XG4gICAgY29uc3Qgc2hvdWxkTG9naW4gPSBhd2FpdCBQcm9tcHQuY29uZmlybSh7bWVzc2FnZTogJ1dvdWxkIHlvdSBsaWtlIHRvIGxvZyBpbnRvIE5QTSBub3c/J30pO1xuICAgIGlmIChzaG91bGRMb2dpbikge1xuICAgICAgTG9nLmRlYnVnKCdTdGFydGluZyBOUE0gbG9naW4uJyk7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBOcG1Db21tYW5kLnN0YXJ0SW50ZXJhY3RpdmVMb2dpbih0aGlzLl9jb25maWcucHVibGlzaFJlZ2lzdHJ5KTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG4iXX0=