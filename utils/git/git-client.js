/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { DryRunError, isDryRun } from '../dry-run.js';
import { assertValidGithubConfig, getConfig } from '../config.js';
import { spawnSync } from 'child_process';
import { Log } from '../logging.js';
import { GithubClient } from './github.js';
import { getRepositoryGitUrl } from './github-urls.js';
import { determineRepoBaseDirFromCwd } from '../repo-directory.js';
/** Error for failed Git commands. */
export class GitCommandError extends Error {
    // Note: Do not expose the unsanitized arguments as a public property. NodeJS
    // could print the properties of an error instance and leak e.g. a token.
    constructor(client, unsanitizedArgs) {
        // Errors are not guaranteed to be caught. To ensure that we don't
        // accidentally leak the Github token that might be used in a command,
        // we sanitize the command that will be part of the error message.
        super(`Command failed: git ${client.sanitizeConsoleOutput(unsanitizedArgs.join(' '))}`);
    }
}
/** Class that can be used to perform Git interactions with a given remote. **/
export class GitClient {
    constructor(
    /** The configuration, containing the github specific configuration. */
    config, 
    /** The full path to the root of the repository base. */
    baseDir = determineRepoBaseDirFromCwd()) {
        this.baseDir = baseDir;
        /** Instance of the Github client. */
        this.github = new GithubClient();
        /**
         * Path to the Git executable. By default, `git` is assumed to exist
         * in the shell environment (using `$PATH`).
         */
        this.gitBinPath = 'git';
        this.config = config;
        this.remoteConfig = config.github;
        this.remoteParams = { owner: config.github.owner, repo: config.github.name };
        this.mainBranchName = config.github.mainBranchName;
    }
    /** Executes the given git command. Throws if the command fails. */
    run(args, options) {
        const result = this.runGraceful(args, options);
        if (result.status !== 0) {
            throw new GitCommandError(this, args);
        }
        // Omit `status` from the type so that it's obvious that the status is never
        // non-zero as explained in the method description.
        return result;
    }
    /**
     * Spawns a given Git command process. Does not throw if the command fails. Additionally,
     * if there is any stderr output, the output will be printed. This makes it easier to
     * info failed commands.
     */
    runGraceful(args, options = {}) {
        /** The git command to be run. */
        const gitCommand = args[0];
        if (isDryRun() && gitCommand === 'push') {
            Log.debug(`"git push" is not able to be run in dryRun mode.`);
            throw new DryRunError();
        }
        // Clear the credential helper that is used, preventing the temporary token from being saved as a
        // valid token for future use.
        args = ['-c', 'credential.helper=', ...args];
        // To improve the debugging experience in case something fails, we print all executed Git
        // commands at the DEBUG level to better understand the git actions occurring.
        // Note that we sanitize the command before printing it to the console. We do not want to
        // print an access token if it is contained in the command. It's common to share errors with
        // others if the tool failed, and we do not want to leak tokens.
        Log.debug('Executing: git', this.sanitizeConsoleOutput(args.join(' ')));
        const result = spawnSync(this.gitBinPath, args, {
            cwd: this.baseDir,
            stdio: 'pipe',
            ...options,
            // Encoding is always `utf8` and not overridable. This ensures that this method
            // always returns `string` as output instead of buffers.
            encoding: 'utf8',
        });
        Log.debug(`Status: ${result.status}, Error: ${!!result.error}, Signal: ${result.signal}`);
        if (result.status !== 0 && result.stderr !== null) {
            // Git sometimes prints the command if it failed. This means that it could
            // potentially leak the Github token used for accessing the remote. To avoid
            // printing a token, we sanitize the string before printing the stderr output.
            process.stderr.write(this.sanitizeConsoleOutput(result.stderr));
        }
        Log.debug('Stdout:', result.stdout);
        Log.debug('Stderr:', result.stderr);
        Log.debug('Process Error:', result.error);
        if (result.error !== undefined) {
            // Git sometimes prints the command if it failed. This means that it could
            // potentially leak the Github token used for accessing the remote. To avoid
            // printing a token, we sanitize the string before printing the stderr output.
            process.stderr.write(this.sanitizeConsoleOutput(result.error.message));
        }
        return result;
    }
    /** Git URL that resolves to the configured repository. */
    getRepoGitUrl() {
        return getRepositoryGitUrl(this.remoteConfig);
    }
    /** Whether the given branch contains the specified SHA. */
    hasCommit(branchName, sha) {
        return this.run(['branch', branchName, '--contains', sha]).stdout !== '';
    }
    /** Whether the local repository is configured as shallow. */
    isShallowRepo() {
        return this.run(['rev-parse', '--is-shallow-repository']).stdout.trim() === 'true';
    }
    /** Gets the currently checked out branch or revision. */
    getCurrentBranchOrRevision() {
        const branchName = this.run(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
        // If no branch name could be resolved. i.e. `HEAD` has been returned, then Git
        // is currently in a detached state. In those cases, we just want to return the
        // currently checked out revision/SHA.
        if (branchName === 'HEAD') {
            return this.run(['rev-parse', 'HEAD']).stdout.trim();
        }
        return branchName;
    }
    /** Gets whether the current Git repository has uncommitted changes. */
    hasUncommittedChanges() {
        // We also need to refresh the index in case some files have been touched
        // but not modified. The diff-index command will not check contents so we
        // manually need to refresh and cleanup the index before performing the diff.
        // Relevant info: https://git-scm.com/docs/git-diff-index#_non_cached_mode,
        // https://git-scm.com/docs/git-update-index and https://stackoverflow.com/a/34808299.
        this.runGraceful(['update-index', '-q', '--refresh']);
        return this.runGraceful(['diff-index', '--quiet', 'HEAD']).status !== 0;
    }
    /**
     * Checks out a requested branch or revision, optionally cleaning the state of the repository
     * before attempting the checking. Returns a boolean indicating whether the branch or revision
     * was cleanly checked out.
     */
    checkout(branchOrRevision, cleanState) {
        if (cleanState) {
            // Abort any outstanding ams.
            this.runGraceful(['am', '--abort'], { stdio: 'ignore' });
            // Abort any outstanding cherry-picks.
            this.runGraceful(['cherry-pick', '--abort'], { stdio: 'ignore' });
            // Abort any outstanding rebases.
            this.runGraceful(['rebase', '--abort'], { stdio: 'ignore' });
            // Clear any changes in the current repo.
            this.runGraceful(['reset', '--hard'], { stdio: 'ignore' });
        }
        return this.runGraceful(['checkout', branchOrRevision], { stdio: 'ignore' }).status === 0;
    }
    /** Retrieve a list of all files in the repository changed since the provided shaOrRef. */
    allChangesFilesSince(shaOrRef = 'HEAD') {
        return Array.from(new Set([
            ...gitOutputAsArray(this.runGraceful(['diff', '--name-only', '--diff-filter=d', shaOrRef])),
            ...gitOutputAsArray(this.runGraceful(['ls-files', '--others', '--exclude-standard'])),
        ]));
    }
    /** Retrieve a list of all files currently staged in the repostitory. */
    allStagedFiles() {
        return gitOutputAsArray(this.runGraceful(['diff', '--name-only', '--diff-filter=ACM', '--staged']));
    }
    /** Retrieve a list of all files tracked in the repository. */
    allFiles() {
        return gitOutputAsArray(this.runGraceful(['ls-files']));
    }
    /**
     * Sanitizes the given console message. This method can be overridden by
     * derived classes. e.g. to sanitize access tokens from Git commands.
     */
    sanitizeConsoleOutput(value) {
        return value;
    }
    /**
     * Static method to get the singleton instance of the `GitClient`,
     * creating it, if not created yet.
     */
    static async get() {
        // If there is no cached instance, create one and cache the promise immediately.
        // This avoids constructing a client twice accidentally when e.g. waiting for the
        // configuration to be loaded.
        if (GitClient._unauthenticatedInstance === null) {
            GitClient._unauthenticatedInstance = (async () => {
                return new GitClient(await getConfig([assertValidGithubConfig]));
            })();
        }
        return GitClient._unauthenticatedInstance;
    }
}
/** The singleton instance of the unauthenticated `GitClient`. */
GitClient._unauthenticatedInstance = null;
/**
 * Takes the output from `run` and `runGraceful` and returns an array of strings for each
 * new line. Git commands typically return multiple output values for a command a set of
 * strings separated by new lines.
 *
 * Note: This is specifically created as a locally available function for usage as convenience
 * utility within `GitClient`'s methods to create outputs as array.
 */
function gitOutputAsArray(gitCommandResult) {
    return gitCommandResult.stdout
        .split('\n')
        .map((x) => x.trim())
        .filter((x) => !!x);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0LWNsaWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi91dGlscy9naXQvZ2l0LWNsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsV0FBVyxFQUFFLFFBQVEsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUNwRCxPQUFPLEVBQWUsdUJBQXVCLEVBQUUsU0FBUyxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBQzlFLE9BQU8sRUFBcUMsU0FBUyxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQzVFLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFbEMsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUN6QyxPQUFPLEVBQUMsbUJBQW1CLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUNyRCxPQUFPLEVBQUMsMkJBQTJCLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUVqRSxxQ0FBcUM7QUFDckMsTUFBTSxPQUFPLGVBQWdCLFNBQVEsS0FBSztJQUN4Qyw2RUFBNkU7SUFDN0UseUVBQXlFO0lBQ3pFLFlBQVksTUFBaUIsRUFBRSxlQUF5QjtRQUN0RCxrRUFBa0U7UUFDbEUsc0VBQXNFO1FBQ3RFLGtFQUFrRTtRQUNsRSxLQUFLLENBQUMsdUJBQXVCLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzFGLENBQUM7Q0FDRjtBQUtELCtFQUErRTtBQUMvRSxNQUFNLE9BQU8sU0FBUztJQXNCcEI7SUFDRSx1RUFBdUU7SUFDdkUsTUFBOEI7SUFDOUIsd0RBQXdEO0lBQy9DLFVBQVUsMkJBQTJCLEVBQUU7UUFBdkMsWUFBTyxHQUFQLE9BQU8sQ0FBZ0M7UUFoQmxELHFDQUFxQztRQUM1QixXQUFNLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQztRQUty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QUMsRUFBRSxDQUFDO1FBQ1AsQ0FBQztRQUVELE9BQU8sU0FBUyxDQUFDLHdCQUF3QixDQUFDO0lBQzVDLENBQUM7O0FBbEJELGlFQUFpRTtBQUNsRCxrQ0FBd0IsR0FBOEIsSUFBSSxBQUFsQyxDQUFtQztBQW9CNUU7Ozs7Ozs7R0FPRztBQUNILFNBQVMsZ0JBQWdCLENBQUMsZ0JBQTBDO0lBQ2xFLE9BQU8sZ0JBQWdCLENBQUMsTUFBTTtTQUMzQixLQUFLLENBQUMsSUFBSSxDQUFDO1NBQ1gsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7U0FDcEIsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0RyeVJ1bkVycm9yLCBpc0RyeVJ1bn0gZnJvbSAnLi4vZHJ5LXJ1bi5qcyc7XG5pbXBvcnQge0dpdGh1YkNvbmZpZywgYXNzZXJ0VmFsaWRHaXRodWJDb25maWcsIGdldENvbmZpZ30gZnJvbSAnLi4vY29uZmlnLmpzJztcbmltcG9ydCB7U3Bhd25TeW5jT3B0aW9ucywgU3Bhd25TeW5jUmV0dXJucywgc3Bhd25TeW5jfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7TG9nfSBmcm9tICcuLi9sb2dnaW5nLmpzJztcblxuaW1wb3J0IHtHaXRodWJDbGllbnR9IGZyb20gJy4vZ2l0aHViLmpzJztcbmltcG9ydCB7Z2V0UmVwb3NpdG9yeUdpdFVybH0gZnJvbSAnLi9naXRodWItdXJscy5qcyc7XG5pbXBvcnQge2RldGVybWluZVJlcG9CYXNlRGlyRnJvbUN3ZH0gZnJvbSAnLi4vcmVwby1kaXJlY3RvcnkuanMnO1xuXG4vKiogRXJyb3IgZm9yIGZhaWxlZCBHaXQgY29tbWFuZHMuICovXG5leHBvcnQgY2xhc3MgR2l0Q29tbWFuZEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICAvLyBOb3RlOiBEbyBub3QgZXhwb3NlIHRoZSB1bnNhbml0aXplZCBhcmd1bWVudHMgYXMgYSBwdWJsaWMgcHJvcGVydHkuIE5vZGVKU1xuICAvLyBjb3VsZCBwcmludCB0aGUgcHJvcGVydGllcyBvZiBhbiBlcnJvciBpbnN0YW5jZSBhbmQgbGVhayBlLmcuIGEgdG9rZW4uXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogR2l0Q2xpZW50LCB1bnNhbml0aXplZEFyZ3M6IHN0cmluZ1tdKSB7XG4gICAgLy8gRXJyb3JzIGFyZSBub3QgZ3VhcmFudGVlZCB0byBiZSBjYXVnaHQuIFRvIGVuc3VyZSB0aGF0IHdlIGRvbid0XG4gICAgLy8gYWNjaWRlbnRhbGx5IGxlYWsgdGhlIEdpdGh1YiB0b2tlbiB0aGF0IG1pZ2h0IGJlIHVzZWQgaW4gYSBjb21tYW5kLFxuICAgIC8vIHdlIHNhbml0aXplIHRoZSBjb21tYW5kIHRoYXQgd2lsbCBiZSBwYXJ0IG9mIHRoZSBlcnJvciBtZXNzYWdlLlxuICAgIHN1cGVyKGBDb21tYW5kIGZhaWxlZDogZ2l0ICR7Y2xpZW50LnNhbml0aXplQ29uc29sZU91dHB1dCh1bnNhbml0aXplZEFyZ3Muam9pbignICcpKX1gKTtcbiAgfVxufVxuXG4vKiogVGhlIG9wdGlvbnMgYXZhaWxhYmxlIGZvciB0aGUgYEdpdENsaWVudGBgcnVuYCBhbmQgYHJ1bkdyYWNlZnVsYCBtZXRob2RzLiAqL1xudHlwZSBHaXRDb21tYW5kUnVuT3B0aW9ucyA9IFNwYXduU3luY09wdGlvbnM7XG5cbi8qKiBDbGFzcyB0aGF0IGNhbiBiZSB1c2VkIHRvIHBlcmZvcm0gR2l0IGludGVyYWN0aW9ucyB3aXRoIGEgZ2l2ZW4gcmVtb3RlLiAqKi9cbmV4cG9ydCBjbGFzcyBHaXRDbGllbnQge1xuICAvKiogU2hvcnQtaGFuZCBmb3IgYWNjZXNzaW5nIHRoZSBkZWZhdWx0IHJlbW90ZSBjb25maWd1cmF0aW9uLiAqL1xuICByZWFkb25seSByZW1vdGVDb25maWc6IEdpdGh1YkNvbmZpZztcblxuICAvKiogT2N0b2tpdCByZXF1ZXN0IHBhcmFtZXRlcnMgb2JqZWN0IGZvciB0YXJnZXRpbmcgdGhlIGNvbmZpZ3VyZWQgcmVtb3RlLiAqL1xuICByZWFkb25seSByZW1vdGVQYXJhbXM6IHtvd25lcjogc3RyaW5nOyByZXBvOiBzdHJpbmd9O1xuXG4gIC8qKiBOYW1lIG9mIHRoZSBwcmltYXJ5IGJyYW5jaCBvZiB0aGUgdXBzdHJlYW0gcmVtb3RlLiAqL1xuICByZWFkb25seSBtYWluQnJhbmNoTmFtZTogc3RyaW5nO1xuXG4gIC8qKiBJbnN0YW5jZSBvZiB0aGUgR2l0aHViIGNsaWVudC4gKi9cbiAgcmVhZG9ubHkgZ2l0aHViID0gbmV3IEdpdGh1YkNsaWVudCgpO1xuXG4gIC8qKiBUaGUgY29uZmlndXJhdGlvbiwgY29udGFpbmluZyB0aGUgZ2l0aHViIHNwZWNpZmljIGNvbmZpZ3VyYXRpb24uICovXG4gIHJlYWRvbmx5IGNvbmZpZzoge2dpdGh1YjogR2l0aHViQ29uZmlnfTtcblxuICAvKipcbiAgICogUGF0aCB0byB0aGUgR2l0IGV4ZWN1dGFibGUuIEJ5IGRlZmF1bHQsIGBnaXRgIGlzIGFzc3VtZWQgdG8gZXhpc3RcbiAgICogaW4gdGhlIHNoZWxsIGVudmlyb25tZW50ICh1c2luZyBgJFBBVEhgKS5cbiAgICovXG4gIHJlYWRvbmx5IGdpdEJpblBhdGg6IHN0cmluZyA9ICdnaXQnO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIC8qKiBUaGUgY29uZmlndXJhdGlvbiwgY29udGFpbmluZyB0aGUgZ2l0aHViIHNwZWNpZmljIGNvbmZpZ3VyYXRpb24uICovXG4gICAgY29uZmlnOiB7Z2l0aHViOiBHaXRodWJDb25maWd9LFxuICAgIC8qKiBUaGUgZnVsbCBwYXRoIHRvIHRoZSByb290IG9mIHRoZSByZXBvc2l0b3J5IGJhc2UuICovXG4gICAgcmVhZG9ubHkgYmFzZURpciA9IGRldGVybWluZVJlcG9CYXNlRGlyRnJvbUN3ZCgpLFxuICApIHtcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcbiAgICB0aGlzLnJlbW90ZUNvbmZpZyA9IGNvbmZpZy5naXRodWI7XG4gICAgdGhpcy5yZW1vdGVQYXJhbXMgPSB7b3duZXI6IGNvbmZpZy5naXRodWIub3duZXIsIHJlcG86IGNvbmZpZy5naXRodWIubmFtZX07XG4gICAgdGhpcy5tYWluQnJhbmNoTmFtZSA9IGNvbmZpZy5naXRodWIubWFpbkJyYW5jaE5hbWU7XG4gIH1cblxuICAvKiogRXhlY3V0ZXMgdGhlIGdpdmVuIGdpdCBjb21tYW5kLiBUaHJvd3MgaWYgdGhlIGNvbW1hbmQgZmFpbHMuICovXG4gIHJ1bihhcmdzOiBzdHJpbmdbXSwgb3B0aW9ucz86IEdpdENvbW1hbmRSdW5PcHRpb25zKTogT21pdDxTcGF3blN5bmNSZXR1cm5zPHN0cmluZz4sICdzdGF0dXMnPiB7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5ydW5HcmFjZWZ1bChhcmdzLCBvcHRpb25zKTtcbiAgICBpZiAocmVzdWx0LnN0YXR1cyAhPT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEdpdENvbW1hbmRFcnJvcih0aGlzLCBhcmdzKTtcbiAgICB9XG4gICAgLy8gT21pdCBgc3RhdHVzYCBmcm9tIHRoZSB0eXBlIHNvIHRoYXQgaXQncyBvYnZpb3VzIHRoYXQgdGhlIHN0YXR1cyBpcyBuZXZlclxuICAgIC8vIG5vbi16ZXJvIGFzIGV4cGxhaW5lZCBpbiB0aGUgbWV0aG9kIGRlc2NyaXB0aW9uLlxuICAgIHJldHVybiByZXN1bHQgYXMgT21pdDxTcGF3blN5bmNSZXR1cm5zPHN0cmluZz4sICdzdGF0dXMnPjtcbiAgfVxuXG4gIC8qKlxuICAgKiBTcGF3bnMgYSBnaXZlbiBHaXQgY29tbWFuZCBwcm9jZXNzLiBEb2VzIG5vdCB0aHJvdyBpZiB0aGUgY29tbWFuZCBmYWlscy4gQWRkaXRpb25hbGx5LFxuICAgKiBpZiB0aGVyZSBpcyBhbnkgc3RkZXJyIG91dHB1dCwgdGhlIG91dHB1dCB3aWxsIGJlIHByaW50ZWQuIFRoaXMgbWFrZXMgaXQgZWFzaWVyIHRvXG4gICAqIGluZm8gZmFpbGVkIGNvbW1hbmRzLlxuICAgKi9cbiAgcnVuR3JhY2VmdWwoYXJnczogc3RyaW5nW10sIG9wdGlvbnM6IEdpdENvbW1hbmRSdW5PcHRpb25zID0ge30pOiBTcGF3blN5bmNSZXR1cm5zPHN0cmluZz4ge1xuICAgIC8qKiBUaGUgZ2l0IGNvbW1hbmQgdG8gYmUgcnVuLiAqL1xuICAgIGNvbnN0IGdpdENvbW1hbmQgPSBhcmdzWzBdO1xuXG4gICAgaWYgKGlzRHJ5UnVuKCkgJiYgZ2l0Q29tbWFuZCA9PT0gJ3B1c2gnKSB7XG4gICAgICBMb2cuZGVidWcoYFwiZ2l0IHB1c2hcIiBpcyBub3QgYWJsZSB0byBiZSBydW4gaW4gZHJ5UnVuIG1vZGUuYCk7XG4gICAgICB0aHJvdyBuZXcgRHJ5UnVuRXJyb3IoKTtcbiAgICB9XG5cbiAgICAvLyBDbGVhciB0aGUgY3JlZGVudGlhbCBoZWxwZXIgdGhhdCBpcyB1c2VkLCBwcmV2ZW50aW5nIHRoZSB0ZW1wb3JhcnkgdG9rZW4gZnJvbSBiZWluZyBzYXZlZCBhcyBhXG4gICAgLy8gdmFsaWQgdG9rZW4gZm9yIGZ1dHVyZSB1c2UuXG4gICAgYXJncyA9IFsnLWMnLCAnY3JlZGVudGlhbC5oZWxwZXI9JywgLi4uYXJnc107XG4gICAgLy8gVG8gaW1wcm92ZSB0aGUgZGVidWdnaW5nIGV4cGVyaWVuY2UgaW4gY2FzZSBzb21ldGhpbmcgZmFpbHMsIHdlIHByaW50IGFsbCBleGVjdXRlZCBHaXRcbiAgICAvLyBjb21tYW5kcyBhdCB0aGUgREVCVUcgbGV2ZWwgdG8gYmV0dGVyIHVuZGVyc3RhbmQgdGhlIGdpdCBhY3Rpb25zIG9jY3VycmluZy5cbiAgICAvLyBOb3RlIHRoYXQgd2Ugc2FuaXRpemUgdGhlIGNvbW1hbmQgYmVmb3JlIHByaW50aW5nIGl0IHRvIHRoZSBjb25zb2xlLiBXZSBkbyBub3Qgd2FudCB0b1xuICAgIC8vIHByaW50IGFuIGFjY2VzcyB0b2tlbiBpZiBpdCBpcyBjb250YWluZWQgaW4gdGhlIGNvbW1hbmQuIEl0J3MgY29tbW9uIHRvIHNoYXJlIGVycm9ycyB3aXRoXG4gICAgLy8gb3RoZXJzIGlmIHRoZSB0b29sIGZhaWxlZCwgYW5kIHdlIGRvIG5vdCB3YW50IHRvIGxlYWsgdG9rZW5zLlxuICAgIExvZy5kZWJ1ZygnRXhlY3V0aW5nOiBnaXQnLCB0aGlzLnNhbml0aXplQ29uc29sZU91dHB1dChhcmdzLmpvaW4oJyAnKSkpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gc3Bhd25TeW5jKHRoaXMuZ2l0QmluUGF0aCwgYXJncywge1xuICAgICAgY3dkOiB0aGlzLmJhc2VEaXIsXG4gICAgICBzdGRpbzogJ3BpcGUnLFxuICAgICAgLi4ub3B0aW9ucyxcbiAgICAgIC8vIEVuY29kaW5nIGlzIGFsd2F5cyBgdXRmOGAgYW5kIG5vdCBvdmVycmlkYWJsZS4gVGhpcyBlbnN1cmVzIHRoYXQgdGhpcyBtZXRob2RcbiAgICAgIC8vIGFsd2F5cyByZXR1cm5zIGBzdHJpbmdgIGFzIG91dHB1dCBpbnN0ZWFkIG9mIGJ1ZmZlcnMuXG4gICAgICBlbmNvZGluZzogJ3V0ZjgnLFxuICAgIH0pO1xuXG4gICAgTG9nLmRlYnVnKGBTdGF0dXM6ICR7cmVzdWx0LnN0YXR1c30sIEVycm9yOiAkeyEhcmVzdWx0LmVycm9yfSwgU2lnbmFsOiAke3Jlc3VsdC5zaWduYWx9YCk7XG5cbiAgICBpZiAocmVzdWx0LnN0YXR1cyAhPT0gMCAmJiByZXN1bHQuc3RkZXJyICE9PSBudWxsKSB7XG4gICAgICAvLyBHaXQgc29tZXRpbWVzIHByaW50cyB0aGUgY29tbWFuZCBpZiBpdCBmYWlsZWQuIFRoaXMgbWVhbnMgdGhhdCBpdCBjb3VsZFxuICAgICAgLy8gcG90ZW50aWFsbHkgbGVhayB0aGUgR2l0aHViIHRva2VuIHVzZWQgZm9yIGFjY2Vzc2luZyB0aGUgcmVtb3RlLiBUbyBhdm9pZFxuICAgICAgLy8gcHJpbnRpbmcgYSB0b2tlbiwgd2Ugc2FuaXRpemUgdGhlIHN0cmluZyBiZWZvcmUgcHJpbnRpbmcgdGhlIHN0ZGVyciBvdXRwdXQuXG4gICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZSh0aGlzLnNhbml0aXplQ29uc29sZU91dHB1dChyZXN1bHQuc3RkZXJyKSk7XG4gICAgfVxuXG4gICAgTG9nLmRlYnVnKCdTdGRvdXQ6JywgcmVzdWx0LnN0ZG91dCk7XG4gICAgTG9nLmRlYnVnKCdTdGRlcnI6JywgcmVzdWx0LnN0ZGVycik7XG4gICAgTG9nLmRlYnVnKCdQcm9jZXNzIEVycm9yOicsIHJlc3VsdC5lcnJvcik7XG5cbiAgICBpZiAocmVzdWx0LmVycm9yICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIEdpdCBzb21ldGltZXMgcHJpbnRzIHRoZSBjb21tYW5kIGlmIGl0IGZhaWxlZC4gVGhpcyBtZWFucyB0aGF0IGl0IGNvdWxkXG4gICAgICAvLyBwb3RlbnRpYWxseSBsZWFrIHRoZSBHaXRodWIgdG9rZW4gdXNlZCBmb3IgYWNjZXNzaW5nIHRoZSByZW1vdGUuIFRvIGF2b2lkXG4gICAgICAvLyBwcmludGluZyBhIHRva2VuLCB3ZSBzYW5pdGl6ZSB0aGUgc3RyaW5nIGJlZm9yZSBwcmludGluZyB0aGUgc3RkZXJyIG91dHB1dC5cbiAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKHRoaXMuc2FuaXRpemVDb25zb2xlT3V0cHV0KHJlc3VsdC5lcnJvci5tZXNzYWdlKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKiBHaXQgVVJMIHRoYXQgcmVzb2x2ZXMgdG8gdGhlIGNvbmZpZ3VyZWQgcmVwb3NpdG9yeS4gKi9cbiAgZ2V0UmVwb0dpdFVybCgpIHtcbiAgICByZXR1cm4gZ2V0UmVwb3NpdG9yeUdpdFVybCh0aGlzLnJlbW90ZUNvbmZpZyk7XG4gIH1cblxuICAvKiogV2hldGhlciB0aGUgZ2l2ZW4gYnJhbmNoIGNvbnRhaW5zIHRoZSBzcGVjaWZpZWQgU0hBLiAqL1xuICBoYXNDb21taXQoYnJhbmNoTmFtZTogc3RyaW5nLCBzaGE6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnJ1bihbJ2JyYW5jaCcsIGJyYW5jaE5hbWUsICctLWNvbnRhaW5zJywgc2hhXSkuc3Rkb3V0ICE9PSAnJztcbiAgfVxuXG4gIC8qKiBXaGV0aGVyIHRoZSBsb2NhbCByZXBvc2l0b3J5IGlzIGNvbmZpZ3VyZWQgYXMgc2hhbGxvdy4gKi9cbiAgaXNTaGFsbG93UmVwbygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5ydW4oWydyZXYtcGFyc2UnLCAnLS1pcy1zaGFsbG93LXJlcG9zaXRvcnknXSkuc3Rkb3V0LnRyaW0oKSA9PT0gJ3RydWUnO1xuICB9XG5cbiAgLyoqIEdldHMgdGhlIGN1cnJlbnRseSBjaGVja2VkIG91dCBicmFuY2ggb3IgcmV2aXNpb24uICovXG4gIGdldEN1cnJlbnRCcmFuY2hPclJldmlzaW9uKCk6IHN0cmluZyB7XG4gICAgY29uc3QgYnJhbmNoTmFtZSA9IHRoaXMucnVuKFsncmV2LXBhcnNlJywgJy0tYWJicmV2LXJlZicsICdIRUFEJ10pLnN0ZG91dC50cmltKCk7XG4gICAgLy8gSWYgbm8gYnJhbmNoIG5hbWUgY291bGQgYmUgcmVzb2x2ZWQuIGkuZS4gYEhFQURgIGhhcyBiZWVuIHJldHVybmVkLCB0aGVuIEdpdFxuICAgIC8vIGlzIGN1cnJlbnRseSBpbiBhIGRldGFjaGVkIHN0YXRlLiBJbiB0aG9zZSBjYXNlcywgd2UganVzdCB3YW50IHRvIHJldHVybiB0aGVcbiAgICAvLyBjdXJyZW50bHkgY2hlY2tlZCBvdXQgcmV2aXNpb24vU0hBLlxuICAgIGlmIChicmFuY2hOYW1lID09PSAnSEVBRCcpIHtcbiAgICAgIHJldHVybiB0aGlzLnJ1bihbJ3Jldi1wYXJzZScsICdIRUFEJ10pLnN0ZG91dC50cmltKCk7XG4gICAgfVxuICAgIHJldHVybiBicmFuY2hOYW1lO1xuICB9XG5cbiAgLyoqIEdldHMgd2hldGhlciB0aGUgY3VycmVudCBHaXQgcmVwb3NpdG9yeSBoYXMgdW5jb21taXR0ZWQgY2hhbmdlcy4gKi9cbiAgaGFzVW5jb21taXR0ZWRDaGFuZ2VzKCk6IGJvb2xlYW4ge1xuICAgIC8vIFdlIGFsc28gbmVlZCB0byByZWZyZXNoIHRoZSBpbmRleCBpbiBjYXNlIHNvbWUgZmlsZXMgaGF2ZSBiZWVuIHRvdWNoZWRcbiAgICAvLyBidXQgbm90IG1vZGlmaWVkLiBUaGUgZGlmZi1pbmRleCBjb21tYW5kIHdpbGwgbm90IGNoZWNrIGNvbnRlbnRzIHNvIHdlXG4gICAgLy8gbWFudWFsbHkgbmVlZCB0byByZWZyZXNoIGFuZCBjbGVhbnVwIHRoZSBpbmRleCBiZWZvcmUgcGVyZm9ybWluZyB0aGUgZGlmZi5cbiAgICAvLyBSZWxldmFudCBpbmZvOiBodHRwczovL2dpdC1zY20uY29tL2RvY3MvZ2l0LWRpZmYtaW5kZXgjX25vbl9jYWNoZWRfbW9kZSxcbiAgICAvLyBodHRwczovL2dpdC1zY20uY29tL2RvY3MvZ2l0LXVwZGF0ZS1pbmRleCBhbmQgaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9hLzM0ODA4Mjk5LlxuICAgIHRoaXMucnVuR3JhY2VmdWwoWyd1cGRhdGUtaW5kZXgnLCAnLXEnLCAnLS1yZWZyZXNoJ10pO1xuXG4gICAgcmV0dXJuIHRoaXMucnVuR3JhY2VmdWwoWydkaWZmLWluZGV4JywgJy0tcXVpZXQnLCAnSEVBRCddKS5zdGF0dXMgIT09IDA7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIG91dCBhIHJlcXVlc3RlZCBicmFuY2ggb3IgcmV2aXNpb24sIG9wdGlvbmFsbHkgY2xlYW5pbmcgdGhlIHN0YXRlIG9mIHRoZSByZXBvc2l0b3J5XG4gICAqIGJlZm9yZSBhdHRlbXB0aW5nIHRoZSBjaGVja2luZy4gUmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyB3aGV0aGVyIHRoZSBicmFuY2ggb3IgcmV2aXNpb25cbiAgICogd2FzIGNsZWFubHkgY2hlY2tlZCBvdXQuXG4gICAqL1xuICBjaGVja291dChicmFuY2hPclJldmlzaW9uOiBzdHJpbmcsIGNsZWFuU3RhdGU6IGJvb2xlYW4pOiBib29sZWFuIHtcbiAgICBpZiAoY2xlYW5TdGF0ZSkge1xuICAgICAgLy8gQWJvcnQgYW55IG91dHN0YW5kaW5nIGFtcy5cbiAgICAgIHRoaXMucnVuR3JhY2VmdWwoWydhbScsICctLWFib3J0J10sIHtzdGRpbzogJ2lnbm9yZSd9KTtcbiAgICAgIC8vIEFib3J0IGFueSBvdXRzdGFuZGluZyBjaGVycnktcGlja3MuXG4gICAgICB0aGlzLnJ1bkdyYWNlZnVsKFsnY2hlcnJ5LXBpY2snLCAnLS1hYm9ydCddLCB7c3RkaW86ICdpZ25vcmUnfSk7XG4gICAgICAvLyBBYm9ydCBhbnkgb3V0c3RhbmRpbmcgcmViYXNlcy5cbiAgICAgIHRoaXMucnVuR3JhY2VmdWwoWydyZWJhc2UnLCAnLS1hYm9ydCddLCB7c3RkaW86ICdpZ25vcmUnfSk7XG4gICAgICAvLyBDbGVhciBhbnkgY2hhbmdlcyBpbiB0aGUgY3VycmVudCByZXBvLlxuICAgICAgdGhpcy5ydW5HcmFjZWZ1bChbJ3Jlc2V0JywgJy0taGFyZCddLCB7c3RkaW86ICdpZ25vcmUnfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnJ1bkdyYWNlZnVsKFsnY2hlY2tvdXQnLCBicmFuY2hPclJldmlzaW9uXSwge3N0ZGlvOiAnaWdub3JlJ30pLnN0YXR1cyA9PT0gMDtcbiAgfVxuXG4gIC8qKiBSZXRyaWV2ZSBhIGxpc3Qgb2YgYWxsIGZpbGVzIGluIHRoZSByZXBvc2l0b3J5IGNoYW5nZWQgc2luY2UgdGhlIHByb3ZpZGVkIHNoYU9yUmVmLiAqL1xuICBhbGxDaGFuZ2VzRmlsZXNTaW5jZShzaGFPclJlZiA9ICdIRUFEJyk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbShcbiAgICAgIG5ldyBTZXQoW1xuICAgICAgICAuLi5naXRPdXRwdXRBc0FycmF5KHRoaXMucnVuR3JhY2VmdWwoWydkaWZmJywgJy0tbmFtZS1vbmx5JywgJy0tZGlmZi1maWx0ZXI9ZCcsIHNoYU9yUmVmXSkpLFxuICAgICAgICAuLi5naXRPdXRwdXRBc0FycmF5KHRoaXMucnVuR3JhY2VmdWwoWydscy1maWxlcycsICctLW90aGVycycsICctLWV4Y2x1ZGUtc3RhbmRhcmQnXSkpLFxuICAgICAgXSksXG4gICAgKTtcbiAgfVxuXG4gIC8qKiBSZXRyaWV2ZSBhIGxpc3Qgb2YgYWxsIGZpbGVzIGN1cnJlbnRseSBzdGFnZWQgaW4gdGhlIHJlcG9zdGl0b3J5LiAqL1xuICBhbGxTdGFnZWRGaWxlcygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIGdpdE91dHB1dEFzQXJyYXkoXG4gICAgICB0aGlzLnJ1bkdyYWNlZnVsKFsnZGlmZicsICctLW5hbWUtb25seScsICctLWRpZmYtZmlsdGVyPUFDTScsICctLXN0YWdlZCddKSxcbiAgICApO1xuICB9XG5cbiAgLyoqIFJldHJpZXZlIGEgbGlzdCBvZiBhbGwgZmlsZXMgdHJhY2tlZCBpbiB0aGUgcmVwb3NpdG9yeS4gKi9cbiAgYWxsRmlsZXMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBnaXRPdXRwdXRBc0FycmF5KHRoaXMucnVuR3JhY2VmdWwoWydscy1maWxlcyddKSk7XG4gIH1cblxuICAvKipcbiAgICogU2FuaXRpemVzIHRoZSBnaXZlbiBjb25zb2xlIG1lc3NhZ2UuIFRoaXMgbWV0aG9kIGNhbiBiZSBvdmVycmlkZGVuIGJ5XG4gICAqIGRlcml2ZWQgY2xhc3Nlcy4gZS5nLiB0byBzYW5pdGl6ZSBhY2Nlc3MgdG9rZW5zIGZyb20gR2l0IGNvbW1hbmRzLlxuICAgKi9cbiAgc2FuaXRpemVDb25zb2xlT3V0cHV0KHZhbHVlOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICAvKiogVGhlIHNpbmdsZXRvbiBpbnN0YW5jZSBvZiB0aGUgdW5hdXRoZW50aWNhdGVkIGBHaXRDbGllbnRgLiAqL1xuICBwcml2YXRlIHN0YXRpYyBfdW5hdXRoZW50aWNhdGVkSW5zdGFuY2U6IFByb21pc2U8R2l0Q2xpZW50PiB8IG51bGwgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBTdGF0aWMgbWV0aG9kIHRvIGdldCB0aGUgc2luZ2xldG9uIGluc3RhbmNlIG9mIHRoZSBgR2l0Q2xpZW50YCxcbiAgICogY3JlYXRpbmcgaXQsIGlmIG5vdCBjcmVhdGVkIHlldC5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBnZXQoKTogUHJvbWlzZTxHaXRDbGllbnQ+IHtcbiAgICAvLyBJZiB0aGVyZSBpcyBubyBjYWNoZWQgaW5zdGFuY2UsIGNyZWF0ZSBvbmUgYW5kIGNhY2hlIHRoZSBwcm9taXNlIGltbWVkaWF0ZWx5LlxuICAgIC8vIFRoaXMgYXZvaWRzIGNvbnN0cnVjdGluZyBhIGNsaWVudCB0d2ljZSBhY2NpZGVudGFsbHkgd2hlbiBlLmcuIHdhaXRpbmcgZm9yIHRoZVxuICAgIC8vIGNvbmZpZ3VyYXRpb24gdG8gYmUgbG9hZGVkLlxuICAgIGlmIChHaXRDbGllbnQuX3VuYXV0aGVudGljYXRlZEluc3RhbmNlID09PSBudWxsKSB7XG4gICAgICBHaXRDbGllbnQuX3VuYXV0aGVudGljYXRlZEluc3RhbmNlID0gKGFzeW5jICgpID0+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBHaXRDbGllbnQoYXdhaXQgZ2V0Q29uZmlnKFthc3NlcnRWYWxpZEdpdGh1YkNvbmZpZ10pKTtcbiAgICAgIH0pKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIEdpdENsaWVudC5fdW5hdXRoZW50aWNhdGVkSW5zdGFuY2U7XG4gIH1cbn1cblxuLyoqXG4gKiBUYWtlcyB0aGUgb3V0cHV0IGZyb20gYHJ1bmAgYW5kIGBydW5HcmFjZWZ1bGAgYW5kIHJldHVybnMgYW4gYXJyYXkgb2Ygc3RyaW5ncyBmb3IgZWFjaFxuICogbmV3IGxpbmUuIEdpdCBjb21tYW5kcyB0eXBpY2FsbHkgcmV0dXJuIG11bHRpcGxlIG91dHB1dCB2YWx1ZXMgZm9yIGEgY29tbWFuZCBhIHNldCBvZlxuICogc3RyaW5ncyBzZXBhcmF0ZWQgYnkgbmV3IGxpbmVzLlxuICpcbiAqIE5vdGU6IFRoaXMgaXMgc3BlY2lmaWNhbGx5IGNyZWF0ZWQgYXMgYSBsb2NhbGx5IGF2YWlsYWJsZSBmdW5jdGlvbiBmb3IgdXNhZ2UgYXMgY29udmVuaWVuY2VcbiAqIHV0aWxpdHkgd2l0aGluIGBHaXRDbGllbnRgJ3MgbWV0aG9kcyB0byBjcmVhdGUgb3V0cHV0cyBhcyBhcnJheS5cbiAqL1xuZnVuY3Rpb24gZ2l0T3V0cHV0QXNBcnJheShnaXRDb21tYW5kUmVzdWx0OiBTcGF3blN5bmNSZXR1cm5zPHN0cmluZz4pOiBzdHJpbmdbXSB7XG4gIHJldHVybiBnaXRDb21tYW5kUmVzdWx0LnN0ZG91dFxuICAgIC5zcGxpdCgnXFxuJylcbiAgICAubWFwKCh4KSA9PiB4LnRyaW0oKSlcbiAgICAuZmlsdGVyKCh4KSA9PiAhIXgpO1xufVxuIl19