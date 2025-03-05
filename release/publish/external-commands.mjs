/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ChildProcess } from '../../utils/child-process.js';
import { Spinner } from '../../utils/spinner.js';
import { FatalReleaseActionError } from './actions-error.js';
import { resolveYarnScriptForProject } from '../../utils/resolve-yarn-bin.js';
import { green, Log } from '../../utils/logging.js';
import { getBazelBin } from '../../utils/bazel-bin.js';
/*
 * ###############################################################
 *
 * This file contains helpers for invoking external `ng-dev` commands. A subset of actions,
 * like building release output or setting aν NPM dist tag for release packages, cannot be
 * performed directly as part of the release tool and need to be delegated to external `ng-dev`
 * commands that exist across arbitrary version branches.
 *
 * In a concrete example: Consider a new patch version is released and that a new release
 * package has been added to the `next` branch. The patch branch will not contain the new
 * release package, so we could not build the release output for it. To work around this, we
 * call the ng-dev build command for the patch version branch and expect it to return a list
 * of built packages that need to be released as part of this release train.
 *
 * ###############################################################
 */
/** Class holding method for invoking release action external commands. */
export class ExternalCommands {
    /**
     * Invokes the `ng-dev release set-dist-tag` command in order to set the specified
     * NPM dist tag for all packages in the checked out branch to the given version.
     *
     * Optionally, the NPM dist tag update can be skipped for experimental packages. This
     * is useful when tagging long-term-support packages within NPM.
     */
    static async invokeSetNpmDist(projectDir, npmDistTag, version, pnpmVersioning, options = { skipExperimentalPackages: false }) {
        try {
            // Note: No progress indicator needed as that is the responsibility of the command.
            await this._spawnNpmScript([
                'ng-dev',
                'release',
                'set-dist-tag',
                npmDistTag,
                version.format(),
                `--skip-experimental-packages=${options.skipExperimentalPackages}`,
            ], projectDir, pnpmVersioning);
            Log.info(green(`  ✓   Set "${npmDistTag}" NPM dist tag for all packages to v${version}.`));
        }
        catch (e) {
            Log.error(e);
            Log.error(`  ✘   An error occurred while setting the NPM dist tag for "${npmDistTag}".`);
            throw new FatalReleaseActionError();
        }
    }
    /**
     * Invokes the `ng-dev release npm-dist-tag delete` command in order to delete the
     * NPM dist tag for all packages in the checked-out version branch.
     */
    static async invokeDeleteNpmDistTag(projectDir, npmDistTag, pnpmVersioning) {
        try {
            // Note: No progress indicator needed as that is the responsibility of the command.
            await this._spawnNpmScript(['ng-dev', 'release', 'npm-dist-tag', 'delete', npmDistTag], projectDir, pnpmVersioning);
            Log.info(green(`  ✓   Deleted "${npmDistTag}" NPM dist tag for all packages.`));
        }
        catch (e) {
            Log.error(e);
            Log.error(`  ✘   An error occurred while deleting the NPM dist tag: "${npmDistTag}".`);
            throw new FatalReleaseActionError();
        }
    }
    /**
     * Invokes the `ng-dev release build` command in order to build the release
     * packages for the currently checked out branch.
     */
    static async invokeReleaseBuild(projectDir, pnpmVersioning) {
        // Note: We explicitly mention that this can take a few minutes, so that it's obvious
        // to caretakers that it can take longer than just a few seconds.
        const spinner = new Spinner('Building release output. This can take a few minutes.');
        try {
            const { stdout } = await this._spawnNpmScript(['ng-dev', 'release', 'build', '--json'], projectDir, pnpmVersioning, {
                mode: 'silent',
            });
            spinner.complete();
            Log.info(green('  ✓   Built release output for all packages.'));
            // The `ng-dev release build` command prints a JSON array to stdout
            // that represents the built release packages and their output paths.
            return JSON.parse(stdout.trim());
        }
        catch (e) {
            spinner.complete();
            Log.error(e);
            Log.error('  ✘   An error occurred while building the release packages.');
            throw new FatalReleaseActionError();
        }
    }
    /**
     * Invokes the `ng-dev release info` command in order to retrieve information
     * about the release for the currently checked-out branch.
     *
     * This is useful to e.g. determine whether a built package is currently
     * denoted as experimental or not.
     */
    static async invokeReleaseInfo(projectDir, pnpmVersioning) {
        try {
            const { stdout } = await this._spawnNpmScript(['ng-dev', 'release', 'info', '--json'], projectDir, pnpmVersioning, { mode: 'silent' });
            // The `ng-dev release info` command prints a JSON object to stdout.
            return JSON.parse(stdout.trim());
        }
        catch (e) {
            Log.error(e);
            Log.error(`  ✘   An error occurred while retrieving the release information for ` +
                `the currently checked-out branch.`);
            throw new FatalReleaseActionError();
        }
    }
    /**
     * Invokes the `ng-dev release precheck` command in order to validate the
     * built packages or run other validations before actually releasing.
     *
     * This is run as an external command because prechecks can be customized
     * through the `ng-dev` configuration, and we wouldn't want to run prechecks
     * from the `next` branch for older branches, like patch or an LTS branch.
     */
    static async invokeReleasePrecheck(projectDir, newVersion, builtPackagesWithInfo, pnpmVersioning) {
        const precheckStdin = {
            builtPackagesWithInfo,
            newVersion: newVersion.format(),
        };
        try {
            await this._spawnNpmScript(['ng-dev', 'release', 'precheck'], projectDir, pnpmVersioning, {
                // Note: We pass the precheck information to the command through `stdin`
                // because command line arguments are less reliable and have length limits.
                input: JSON.stringify(precheckStdin),
            });
            Log.info(green(`  ✓   Executed release pre-checks for ${newVersion}`));
        }
        catch (e) {
            // The `spawn` invocation already prints all stdout/stderr, so we don't need re-print.
            // To ease debugging in case of runtime exceptions, we still print the error to `debug`.
            Log.debug(e);
            Log.error(`  ✘   An error occurred while running release pre-checks.`);
            throw new FatalReleaseActionError();
        }
    }
    /**
     * Invokes the `yarn install` command in order to install dependencies for
     * the configured project with the currently checked out revision.
     */
    static async invokeYarnInstall(projectDir) {
        // Note: We cannot use `yarn` directly as command because we might operate in
        // a different publish branch and the current `PATH` will point to the Yarn version
        // that invoked the release tool. More details in the function description.
        const yarnCommand = await resolveYarnScriptForProject(projectDir);
        try {
            // Note: No progress indicator needed as that is the responsibility of the command.
            // TODO: Consider using an Ora spinner instead to ensure minimal console output.
            await ChildProcess.spawn(yarnCommand.binary, [
                ...yarnCommand.args,
                'install',
                ...(yarnCommand.legacy ? ['--frozen-lockfile', '--non-interactive'] : ['--immutable']),
            ], { cwd: projectDir });
            Log.info(green('  ✓   Installed project dependencies.'));
        }
        catch (e) {
            Log.error(e);
            Log.error('  ✘   An error occurred while installing dependencies.');
            throw new FatalReleaseActionError();
        }
    }
    /**
     * Invokes the `pnpm install` command in order to install dependencies for
     * the configured project with the currently checked out revision.
     */
    static async invokePnpmInstall(projectDir, pnpmVersioning) {
        try {
            const pnpmSpec = await pnpmVersioning.getPackageSpec(projectDir);
            await ChildProcess.spawn('npx', ['--yes', pnpmSpec, 'install', '--frozen-lockfile'], {
                cwd: projectDir,
            });
            Log.info(green('  ✓   Installed project dependencies.'));
        }
        catch (e) {
            Log.error(e);
            Log.error('  ✘   An error occurred while installing dependencies.');
            throw new FatalReleaseActionError();
        }
    }
    /**
     * Invokes the `yarn bazel sync --only=repo` command in order
     * to refresh Aspect lock files.
     */
    static async invokeBazelUpdateAspectLockFiles(projectDir) {
        const spinner = new Spinner('Updating Aspect lock files');
        try {
            await ChildProcess.spawn(getBazelBin(), ['sync', '--only=repo'], {
                cwd: projectDir,
                mode: 'silent',
            });
        }
        catch (e) {
            // Note: Gracefully handling these errors because `sync` command
            // exits with a non-zero exit code when pnpm-lock.yaml file is updated.
            Log.debug(e);
        }
        spinner.success(green(' Updated Aspect `rules_js` lock files.'));
    }
    static async _spawnNpmScript(args, projectDir, pnpmVersioning, spawnOptions = {}) {
        if (await pnpmVersioning.isUsingPnpm(projectDir)) {
            const pnpmSpec = await pnpmVersioning.getPackageSpec(projectDir);
            return ChildProcess.spawn('npx', ['--yes', pnpmSpec, 'run', ...args], {
                ...spawnOptions,
                cwd: projectDir,
            });
        }
        else {
            // Note: We cannot use `yarn` directly as command because we might operate in
            // a different publish branch and the current `PATH` will point to the Yarn version
            // that invoked the release tool. More details in the function description.
            const yarnCommand = await resolveYarnScriptForProject(projectDir);
            return ChildProcess.spawn(yarnCommand.binary, [...yarnCommand.args, ...args], {
                ...spawnOptions,
                cwd: projectDir,
            });
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZXJuYWwtY29tbWFuZHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9wdWJsaXNoL2V4dGVybmFsLWNvbW1hbmRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxZQUFZLEVBQTRCLE1BQU0sOEJBQThCLENBQUM7QUFDckYsT0FBTyxFQUFDLE9BQU8sRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRy9DLE9BQU8sRUFBQyx1QkFBdUIsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQzNELE9BQU8sRUFBQywyQkFBMkIsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBSzVFLE9BQU8sRUFBQyxLQUFLLEVBQUUsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDbEQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBR3JEOzs7Ozs7Ozs7Ozs7Ozs7R0FlRztBQUVILDBFQUEwRTtBQUMxRSxNQUFNLE9BQWdCLGdCQUFnQjtJQUNwQzs7Ozs7O09BTUc7SUFDSCxNQUFNLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUMzQixVQUFrQixFQUNsQixVQUFzQixFQUN0QixPQUFzQixFQUN0QixjQUE4QixFQUM5QixVQUErQyxFQUFDLHdCQUF3QixFQUFFLEtBQUssRUFBQztRQUVoRixJQUFJLENBQUM7WUFDSCxtRkFBbUY7WUFDbkYsTUFBTSxJQUFJLENBQUMsZUFBZSxDQUN4QjtnQkFDRSxRQUFRO2dCQUNSLFNBQVM7Z0JBQ1QsY0FBYztnQkFDZCxVQUFVO2dCQUNWLE9BQU8sQ0FBQyxNQUFNLEVBQUU7Z0JBQ2hCLGdDQUFnQyxPQUFPLENBQUMsd0JBQXdCLEVBQUU7YUFDbkUsRUFDRCxVQUFVLEVBQ1YsY0FBYyxDQUNmLENBQUM7WUFFRixHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLFVBQVUsdUNBQXVDLE9BQU8s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TSxDQUFDO1lBQ04sNkVBQTZFO1lBQzdFLG1GQUFtRjtZQUNuRiwyRUFBMkU7WUFDM0UsTUFBTSxXQUFXLEdBQUcsTUFBTSwyQkFBMkIsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNsRSxPQUFPLFlBQVksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxFQUFFO2dCQUM1RSxHQUFHLFlBQVk7Z0JBQ2YsR0FBRyxFQUFFLFVBQVU7YUFDaEIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztJQUNILENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XG5cbmltcG9ydCB7Q2hpbGRQcm9jZXNzLCBTcGF3blJlc3VsdCwgU3Bhd25PcHRpb25zfSBmcm9tICcuLi8uLi91dGlscy9jaGlsZC1wcm9jZXNzLmpzJztcbmltcG9ydCB7U3Bpbm5lcn0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lci5qcyc7XG5pbXBvcnQge05wbURpc3RUYWd9IGZyb20gJy4uL3ZlcnNpb25pbmcvaW5kZXguanMnO1xuXG5pbXBvcnQge0ZhdGFsUmVsZWFzZUFjdGlvbkVycm9yfSBmcm9tICcuL2FjdGlvbnMtZXJyb3IuanMnO1xuaW1wb3J0IHtyZXNvbHZlWWFyblNjcmlwdEZvclByb2plY3R9IGZyb20gJy4uLy4uL3V0aWxzL3Jlc29sdmUteWFybi1iaW4uanMnO1xuaW1wb3J0IHtSZWxlYXNlQnVpbGRKc29uU3Rkb3V0fSBmcm9tICcuLi9idWlsZC9jbGkuanMnO1xuaW1wb3J0IHtSZWxlYXNlSW5mb0pzb25TdGRvdXR9IGZyb20gJy4uL2luZm8vY2xpLmpzJztcbmltcG9ydCB7UmVsZWFzZVByZWNoZWNrSnNvblN0ZGlufSBmcm9tICcuLi9wcmVjaGVjay9jbGkuanMnO1xuaW1wb3J0IHtCdWlsdFBhY2thZ2VXaXRoSW5mb30gZnJvbSAnLi4vY29uZmlnL2luZGV4LmpzJztcbmltcG9ydCB7Z3JlZW4sIExvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge2dldEJhemVsQmlufSBmcm9tICcuLi8uLi91dGlscy9iYXplbC1iaW4uanMnO1xuaW1wb3J0IHtQbnBtVmVyc2lvbmluZ30gZnJvbSAnLi9wbnBtLXZlcnNpb25pbmcuanMnO1xuXG4vKlxuICogIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjXG4gKlxuICogVGhpcyBmaWxlIGNvbnRhaW5zIGhlbHBlcnMgZm9yIGludm9raW5nIGV4dGVybmFsIGBuZy1kZXZgIGNvbW1hbmRzLiBBIHN1YnNldCBvZiBhY3Rpb25zLFxuICogbGlrZSBidWlsZGluZyByZWxlYXNlIG91dHB1dCBvciBzZXR0aW5nIGHOvSBOUE0gZGlzdCB0YWcgZm9yIHJlbGVhc2UgcGFja2FnZXMsIGNhbm5vdCBiZVxuICogcGVyZm9ybWVkIGRpcmVjdGx5IGFzIHBhcnQgb2YgdGhlIHJlbGVhc2UgdG9vbCBhbmQgbmVlZCB0byBiZSBkZWxlZ2F0ZWQgdG8gZXh0ZXJuYWwgYG5nLWRldmBcbiAqIGNvbW1hbmRzIHRoYXQgZXhpc3QgYWNyb3NzIGFyYml0cmFyeSB2ZXJzaW9uIGJyYW5jaGVzLlxuICpcbiAqIEluIGEgY29uY3JldGUgZXhhbXBsZTogQ29uc2lkZXIgYSBuZXcgcGF0Y2ggdmVyc2lvbiBpcyByZWxlYXNlZCBhbmQgdGhhdCBhIG5ldyByZWxlYXNlXG4gKiBwYWNrYWdlIGhhcyBiZWVuIGFkZGVkIHRvIHRoZSBgbmV4dGAgYnJhbmNoLiBUaGUgcGF0Y2ggYnJhbmNoIHdpbGwgbm90IGNvbnRhaW4gdGhlIG5ld1xuICogcmVsZWFzZSBwYWNrYWdlLCBzbyB3ZSBjb3VsZCBub3QgYnVpbGQgdGhlIHJlbGVhc2Ugb3V0cHV0IGZvciBpdC4gVG8gd29yayBhcm91bmQgdGhpcywgd2VcbiAqIGNhbGwgdGhlIG5nLWRldiBidWlsZCBjb21tYW5kIGZvciB0aGUgcGF0Y2ggdmVyc2lvbiBicmFuY2ggYW5kIGV4cGVjdCBpdCB0byByZXR1cm4gYSBsaXN0XG4gKiBvZiBidWlsdCBwYWNrYWdlcyB0aGF0IG5lZWQgdG8gYmUgcmVsZWFzZWQgYXMgcGFydCBvZiB0aGlzIHJlbGVhc2UgdHJhaW4uXG4gKlxuICogIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjXG4gKi9cblxuLyoqIENsYXNzIGhvbGRpbmcgbWV0aG9kIGZvciBpbnZva2luZyByZWxlYXNlIGFjdGlvbiBleHRlcm5hbCBjb21tYW5kcy4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBFeHRlcm5hbENvbW1hbmRzIHtcbiAgLyoqXG4gICAqIEludm9rZXMgdGhlIGBuZy1kZXYgcmVsZWFzZSBzZXQtZGlzdC10YWdgIGNvbW1hbmQgaW4gb3JkZXIgdG8gc2V0IHRoZSBzcGVjaWZpZWRcbiAgICogTlBNIGRpc3QgdGFnIGZvciBhbGwgcGFja2FnZXMgaW4gdGhlIGNoZWNrZWQgb3V0IGJyYW5jaCB0byB0aGUgZ2l2ZW4gdmVyc2lvbi5cbiAgICpcbiAgICogT3B0aW9uYWxseSwgdGhlIE5QTSBkaXN0IHRhZyB1cGRhdGUgY2FuIGJlIHNraXBwZWQgZm9yIGV4cGVyaW1lbnRhbCBwYWNrYWdlcy4gVGhpc1xuICAgKiBpcyB1c2VmdWwgd2hlbiB0YWdnaW5nIGxvbmctdGVybS1zdXBwb3J0IHBhY2thZ2VzIHdpdGhpbiBOUE0uXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW52b2tlU2V0TnBtRGlzdChcbiAgICBwcm9qZWN0RGlyOiBzdHJpbmcsXG4gICAgbnBtRGlzdFRhZzogTnBtRGlzdFRhZyxcbiAgICB2ZXJzaW9uOiBzZW12ZXIuU2VtVmVyLFxuICAgIHBucG1WZXJzaW9uaW5nOiBQbnBtVmVyc2lvbmluZyxcbiAgICBvcHRpb25zOiB7c2tpcEV4cGVyaW1lbnRhbFBhY2thZ2VzOiBib29sZWFufSA9IHtza2lwRXhwZXJpbWVudGFsUGFja2FnZXM6IGZhbHNlfSxcbiAgKSB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIE5vdGU6IE5vIHByb2dyZXNzIGluZGljYXRvciBuZWVkZWQgYXMgdGhhdCBpcyB0aGUgcmVzcG9uc2liaWxpdHkgb2YgdGhlIGNvbW1hbmQuXG4gICAgICBhd2FpdCB0aGlzLl9zcGF3bk5wbVNjcmlwdChcbiAgICAgICAgW1xuICAgICAgICAgICduZy1kZXYnLFxuICAgICAgICAgICdyZWxlYXNlJyxcbiAgICAgICAgICAnc2V0LWRpc3QtdGFnJyxcbiAgICAgICAgICBucG1EaXN0VGFnLFxuICAgICAgICAgIHZlcnNpb24uZm9ybWF0KCksXG4gICAgICAgICAgYC0tc2tpcC1leHBlcmltZW50YWwtcGFja2FnZXM9JHtvcHRpb25zLnNraXBFeHBlcmltZW50YWxQYWNrYWdlc31gLFxuICAgICAgICBdLFxuICAgICAgICBwcm9qZWN0RGlyLFxuICAgICAgICBwbnBtVmVyc2lvbmluZyxcbiAgICAgICk7XG5cbiAgICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIFNldCBcIiR7bnBtRGlzdFRhZ31cIiBOUE0gZGlzdCB0YWcgZm9yIGFsbCBwYWNrYWdlcyB0byB2JHt2ZXJzaW9ufS5gKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgTG9nLmVycm9yKGUpO1xuICAgICAgTG9nLmVycm9yKGAgIOKcmCAgIEFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHNldHRpbmcgdGhlIE5QTSBkaXN0IHRhZyBmb3IgXCIke25wbURpc3RUYWd9XCIuYCk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlcyB0aGUgYG5nLWRldiByZWxlYXNlIG5wbS1kaXN0LXRhZyBkZWxldGVgIGNvbW1hbmQgaW4gb3JkZXIgdG8gZGVsZXRlIHRoZVxuICAgKiBOUE0gZGlzdCB0YWcgZm9yIGFsbCBwYWNrYWdlcyBpbiB0aGUgY2hlY2tlZC1vdXQgdmVyc2lvbiBicmFuY2guXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW52b2tlRGVsZXRlTnBtRGlzdFRhZyhcbiAgICBwcm9qZWN0RGlyOiBzdHJpbmcsXG4gICAgbnBtRGlzdFRhZzogTnBtRGlzdFRhZyxcbiAgICBwbnBtVmVyc2lvbmluZzogUG5wbVZlcnNpb25pbmcsXG4gICkge1xuICAgIHRyeSB7XG4gICAgICAvLyBOb3RlOiBObyBwcm9ncmVzcyBpbmRpY2F0b3IgbmVlZGVkIGFzIHRoYXQgaXMgdGhlIHJlc3BvbnNpYmlsaXR5IG9mIHRoZSBjb21tYW5kLlxuICAgICAgYXdhaXQgdGhpcy5fc3Bhd25OcG1TY3JpcHQoXG4gICAgICAgIFsnbmctZGV2JywgJ3JlbGVhc2UnLCAnbnBtLWRpc3QtdGFnJywgJ2RlbGV0ZScsIG5wbURpc3RUYWddLFxuICAgICAgICBwcm9qZWN0RGlyLFxuICAgICAgICBwbnBtVmVyc2lvbmluZyxcbiAgICAgICk7XG5cbiAgICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIERlbGV0ZWQgXCIke25wbURpc3RUYWd9XCIgTlBNIGRpc3QgdGFnIGZvciBhbGwgcGFja2FnZXMuYCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIExvZy5lcnJvcihlKTtcbiAgICAgIExvZy5lcnJvcihgICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBkZWxldGluZyB0aGUgTlBNIGRpc3QgdGFnOiBcIiR7bnBtRGlzdFRhZ31cIi5gKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBgbmctZGV2IHJlbGVhc2UgYnVpbGRgIGNvbW1hbmQgaW4gb3JkZXIgdG8gYnVpbGQgdGhlIHJlbGVhc2VcbiAgICogcGFja2FnZXMgZm9yIHRoZSBjdXJyZW50bHkgY2hlY2tlZCBvdXQgYnJhbmNoLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZVJlbGVhc2VCdWlsZChcbiAgICBwcm9qZWN0RGlyOiBzdHJpbmcsXG4gICAgcG5wbVZlcnNpb25pbmc6IFBucG1WZXJzaW9uaW5nLFxuICApOiBQcm9taXNlPFJlbGVhc2VCdWlsZEpzb25TdGRvdXQ+IHtcbiAgICAvLyBOb3RlOiBXZSBleHBsaWNpdGx5IG1lbnRpb24gdGhhdCB0aGlzIGNhbiB0YWtlIGEgZmV3IG1pbnV0ZXMsIHNvIHRoYXQgaXQncyBvYnZpb3VzXG4gICAgLy8gdG8gY2FyZXRha2VycyB0aGF0IGl0IGNhbiB0YWtlIGxvbmdlciB0aGFuIGp1c3QgYSBmZXcgc2Vjb25kcy5cbiAgICBjb25zdCBzcGlubmVyID0gbmV3IFNwaW5uZXIoJ0J1aWxkaW5nIHJlbGVhc2Ugb3V0cHV0LiBUaGlzIGNhbiB0YWtlIGEgZmV3IG1pbnV0ZXMuJyk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3Qge3N0ZG91dH0gPSBhd2FpdCB0aGlzLl9zcGF3bk5wbVNjcmlwdChcbiAgICAgICAgWyduZy1kZXYnLCAncmVsZWFzZScsICdidWlsZCcsICctLWpzb24nXSxcbiAgICAgICAgcHJvamVjdERpcixcbiAgICAgICAgcG5wbVZlcnNpb25pbmcsXG4gICAgICAgIHtcbiAgICAgICAgICBtb2RlOiAnc2lsZW50JyxcbiAgICAgICAgfSxcbiAgICAgICk7XG5cbiAgICAgIHNwaW5uZXIuY29tcGxldGUoKTtcbiAgICAgIExvZy5pbmZvKGdyZWVuKCcgIOKckyAgIEJ1aWx0IHJlbGVhc2Ugb3V0cHV0IGZvciBhbGwgcGFja2FnZXMuJykpO1xuICAgICAgLy8gVGhlIGBuZy1kZXYgcmVsZWFzZSBidWlsZGAgY29tbWFuZCBwcmludHMgYSBKU09OIGFycmF5IHRvIHN0ZG91dFxuICAgICAgLy8gdGhhdCByZXByZXNlbnRzIHRoZSBidWlsdCByZWxlYXNlIHBhY2thZ2VzIGFuZCB0aGVpciBvdXRwdXQgcGF0aHMuXG4gICAgICByZXR1cm4gSlNPTi5wYXJzZShzdGRvdXQudHJpbSgpKSBhcyBSZWxlYXNlQnVpbGRKc29uU3Rkb3V0O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHNwaW5uZXIuY29tcGxldGUoKTtcbiAgICAgIExvZy5lcnJvcihlKTtcbiAgICAgIExvZy5lcnJvcignICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBidWlsZGluZyB0aGUgcmVsZWFzZSBwYWNrYWdlcy4nKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBgbmctZGV2IHJlbGVhc2UgaW5mb2AgY29tbWFuZCBpbiBvcmRlciB0byByZXRyaWV2ZSBpbmZvcm1hdGlvblxuICAgKiBhYm91dCB0aGUgcmVsZWFzZSBmb3IgdGhlIGN1cnJlbnRseSBjaGVja2VkLW91dCBicmFuY2guXG4gICAqXG4gICAqIFRoaXMgaXMgdXNlZnVsIHRvIGUuZy4gZGV0ZXJtaW5lIHdoZXRoZXIgYSBidWlsdCBwYWNrYWdlIGlzIGN1cnJlbnRseVxuICAgKiBkZW5vdGVkIGFzIGV4cGVyaW1lbnRhbCBvciBub3QuXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW52b2tlUmVsZWFzZUluZm8oXG4gICAgcHJvamVjdERpcjogc3RyaW5nLFxuICAgIHBucG1WZXJzaW9uaW5nOiBQbnBtVmVyc2lvbmluZyxcbiAgKTogUHJvbWlzZTxSZWxlYXNlSW5mb0pzb25TdGRvdXQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qge3N0ZG91dH0gPSBhd2FpdCB0aGlzLl9zcGF3bk5wbVNjcmlwdChcbiAgICAgICAgWyduZy1kZXYnLCAncmVsZWFzZScsICdpbmZvJywgJy0tanNvbiddLFxuICAgICAgICBwcm9qZWN0RGlyLFxuICAgICAgICBwbnBtVmVyc2lvbmluZyxcbiAgICAgICAge21vZGU6ICdzaWxlbnQnfSxcbiAgICAgICk7XG5cbiAgICAgIC8vIFRoZSBgbmctZGV2IHJlbGVhc2UgaW5mb2AgY29tbWFuZCBwcmludHMgYSBKU09OIG9iamVjdCB0byBzdGRvdXQuXG4gICAgICByZXR1cm4gSlNPTi5wYXJzZShzdGRvdXQudHJpbSgpKSBhcyBSZWxlYXNlSW5mb0pzb25TdGRvdXQ7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgTG9nLmVycm9yKGUpO1xuICAgICAgTG9nLmVycm9yKFxuICAgICAgICBgICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSByZXRyaWV2aW5nIHRoZSByZWxlYXNlIGluZm9ybWF0aW9uIGZvciBgICtcbiAgICAgICAgICBgdGhlIGN1cnJlbnRseSBjaGVja2VkLW91dCBicmFuY2guYCxcbiAgICAgICk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlcyB0aGUgYG5nLWRldiByZWxlYXNlIHByZWNoZWNrYCBjb21tYW5kIGluIG9yZGVyIHRvIHZhbGlkYXRlIHRoZVxuICAgKiBidWlsdCBwYWNrYWdlcyBvciBydW4gb3RoZXIgdmFsaWRhdGlvbnMgYmVmb3JlIGFjdHVhbGx5IHJlbGVhc2luZy5cbiAgICpcbiAgICogVGhpcyBpcyBydW4gYXMgYW4gZXh0ZXJuYWwgY29tbWFuZCBiZWNhdXNlIHByZWNoZWNrcyBjYW4gYmUgY3VzdG9taXplZFxuICAgKiB0aHJvdWdoIHRoZSBgbmctZGV2YCBjb25maWd1cmF0aW9uLCBhbmQgd2Ugd291bGRuJ3Qgd2FudCB0byBydW4gcHJlY2hlY2tzXG4gICAqIGZyb20gdGhlIGBuZXh0YCBicmFuY2ggZm9yIG9sZGVyIGJyYW5jaGVzLCBsaWtlIHBhdGNoIG9yIGFuIExUUyBicmFuY2guXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW52b2tlUmVsZWFzZVByZWNoZWNrKFxuICAgIHByb2plY3REaXI6IHN0cmluZyxcbiAgICBuZXdWZXJzaW9uOiBzZW12ZXIuU2VtVmVyLFxuICAgIGJ1aWx0UGFja2FnZXNXaXRoSW5mbzogQnVpbHRQYWNrYWdlV2l0aEluZm9bXSxcbiAgICBwbnBtVmVyc2lvbmluZzogUG5wbVZlcnNpb25pbmcsXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHByZWNoZWNrU3RkaW46IFJlbGVhc2VQcmVjaGVja0pzb25TdGRpbiA9IHtcbiAgICAgIGJ1aWx0UGFja2FnZXNXaXRoSW5mbyxcbiAgICAgIG5ld1ZlcnNpb246IG5ld1ZlcnNpb24uZm9ybWF0KCksXG4gICAgfTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLl9zcGF3bk5wbVNjcmlwdChbJ25nLWRldicsICdyZWxlYXNlJywgJ3ByZWNoZWNrJ10sIHByb2plY3REaXIsIHBucG1WZXJzaW9uaW5nLCB7XG4gICAgICAgIC8vIE5vdGU6IFdlIHBhc3MgdGhlIHByZWNoZWNrIGluZm9ybWF0aW9uIHRvIHRoZSBjb21tYW5kIHRocm91Z2ggYHN0ZGluYFxuICAgICAgICAvLyBiZWNhdXNlIGNvbW1hbmQgbGluZSBhcmd1bWVudHMgYXJlIGxlc3MgcmVsaWFibGUgYW5kIGhhdmUgbGVuZ3RoIGxpbWl0cy5cbiAgICAgICAgaW5wdXQ6IEpTT04uc3RyaW5naWZ5KHByZWNoZWNrU3RkaW4pLFxuICAgICAgfSk7XG5cbiAgICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIEV4ZWN1dGVkIHJlbGVhc2UgcHJlLWNoZWNrcyBmb3IgJHtuZXdWZXJzaW9ufWApKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBUaGUgYHNwYXduYCBpbnZvY2F0aW9uIGFscmVhZHkgcHJpbnRzIGFsbCBzdGRvdXQvc3RkZXJyLCBzbyB3ZSBkb24ndCBuZWVkIHJlLXByaW50LlxuICAgICAgLy8gVG8gZWFzZSBkZWJ1Z2dpbmcgaW4gY2FzZSBvZiBydW50aW1lIGV4Y2VwdGlvbnMsIHdlIHN0aWxsIHByaW50IHRoZSBlcnJvciB0byBgZGVidWdgLlxuICAgICAgTG9nLmRlYnVnKGUpO1xuICAgICAgTG9nLmVycm9yKGAgIOKcmCAgIEFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHJ1bm5pbmcgcmVsZWFzZSBwcmUtY2hlY2tzLmApO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEludm9rZXMgdGhlIGB5YXJuIGluc3RhbGxgIGNvbW1hbmQgaW4gb3JkZXIgdG8gaW5zdGFsbCBkZXBlbmRlbmNpZXMgZm9yXG4gICAqIHRoZSBjb25maWd1cmVkIHByb2plY3Qgd2l0aCB0aGUgY3VycmVudGx5IGNoZWNrZWQgb3V0IHJldmlzaW9uLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZVlhcm5JbnN0YWxsKHByb2plY3REaXI6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIE5vdGU6IFdlIGNhbm5vdCB1c2UgYHlhcm5gIGRpcmVjdGx5IGFzIGNvbW1hbmQgYmVjYXVzZSB3ZSBtaWdodCBvcGVyYXRlIGluXG4gICAgLy8gYSBkaWZmZXJlbnQgcHVibGlzaCBicmFuY2ggYW5kIHRoZSBjdXJyZW50IGBQQVRIYCB3aWxsIHBvaW50IHRvIHRoZSBZYXJuIHZlcnNpb25cbiAgICAvLyB0aGF0IGludm9rZWQgdGhlIHJlbGVhc2UgdG9vbC4gTW9yZSBkZXRhaWxzIGluIHRoZSBmdW5jdGlvbiBkZXNjcmlwdGlvbi5cbiAgICBjb25zdCB5YXJuQ29tbWFuZCA9IGF3YWl0IHJlc29sdmVZYXJuU2NyaXB0Rm9yUHJvamVjdChwcm9qZWN0RGlyKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyBOb3RlOiBObyBwcm9ncmVzcyBpbmRpY2F0b3IgbmVlZGVkIGFzIHRoYXQgaXMgdGhlIHJlc3BvbnNpYmlsaXR5IG9mIHRoZSBjb21tYW5kLlxuICAgICAgLy8gVE9ETzogQ29uc2lkZXIgdXNpbmcgYW4gT3JhIHNwaW5uZXIgaW5zdGVhZCB0byBlbnN1cmUgbWluaW1hbCBjb25zb2xlIG91dHB1dC5cbiAgICAgIGF3YWl0IENoaWxkUHJvY2Vzcy5zcGF3bihcbiAgICAgICAgeWFybkNvbW1hbmQuYmluYXJ5LFxuICAgICAgICBbXG4gICAgICAgICAgLi4ueWFybkNvbW1hbmQuYXJncyxcbiAgICAgICAgICAnaW5zdGFsbCcsXG4gICAgICAgICAgLi4uKHlhcm5Db21tYW5kLmxlZ2FjeSA/IFsnLS1mcm96ZW4tbG9ja2ZpbGUnLCAnLS1ub24taW50ZXJhY3RpdmUnXSA6IFsnLS1pbW11dGFibGUnXSksXG4gICAgICAgIF0sXG4gICAgICAgIHtjd2Q6IHByb2plY3REaXJ9LFxuICAgICAgKTtcbiAgICAgIExvZy5pbmZvKGdyZWVuKCcgIOKckyAgIEluc3RhbGxlZCBwcm9qZWN0IGRlcGVuZGVuY2llcy4nKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgTG9nLmVycm9yKGUpO1xuICAgICAgTG9nLmVycm9yKCcgIOKcmCAgIEFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGluc3RhbGxpbmcgZGVwZW5kZW5jaWVzLicpO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEludm9rZXMgdGhlIGBwbnBtIGluc3RhbGxgIGNvbW1hbmQgaW4gb3JkZXIgdG8gaW5zdGFsbCBkZXBlbmRlbmNpZXMgZm9yXG4gICAqIHRoZSBjb25maWd1cmVkIHByb2plY3Qgd2l0aCB0aGUgY3VycmVudGx5IGNoZWNrZWQgb3V0IHJldmlzaW9uLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZVBucG1JbnN0YWxsKFxuICAgIHByb2plY3REaXI6IHN0cmluZyxcbiAgICBwbnBtVmVyc2lvbmluZzogUG5wbVZlcnNpb25pbmcsXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBwbnBtU3BlYyA9IGF3YWl0IHBucG1WZXJzaW9uaW5nLmdldFBhY2thZ2VTcGVjKHByb2plY3REaXIpO1xuICAgICAgYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKCducHgnLCBbJy0teWVzJywgcG5wbVNwZWMsICdpbnN0YWxsJywgJy0tZnJvemVuLWxvY2tmaWxlJ10sIHtcbiAgICAgICAgY3dkOiBwcm9qZWN0RGlyLFxuICAgICAgfSk7XG5cbiAgICAgIExvZy5pbmZvKGdyZWVuKCcgIOKckyAgIEluc3RhbGxlZCBwcm9qZWN0IGRlcGVuZGVuY2llcy4nKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgTG9nLmVycm9yKGUpO1xuICAgICAgTG9nLmVycm9yKCcgIOKcmCAgIEFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGluc3RhbGxpbmcgZGVwZW5kZW5jaWVzLicpO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEludm9rZXMgdGhlIGB5YXJuIGJhemVsIHN5bmMgLS1vbmx5PXJlcG9gIGNvbW1hbmQgaW4gb3JkZXJcbiAgICogdG8gcmVmcmVzaCBBc3BlY3QgbG9jayBmaWxlcy5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBpbnZva2VCYXplbFVwZGF0ZUFzcGVjdExvY2tGaWxlcyhwcm9qZWN0RGlyOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBzcGlubmVyID0gbmV3IFNwaW5uZXIoJ1VwZGF0aW5nIEFzcGVjdCBsb2NrIGZpbGVzJyk7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IENoaWxkUHJvY2Vzcy5zcGF3bihnZXRCYXplbEJpbigpLCBbJ3N5bmMnLCAnLS1vbmx5PXJlcG8nXSwge1xuICAgICAgICBjd2Q6IHByb2plY3REaXIsXG4gICAgICAgIG1vZGU6ICdzaWxlbnQnLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gTm90ZTogR3JhY2VmdWxseSBoYW5kbGluZyB0aGVzZSBlcnJvcnMgYmVjYXVzZSBgc3luY2AgY29tbWFuZFxuICAgICAgLy8gZXhpdHMgd2l0aCBhIG5vbi16ZXJvIGV4aXQgY29kZSB3aGVuIHBucG0tbG9jay55YW1sIGZpbGUgaXMgdXBkYXRlZC5cbiAgICAgIExvZy5kZWJ1ZyhlKTtcbiAgICB9XG4gICAgc3Bpbm5lci5zdWNjZXNzKGdyZWVuKCcgVXBkYXRlZCBBc3BlY3QgYHJ1bGVzX2pzYCBsb2NrIGZpbGVzLicpKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIGFzeW5jIF9zcGF3bk5wbVNjcmlwdChcbiAgICBhcmdzOiBzdHJpbmdbXSxcbiAgICBwcm9qZWN0RGlyOiBzdHJpbmcsXG4gICAgcG5wbVZlcnNpb25pbmc6IFBucG1WZXJzaW9uaW5nLFxuICAgIHNwYXduT3B0aW9uczogU3Bhd25PcHRpb25zID0ge30sXG4gICk6IFByb21pc2U8U3Bhd25SZXN1bHQ+IHtcbiAgICBpZiAoYXdhaXQgcG5wbVZlcnNpb25pbmcuaXNVc2luZ1BucG0ocHJvamVjdERpcikpIHtcbiAgICAgIGNvbnN0IHBucG1TcGVjID0gYXdhaXQgcG5wbVZlcnNpb25pbmcuZ2V0UGFja2FnZVNwZWMocHJvamVjdERpcik7XG4gICAgICByZXR1cm4gQ2hpbGRQcm9jZXNzLnNwYXduKCducHgnLCBbJy0teWVzJywgcG5wbVNwZWMsICdydW4nLCAuLi5hcmdzXSwge1xuICAgICAgICAuLi5zcGF3bk9wdGlvbnMsXG4gICAgICAgIGN3ZDogcHJvamVjdERpcixcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBOb3RlOiBXZSBjYW5ub3QgdXNlIGB5YXJuYCBkaXJlY3RseSBhcyBjb21tYW5kIGJlY2F1c2Ugd2UgbWlnaHQgb3BlcmF0ZSBpblxuICAgICAgLy8gYSBkaWZmZXJlbnQgcHVibGlzaCBicmFuY2ggYW5kIHRoZSBjdXJyZW50IGBQQVRIYCB3aWxsIHBvaW50IHRvIHRoZSBZYXJuIHZlcnNpb25cbiAgICAgIC8vIHRoYXQgaW52b2tlZCB0aGUgcmVsZWFzZSB0b29sLiBNb3JlIGRldGFpbHMgaW4gdGhlIGZ1bmN0aW9uIGRlc2NyaXB0aW9uLlxuICAgICAgY29uc3QgeWFybkNvbW1hbmQgPSBhd2FpdCByZXNvbHZlWWFyblNjcmlwdEZvclByb2plY3QocHJvamVjdERpcik7XG4gICAgICByZXR1cm4gQ2hpbGRQcm9jZXNzLnNwYXduKHlhcm5Db21tYW5kLmJpbmFyeSwgWy4uLnlhcm5Db21tYW5kLmFyZ3MsIC4uLmFyZ3NdLCB7XG4gICAgICAgIC4uLnNwYXduT3B0aW9ucyxcbiAgICAgICAgY3dkOiBwcm9qZWN0RGlyLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG4iXX0=