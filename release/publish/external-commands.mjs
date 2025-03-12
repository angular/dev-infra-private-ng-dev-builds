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
            return ChildProcess.spawn('npx', ['--yes', pnpmSpec, '-s', 'run', ...args], {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZXJuYWwtY29tbWFuZHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9wdWJsaXNoL2V4dGVybmFsLWNvbW1hbmRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxZQUFZLEVBQTRCLE1BQU0sOEJBQThCLENBQUM7QUFDckYsT0FBTyxFQUFDLE9BQU8sRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRy9DLE9BQU8sRUFBQyx1QkFBdUIsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQzNELE9BQU8sRUFBQywyQkFBMkIsRUFBQyxNQUFNLGlDQUFpQyxDQUFDO0FBSzVFLE9BQU8sRUFBQyxLQUFLLEVBQUUsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDbEQsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBR3JEOzs7Ozs7Ozs7Ozs7Ozs7R0FlRztBQUVILDBFQUEwRTtBQUMxRSxNQUFNLE9BQWdCLGdCQUFnQjtJQUNwQzs7Ozs7O09BTUc7SUFDSCxNQUFNLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUMzQixVQUFrQixFQUNsQixVQUFzQixFQUN0QixPQUFzQixFQUN0QixjQUE4QixFQUM5QixVQUErQyxFQUFDLHdCQUF3QixFQUFFLEtBQUssRUFBQztRQUVoRixJQUFJLENBQUM7WUFDSCxtRkFBbUY7WUFDbkYsTUFBTSxJQUFJLENBQUMsZUFBZSxDQUN4QjtnQkFDRSxRQUFRO2dCQUNSLFNBQVM7Z0JBQ1QsY0FBYztnQkFDZCxVQUFVO2dCQUNWLE9BQU8sQ0FBQyxNQUFNLEVBQUU7Z0JBQ2hCLGdDQUFnQyxPQUFPLENBQUMsd0JBQXdCLEVBQUU7YUFDbkUsRUFDRCxVQUFVLEVBQ1YsY0FBYyxDQUNmLENBQUM7WUFFRixHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLFVBQVUsdUNBQXVDLE9BQU8s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TCxDQUFDO2FBQU0sQ0FBQztZQUNOLDZFQUE2RTtZQUM3RSxtRkFBbUY7WUFDbkYsMkVBQTJFO1lBQzNFLE1BQU0sV0FBVyxHQUFHLE1BQU0sMkJBQTJCLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDbEUsT0FBTyxZQUFZLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsRUFBRTtnQkFDNUUsR0FBRyxZQUFZO2dCQUNmLEdBQUcsRUFBRSxVQUFVO2FBQ2hCLENBQUMsQ0FBQztRQUNMLENBQUM7SUFDSCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xuXG5pbXBvcnQge0NoaWxkUHJvY2VzcywgU3Bhd25SZXN1bHQsIFNwYXduT3B0aW9uc30gZnJvbSAnLi4vLi4vdXRpbHMvY2hpbGQtcHJvY2Vzcy5qcyc7XG5pbXBvcnQge1NwaW5uZXJ9IGZyb20gJy4uLy4uL3V0aWxzL3NwaW5uZXIuanMnO1xuaW1wb3J0IHtOcG1EaXN0VGFnfSBmcm9tICcuLi92ZXJzaW9uaW5nL2luZGV4LmpzJztcblxuaW1wb3J0IHtGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcn0gZnJvbSAnLi9hY3Rpb25zLWVycm9yLmpzJztcbmltcG9ydCB7cmVzb2x2ZVlhcm5TY3JpcHRGb3JQcm9qZWN0fSBmcm9tICcuLi8uLi91dGlscy9yZXNvbHZlLXlhcm4tYmluLmpzJztcbmltcG9ydCB7UmVsZWFzZUJ1aWxkSnNvblN0ZG91dH0gZnJvbSAnLi4vYnVpbGQvY2xpLmpzJztcbmltcG9ydCB7UmVsZWFzZUluZm9Kc29uU3Rkb3V0fSBmcm9tICcuLi9pbmZvL2NsaS5qcyc7XG5pbXBvcnQge1JlbGVhc2VQcmVjaGVja0pzb25TdGRpbn0gZnJvbSAnLi4vcHJlY2hlY2svY2xpLmpzJztcbmltcG9ydCB7QnVpbHRQYWNrYWdlV2l0aEluZm99IGZyb20gJy4uL2NvbmZpZy9pbmRleC5qcyc7XG5pbXBvcnQge2dyZWVuLCBMb2d9IGZyb20gJy4uLy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuaW1wb3J0IHtnZXRCYXplbEJpbn0gZnJvbSAnLi4vLi4vdXRpbHMvYmF6ZWwtYmluLmpzJztcbmltcG9ydCB7UG5wbVZlcnNpb25pbmd9IGZyb20gJy4vcG5wbS12ZXJzaW9uaW5nLmpzJztcblxuLypcbiAqICMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjI1xuICpcbiAqIFRoaXMgZmlsZSBjb250YWlucyBoZWxwZXJzIGZvciBpbnZva2luZyBleHRlcm5hbCBgbmctZGV2YCBjb21tYW5kcy4gQSBzdWJzZXQgb2YgYWN0aW9ucyxcbiAqIGxpa2UgYnVpbGRpbmcgcmVsZWFzZSBvdXRwdXQgb3Igc2V0dGluZyBhzr0gTlBNIGRpc3QgdGFnIGZvciByZWxlYXNlIHBhY2thZ2VzLCBjYW5ub3QgYmVcbiAqIHBlcmZvcm1lZCBkaXJlY3RseSBhcyBwYXJ0IG9mIHRoZSByZWxlYXNlIHRvb2wgYW5kIG5lZWQgdG8gYmUgZGVsZWdhdGVkIHRvIGV4dGVybmFsIGBuZy1kZXZgXG4gKiBjb21tYW5kcyB0aGF0IGV4aXN0IGFjcm9zcyBhcmJpdHJhcnkgdmVyc2lvbiBicmFuY2hlcy5cbiAqXG4gKiBJbiBhIGNvbmNyZXRlIGV4YW1wbGU6IENvbnNpZGVyIGEgbmV3IHBhdGNoIHZlcnNpb24gaXMgcmVsZWFzZWQgYW5kIHRoYXQgYSBuZXcgcmVsZWFzZVxuICogcGFja2FnZSBoYXMgYmVlbiBhZGRlZCB0byB0aGUgYG5leHRgIGJyYW5jaC4gVGhlIHBhdGNoIGJyYW5jaCB3aWxsIG5vdCBjb250YWluIHRoZSBuZXdcbiAqIHJlbGVhc2UgcGFja2FnZSwgc28gd2UgY291bGQgbm90IGJ1aWxkIHRoZSByZWxlYXNlIG91dHB1dCBmb3IgaXQuIFRvIHdvcmsgYXJvdW5kIHRoaXMsIHdlXG4gKiBjYWxsIHRoZSBuZy1kZXYgYnVpbGQgY29tbWFuZCBmb3IgdGhlIHBhdGNoIHZlcnNpb24gYnJhbmNoIGFuZCBleHBlY3QgaXQgdG8gcmV0dXJuIGEgbGlzdFxuICogb2YgYnVpbHQgcGFja2FnZXMgdGhhdCBuZWVkIHRvIGJlIHJlbGVhc2VkIGFzIHBhcnQgb2YgdGhpcyByZWxlYXNlIHRyYWluLlxuICpcbiAqICMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjI1xuICovXG5cbi8qKiBDbGFzcyBob2xkaW5nIG1ldGhvZCBmb3IgaW52b2tpbmcgcmVsZWFzZSBhY3Rpb24gZXh0ZXJuYWwgY29tbWFuZHMuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRXh0ZXJuYWxDb21tYW5kcyB7XG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBgbmctZGV2IHJlbGVhc2Ugc2V0LWRpc3QtdGFnYCBjb21tYW5kIGluIG9yZGVyIHRvIHNldCB0aGUgc3BlY2lmaWVkXG4gICAqIE5QTSBkaXN0IHRhZyBmb3IgYWxsIHBhY2thZ2VzIGluIHRoZSBjaGVja2VkIG91dCBicmFuY2ggdG8gdGhlIGdpdmVuIHZlcnNpb24uXG4gICAqXG4gICAqIE9wdGlvbmFsbHksIHRoZSBOUE0gZGlzdCB0YWcgdXBkYXRlIGNhbiBiZSBza2lwcGVkIGZvciBleHBlcmltZW50YWwgcGFja2FnZXMuIFRoaXNcbiAgICogaXMgdXNlZnVsIHdoZW4gdGFnZ2luZyBsb25nLXRlcm0tc3VwcG9ydCBwYWNrYWdlcyB3aXRoaW4gTlBNLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZVNldE5wbURpc3QoXG4gICAgcHJvamVjdERpcjogc3RyaW5nLFxuICAgIG5wbURpc3RUYWc6IE5wbURpc3RUYWcsXG4gICAgdmVyc2lvbjogc2VtdmVyLlNlbVZlcixcbiAgICBwbnBtVmVyc2lvbmluZzogUG5wbVZlcnNpb25pbmcsXG4gICAgb3B0aW9uczoge3NraXBFeHBlcmltZW50YWxQYWNrYWdlczogYm9vbGVhbn0gPSB7c2tpcEV4cGVyaW1lbnRhbFBhY2thZ2VzOiBmYWxzZX0sXG4gICkge1xuICAgIHRyeSB7XG4gICAgICAvLyBOb3RlOiBObyBwcm9ncmVzcyBpbmRpY2F0b3IgbmVlZGVkIGFzIHRoYXQgaXMgdGhlIHJlc3BvbnNpYmlsaXR5IG9mIHRoZSBjb21tYW5kLlxuICAgICAgYXdhaXQgdGhpcy5fc3Bhd25OcG1TY3JpcHQoXG4gICAgICAgIFtcbiAgICAgICAgICAnbmctZGV2JyxcbiAgICAgICAgICAncmVsZWFzZScsXG4gICAgICAgICAgJ3NldC1kaXN0LXRhZycsXG4gICAgICAgICAgbnBtRGlzdFRhZyxcbiAgICAgICAgICB2ZXJzaW9uLmZvcm1hdCgpLFxuICAgICAgICAgIGAtLXNraXAtZXhwZXJpbWVudGFsLXBhY2thZ2VzPSR7b3B0aW9ucy5za2lwRXhwZXJpbWVudGFsUGFja2FnZXN9YCxcbiAgICAgICAgXSxcbiAgICAgICAgcHJvamVjdERpcixcbiAgICAgICAgcG5wbVZlcnNpb25pbmcsXG4gICAgICApO1xuXG4gICAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBTZXQgXCIke25wbURpc3RUYWd9XCIgTlBNIGRpc3QgdGFnIGZvciBhbGwgcGFja2FnZXMgdG8gdiR7dmVyc2lvbn0uYCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIExvZy5lcnJvcihlKTtcbiAgICAgIExvZy5lcnJvcihgICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBzZXR0aW5nIHRoZSBOUE0gZGlzdCB0YWcgZm9yIFwiJHtucG1EaXN0VGFnfVwiLmApO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEludm9rZXMgdGhlIGBuZy1kZXYgcmVsZWFzZSBucG0tZGlzdC10YWcgZGVsZXRlYCBjb21tYW5kIGluIG9yZGVyIHRvIGRlbGV0ZSB0aGVcbiAgICogTlBNIGRpc3QgdGFnIGZvciBhbGwgcGFja2FnZXMgaW4gdGhlIGNoZWNrZWQtb3V0IHZlcnNpb24gYnJhbmNoLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZURlbGV0ZU5wbURpc3RUYWcoXG4gICAgcHJvamVjdERpcjogc3RyaW5nLFxuICAgIG5wbURpc3RUYWc6IE5wbURpc3RUYWcsXG4gICAgcG5wbVZlcnNpb25pbmc6IFBucG1WZXJzaW9uaW5nLFxuICApIHtcbiAgICB0cnkge1xuICAgICAgLy8gTm90ZTogTm8gcHJvZ3Jlc3MgaW5kaWNhdG9yIG5lZWRlZCBhcyB0aGF0IGlzIHRoZSByZXNwb25zaWJpbGl0eSBvZiB0aGUgY29tbWFuZC5cbiAgICAgIGF3YWl0IHRoaXMuX3NwYXduTnBtU2NyaXB0KFxuICAgICAgICBbJ25nLWRldicsICdyZWxlYXNlJywgJ25wbS1kaXN0LXRhZycsICdkZWxldGUnLCBucG1EaXN0VGFnXSxcbiAgICAgICAgcHJvamVjdERpcixcbiAgICAgICAgcG5wbVZlcnNpb25pbmcsXG4gICAgICApO1xuXG4gICAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBEZWxldGVkIFwiJHtucG1EaXN0VGFnfVwiIE5QTSBkaXN0IHRhZyBmb3IgYWxsIHBhY2thZ2VzLmApKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBMb2cuZXJyb3IoZSk7XG4gICAgICBMb2cuZXJyb3IoYCAg4pyYICAgQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgZGVsZXRpbmcgdGhlIE5QTSBkaXN0IHRhZzogXCIke25wbURpc3RUYWd9XCIuYCk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlcyB0aGUgYG5nLWRldiByZWxlYXNlIGJ1aWxkYCBjb21tYW5kIGluIG9yZGVyIHRvIGJ1aWxkIHRoZSByZWxlYXNlXG4gICAqIHBhY2thZ2VzIGZvciB0aGUgY3VycmVudGx5IGNoZWNrZWQgb3V0IGJyYW5jaC5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBpbnZva2VSZWxlYXNlQnVpbGQoXG4gICAgcHJvamVjdERpcjogc3RyaW5nLFxuICAgIHBucG1WZXJzaW9uaW5nOiBQbnBtVmVyc2lvbmluZyxcbiAgKTogUHJvbWlzZTxSZWxlYXNlQnVpbGRKc29uU3Rkb3V0PiB7XG4gICAgLy8gTm90ZTogV2UgZXhwbGljaXRseSBtZW50aW9uIHRoYXQgdGhpcyBjYW4gdGFrZSBhIGZldyBtaW51dGVzLCBzbyB0aGF0IGl0J3Mgb2J2aW91c1xuICAgIC8vIHRvIGNhcmV0YWtlcnMgdGhhdCBpdCBjYW4gdGFrZSBsb25nZXIgdGhhbiBqdXN0IGEgZmV3IHNlY29uZHMuXG4gICAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKCdCdWlsZGluZyByZWxlYXNlIG91dHB1dC4gVGhpcyBjYW4gdGFrZSBhIGZldyBtaW51dGVzLicpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHtzdGRvdXR9ID0gYXdhaXQgdGhpcy5fc3Bhd25OcG1TY3JpcHQoXG4gICAgICAgIFsnbmctZGV2JywgJ3JlbGVhc2UnLCAnYnVpbGQnLCAnLS1qc29uJ10sXG4gICAgICAgIHByb2plY3REaXIsXG4gICAgICAgIHBucG1WZXJzaW9uaW5nLFxuICAgICAgICB7XG4gICAgICAgICAgbW9kZTogJ3NpbGVudCcsXG4gICAgICAgIH0sXG4gICAgICApO1xuXG4gICAgICBzcGlubmVyLmNvbXBsZXRlKCk7XG4gICAgICBMb2cuaW5mbyhncmVlbignICDinJMgICBCdWlsdCByZWxlYXNlIG91dHB1dCBmb3IgYWxsIHBhY2thZ2VzLicpKTtcbiAgICAgIC8vIFRoZSBgbmctZGV2IHJlbGVhc2UgYnVpbGRgIGNvbW1hbmQgcHJpbnRzIGEgSlNPTiBhcnJheSB0byBzdGRvdXRcbiAgICAgIC8vIHRoYXQgcmVwcmVzZW50cyB0aGUgYnVpbHQgcmVsZWFzZSBwYWNrYWdlcyBhbmQgdGhlaXIgb3V0cHV0IHBhdGhzLlxuICAgICAgcmV0dXJuIEpTT04ucGFyc2Uoc3Rkb3V0LnRyaW0oKSkgYXMgUmVsZWFzZUJ1aWxkSnNvblN0ZG91dDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBzcGlubmVyLmNvbXBsZXRlKCk7XG4gICAgICBMb2cuZXJyb3IoZSk7XG4gICAgICBMb2cuZXJyb3IoJyAg4pyYICAgQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgYnVpbGRpbmcgdGhlIHJlbGVhc2UgcGFja2FnZXMuJyk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlcyB0aGUgYG5nLWRldiByZWxlYXNlIGluZm9gIGNvbW1hbmQgaW4gb3JkZXIgdG8gcmV0cmlldmUgaW5mb3JtYXRpb25cbiAgICogYWJvdXQgdGhlIHJlbGVhc2UgZm9yIHRoZSBjdXJyZW50bHkgY2hlY2tlZC1vdXQgYnJhbmNoLlxuICAgKlxuICAgKiBUaGlzIGlzIHVzZWZ1bCB0byBlLmcuIGRldGVybWluZSB3aGV0aGVyIGEgYnVpbHQgcGFja2FnZSBpcyBjdXJyZW50bHlcbiAgICogZGVub3RlZCBhcyBleHBlcmltZW50YWwgb3Igbm90LlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZVJlbGVhc2VJbmZvKFxuICAgIHByb2plY3REaXI6IHN0cmluZyxcbiAgICBwbnBtVmVyc2lvbmluZzogUG5wbVZlcnNpb25pbmcsXG4gICk6IFByb21pc2U8UmVsZWFzZUluZm9Kc29uU3Rkb3V0PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHtzdGRvdXR9ID0gYXdhaXQgdGhpcy5fc3Bhd25OcG1TY3JpcHQoXG4gICAgICAgIFsnbmctZGV2JywgJ3JlbGVhc2UnLCAnaW5mbycsICctLWpzb24nXSxcbiAgICAgICAgcHJvamVjdERpcixcbiAgICAgICAgcG5wbVZlcnNpb25pbmcsXG4gICAgICAgIHttb2RlOiAnc2lsZW50J30sXG4gICAgICApO1xuXG4gICAgICAvLyBUaGUgYG5nLWRldiByZWxlYXNlIGluZm9gIGNvbW1hbmQgcHJpbnRzIGEgSlNPTiBvYmplY3QgdG8gc3Rkb3V0LlxuICAgICAgcmV0dXJuIEpTT04ucGFyc2Uoc3Rkb3V0LnRyaW0oKSkgYXMgUmVsZWFzZUluZm9Kc29uU3Rkb3V0O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIExvZy5lcnJvcihlKTtcbiAgICAgIExvZy5lcnJvcihcbiAgICAgICAgYCAg4pyYICAgQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgcmV0cmlldmluZyB0aGUgcmVsZWFzZSBpbmZvcm1hdGlvbiBmb3IgYCArXG4gICAgICAgICAgYHRoZSBjdXJyZW50bHkgY2hlY2tlZC1vdXQgYnJhbmNoLmAsXG4gICAgICApO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEludm9rZXMgdGhlIGBuZy1kZXYgcmVsZWFzZSBwcmVjaGVja2AgY29tbWFuZCBpbiBvcmRlciB0byB2YWxpZGF0ZSB0aGVcbiAgICogYnVpbHQgcGFja2FnZXMgb3IgcnVuIG90aGVyIHZhbGlkYXRpb25zIGJlZm9yZSBhY3R1YWxseSByZWxlYXNpbmcuXG4gICAqXG4gICAqIFRoaXMgaXMgcnVuIGFzIGFuIGV4dGVybmFsIGNvbW1hbmQgYmVjYXVzZSBwcmVjaGVja3MgY2FuIGJlIGN1c3RvbWl6ZWRcbiAgICogdGhyb3VnaCB0aGUgYG5nLWRldmAgY29uZmlndXJhdGlvbiwgYW5kIHdlIHdvdWxkbid0IHdhbnQgdG8gcnVuIHByZWNoZWNrc1xuICAgKiBmcm9tIHRoZSBgbmV4dGAgYnJhbmNoIGZvciBvbGRlciBicmFuY2hlcywgbGlrZSBwYXRjaCBvciBhbiBMVFMgYnJhbmNoLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZVJlbGVhc2VQcmVjaGVjayhcbiAgICBwcm9qZWN0RGlyOiBzdHJpbmcsXG4gICAgbmV3VmVyc2lvbjogc2VtdmVyLlNlbVZlcixcbiAgICBidWlsdFBhY2thZ2VzV2l0aEluZm86IEJ1aWx0UGFja2FnZVdpdGhJbmZvW10sXG4gICAgcG5wbVZlcnNpb25pbmc6IFBucG1WZXJzaW9uaW5nLFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBwcmVjaGVja1N0ZGluOiBSZWxlYXNlUHJlY2hlY2tKc29uU3RkaW4gPSB7XG4gICAgICBidWlsdFBhY2thZ2VzV2l0aEluZm8sXG4gICAgICBuZXdWZXJzaW9uOiBuZXdWZXJzaW9uLmZvcm1hdCgpLFxuICAgIH07XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5fc3Bhd25OcG1TY3JpcHQoWyduZy1kZXYnLCAncmVsZWFzZScsICdwcmVjaGVjayddLCBwcm9qZWN0RGlyLCBwbnBtVmVyc2lvbmluZywge1xuICAgICAgICAvLyBOb3RlOiBXZSBwYXNzIHRoZSBwcmVjaGVjayBpbmZvcm1hdGlvbiB0byB0aGUgY29tbWFuZCB0aHJvdWdoIGBzdGRpbmBcbiAgICAgICAgLy8gYmVjYXVzZSBjb21tYW5kIGxpbmUgYXJndW1lbnRzIGFyZSBsZXNzIHJlbGlhYmxlIGFuZCBoYXZlIGxlbmd0aCBsaW1pdHMuXG4gICAgICAgIGlucHV0OiBKU09OLnN0cmluZ2lmeShwcmVjaGVja1N0ZGluKSxcbiAgICAgIH0pO1xuXG4gICAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBFeGVjdXRlZCByZWxlYXNlIHByZS1jaGVja3MgZm9yICR7bmV3VmVyc2lvbn1gKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gVGhlIGBzcGF3bmAgaW52b2NhdGlvbiBhbHJlYWR5IHByaW50cyBhbGwgc3Rkb3V0L3N0ZGVyciwgc28gd2UgZG9uJ3QgbmVlZCByZS1wcmludC5cbiAgICAgIC8vIFRvIGVhc2UgZGVidWdnaW5nIGluIGNhc2Ugb2YgcnVudGltZSBleGNlcHRpb25zLCB3ZSBzdGlsbCBwcmludCB0aGUgZXJyb3IgdG8gYGRlYnVnYC5cbiAgICAgIExvZy5kZWJ1ZyhlKTtcbiAgICAgIExvZy5lcnJvcihgICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBydW5uaW5nIHJlbGVhc2UgcHJlLWNoZWNrcy5gKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBgeWFybiBpbnN0YWxsYCBjb21tYW5kIGluIG9yZGVyIHRvIGluc3RhbGwgZGVwZW5kZW5jaWVzIGZvclxuICAgKiB0aGUgY29uZmlndXJlZCBwcm9qZWN0IHdpdGggdGhlIGN1cnJlbnRseSBjaGVja2VkIG91dCByZXZpc2lvbi5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBpbnZva2VZYXJuSW5zdGFsbChwcm9qZWN0RGlyOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBOb3RlOiBXZSBjYW5ub3QgdXNlIGB5YXJuYCBkaXJlY3RseSBhcyBjb21tYW5kIGJlY2F1c2Ugd2UgbWlnaHQgb3BlcmF0ZSBpblxuICAgIC8vIGEgZGlmZmVyZW50IHB1Ymxpc2ggYnJhbmNoIGFuZCB0aGUgY3VycmVudCBgUEFUSGAgd2lsbCBwb2ludCB0byB0aGUgWWFybiB2ZXJzaW9uXG4gICAgLy8gdGhhdCBpbnZva2VkIHRoZSByZWxlYXNlIHRvb2wuIE1vcmUgZGV0YWlscyBpbiB0aGUgZnVuY3Rpb24gZGVzY3JpcHRpb24uXG4gICAgY29uc3QgeWFybkNvbW1hbmQgPSBhd2FpdCByZXNvbHZlWWFyblNjcmlwdEZvclByb2plY3QocHJvamVjdERpcik7XG5cbiAgICB0cnkge1xuICAgICAgLy8gTm90ZTogTm8gcHJvZ3Jlc3MgaW5kaWNhdG9yIG5lZWRlZCBhcyB0aGF0IGlzIHRoZSByZXNwb25zaWJpbGl0eSBvZiB0aGUgY29tbWFuZC5cbiAgICAgIC8vIFRPRE86IENvbnNpZGVyIHVzaW5nIGFuIE9yYSBzcGlubmVyIGluc3RlYWQgdG8gZW5zdXJlIG1pbmltYWwgY29uc29sZSBvdXRwdXQuXG4gICAgICBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oXG4gICAgICAgIHlhcm5Db21tYW5kLmJpbmFyeSxcbiAgICAgICAgW1xuICAgICAgICAgIC4uLnlhcm5Db21tYW5kLmFyZ3MsXG4gICAgICAgICAgJ2luc3RhbGwnLFxuICAgICAgICAgIC4uLih5YXJuQ29tbWFuZC5sZWdhY3kgPyBbJy0tZnJvemVuLWxvY2tmaWxlJywgJy0tbm9uLWludGVyYWN0aXZlJ10gOiBbJy0taW1tdXRhYmxlJ10pLFxuICAgICAgICBdLFxuICAgICAgICB7Y3dkOiBwcm9qZWN0RGlyfSxcbiAgICAgICk7XG4gICAgICBMb2cuaW5mbyhncmVlbignICDinJMgICBJbnN0YWxsZWQgcHJvamVjdCBkZXBlbmRlbmNpZXMuJykpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIExvZy5lcnJvcihlKTtcbiAgICAgIExvZy5lcnJvcignICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBpbnN0YWxsaW5nIGRlcGVuZGVuY2llcy4nKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBgcG5wbSBpbnN0YWxsYCBjb21tYW5kIGluIG9yZGVyIHRvIGluc3RhbGwgZGVwZW5kZW5jaWVzIGZvclxuICAgKiB0aGUgY29uZmlndXJlZCBwcm9qZWN0IHdpdGggdGhlIGN1cnJlbnRseSBjaGVja2VkIG91dCByZXZpc2lvbi5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBpbnZva2VQbnBtSW5zdGFsbChcbiAgICBwcm9qZWN0RGlyOiBzdHJpbmcsXG4gICAgcG5wbVZlcnNpb25pbmc6IFBucG1WZXJzaW9uaW5nLFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcG5wbVNwZWMgPSBhd2FpdCBwbnBtVmVyc2lvbmluZy5nZXRQYWNrYWdlU3BlYyhwcm9qZWN0RGlyKTtcbiAgICAgIGF3YWl0IENoaWxkUHJvY2Vzcy5zcGF3bignbnB4JywgWyctLXllcycsIHBucG1TcGVjLCAnaW5zdGFsbCcsICctLWZyb3plbi1sb2NrZmlsZSddLCB7XG4gICAgICAgIGN3ZDogcHJvamVjdERpcixcbiAgICAgIH0pO1xuXG4gICAgICBMb2cuaW5mbyhncmVlbignICDinJMgICBJbnN0YWxsZWQgcHJvamVjdCBkZXBlbmRlbmNpZXMuJykpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIExvZy5lcnJvcihlKTtcbiAgICAgIExvZy5lcnJvcignICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBpbnN0YWxsaW5nIGRlcGVuZGVuY2llcy4nKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBgeWFybiBiYXplbCBzeW5jIC0tb25seT1yZXBvYCBjb21tYW5kIGluIG9yZGVyXG4gICAqIHRvIHJlZnJlc2ggQXNwZWN0IGxvY2sgZmlsZXMuXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW52b2tlQmF6ZWxVcGRhdGVBc3BlY3RMb2NrRmlsZXMocHJvamVjdERpcjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKCdVcGRhdGluZyBBc3BlY3QgbG9jayBmaWxlcycpO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oZ2V0QmF6ZWxCaW4oKSwgWydzeW5jJywgJy0tb25seT1yZXBvJ10sIHtcbiAgICAgICAgY3dkOiBwcm9qZWN0RGlyLFxuICAgICAgICBtb2RlOiAnc2lsZW50JyxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIE5vdGU6IEdyYWNlZnVsbHkgaGFuZGxpbmcgdGhlc2UgZXJyb3JzIGJlY2F1c2UgYHN5bmNgIGNvbW1hbmRcbiAgICAgIC8vIGV4aXRzIHdpdGggYSBub24temVybyBleGl0IGNvZGUgd2hlbiBwbnBtLWxvY2sueWFtbCBmaWxlIGlzIHVwZGF0ZWQuXG4gICAgICBMb2cuZGVidWcoZSk7XG4gICAgfVxuICAgIHNwaW5uZXIuc3VjY2VzcyhncmVlbignIFVwZGF0ZWQgQXNwZWN0IGBydWxlc19qc2AgbG9jayBmaWxlcy4nKSk7XG4gIH1cblxuICBwcml2YXRlIHN0YXRpYyBhc3luYyBfc3Bhd25OcG1TY3JpcHQoXG4gICAgYXJnczogc3RyaW5nW10sXG4gICAgcHJvamVjdERpcjogc3RyaW5nLFxuICAgIHBucG1WZXJzaW9uaW5nOiBQbnBtVmVyc2lvbmluZyxcbiAgICBzcGF3bk9wdGlvbnM6IFNwYXduT3B0aW9ucyA9IHt9LFxuICApOiBQcm9taXNlPFNwYXduUmVzdWx0PiB7XG4gICAgaWYgKGF3YWl0IHBucG1WZXJzaW9uaW5nLmlzVXNpbmdQbnBtKHByb2plY3REaXIpKSB7XG4gICAgICBjb25zdCBwbnBtU3BlYyA9IGF3YWl0IHBucG1WZXJzaW9uaW5nLmdldFBhY2thZ2VTcGVjKHByb2plY3REaXIpO1xuICAgICAgcmV0dXJuIENoaWxkUHJvY2Vzcy5zcGF3bignbnB4JywgWyctLXllcycsIHBucG1TcGVjLCAnLXMnLCAncnVuJywgLi4uYXJnc10sIHtcbiAgICAgICAgLi4uc3Bhd25PcHRpb25zLFxuICAgICAgICBjd2Q6IHByb2plY3REaXIsXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm90ZTogV2UgY2Fubm90IHVzZSBgeWFybmAgZGlyZWN0bHkgYXMgY29tbWFuZCBiZWNhdXNlIHdlIG1pZ2h0IG9wZXJhdGUgaW5cbiAgICAgIC8vIGEgZGlmZmVyZW50IHB1Ymxpc2ggYnJhbmNoIGFuZCB0aGUgY3VycmVudCBgUEFUSGAgd2lsbCBwb2ludCB0byB0aGUgWWFybiB2ZXJzaW9uXG4gICAgICAvLyB0aGF0IGludm9rZWQgdGhlIHJlbGVhc2UgdG9vbC4gTW9yZSBkZXRhaWxzIGluIHRoZSBmdW5jdGlvbiBkZXNjcmlwdGlvbi5cbiAgICAgIGNvbnN0IHlhcm5Db21tYW5kID0gYXdhaXQgcmVzb2x2ZVlhcm5TY3JpcHRGb3JQcm9qZWN0KHByb2plY3REaXIpO1xuICAgICAgcmV0dXJuIENoaWxkUHJvY2Vzcy5zcGF3bih5YXJuQ29tbWFuZC5iaW5hcnksIFsuLi55YXJuQ29tbWFuZC5hcmdzLCAuLi5hcmdzXSwge1xuICAgICAgICAuLi5zcGF3bk9wdGlvbnMsXG4gICAgICAgIGN3ZDogcHJvamVjdERpcixcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIl19