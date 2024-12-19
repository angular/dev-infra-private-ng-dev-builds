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
    static async invokeSetNpmDist(projectDir, npmDistTag, version, options = { skipExperimentalPackages: false }) {
        // Note: We cannot use `yarn` directly as command because we might operate in
        // a different publish branch and the current `PATH` will point to the Yarn version
        // that invoked the release tool. More details in the function description.
        const yarnCommand = await resolveYarnScriptForProject(projectDir);
        try {
            // Note: No progress indicator needed as that is the responsibility of the command.
            // TODO: detect yarn berry and handle flag differences properly.
            await ChildProcess.spawn(yarnCommand.binary, [
                ...yarnCommand.args,
                'ng-dev',
                'release',
                'set-dist-tag',
                npmDistTag,
                version.format(),
                `--skip-experimental-packages=${options.skipExperimentalPackages}`,
            ], { cwd: projectDir });
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
    static async invokeDeleteNpmDistTag(projectDir, npmDistTag) {
        // Note: We cannot use `yarn` directly as command because we might operate in
        // a different publish branch and the current `PATH` will point to the Yarn version
        // that invoked the release tool. More details in the function description.
        const yarnCommand = await resolveYarnScriptForProject(projectDir);
        try {
            // Note: No progress indicator needed as that is the responsibility of the command.
            // TODO: detect yarn berry and handle flag differences properly.
            await ChildProcess.spawn(yarnCommand.binary, [...yarnCommand.args, 'ng-dev', 'release', 'npm-dist-tag', 'delete', npmDistTag], { cwd: projectDir });
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
    static async invokeReleaseBuild(projectDir) {
        // Note: We cannot use `yarn` directly as command because we might operate in
        // a different publish branch and the current `PATH` will point to the Yarn version
        // that invoked the release tool. More details in the function description.
        const yarnCommand = await resolveYarnScriptForProject(projectDir);
        // Note: We explicitly mention that this can take a few minutes, so that it's obvious
        // to caretakers that it can take longer than just a few seconds.
        const spinner = new Spinner('Building release output. This can take a few minutes.');
        try {
            // Since we expect JSON to be printed from the `ng-dev release build` command,
            // we spawn the process in silent mode. We have set up an Ora progress spinner.
            // TODO: detect yarn berry and handle flag differences properly.
            const { stdout } = await ChildProcess.spawn(yarnCommand.binary, [...yarnCommand.args, 'ng-dev', 'release', 'build', '--json'], {
                cwd: projectDir,
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
    static async invokeReleaseInfo(projectDir) {
        // Note: We cannot use `yarn` directly as command because we might operate in
        // a different publish branch and the current `PATH` will point to the Yarn version
        // that invoked the release tool. More details in the function description.
        const yarnCommand = await resolveYarnScriptForProject(projectDir);
        try {
            // Note: No progress indicator needed as that is expected to be a fast operation.
            // TODO: detect yarn berry and handle flag differences properly.
            const { stdout } = await ChildProcess.spawn(yarnCommand.binary, [...yarnCommand.args, 'ng-dev', 'release', 'info', '--json'], {
                cwd: projectDir,
                mode: 'silent',
            });
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
    static async invokeReleasePrecheck(projectDir, newVersion, builtPackagesWithInfo) {
        // Note: We cannot use `yarn` directly as command because we might operate in
        // a different publish branch and the current `PATH` will point to the Yarn version
        // that invoked the release tool. More details in the function description.
        const yarnCommand = await resolveYarnScriptForProject(projectDir);
        const precheckStdin = {
            builtPackagesWithInfo,
            newVersion: newVersion.format(),
        };
        try {
            // Note: No progress indicator needed as that is expected to be a fast operation. Also
            // we expect the command to handle console messaging and wouldn't want to clobber it.
            // TODO: detect yarn berry and handle flag differences properly.
            await ChildProcess.spawn(yarnCommand.binary, [...yarnCommand.args, 'ng-dev', 'release', 'precheck'], {
                cwd: projectDir,
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
     * Invokes the `yarn bazel run @npm2//:sync` command in order
     * to refresh Aspect lock files.
     */
    static async invokeBazelUpdateAspectLockFiles(projectDir) {
        // Note: We cannot use `yarn` directly as command because we might operate in
        // a different publish branch and the current `PATH` will point to the Yarn version
        // that invoked the release tool. More details in the function description.
        const yarnCommand = await resolveYarnScriptForProject(projectDir);
        try {
            // Note: No progress indicator needed as that is the responsibility of the command.
            // TODO: Consider using an Ora spinner instead to ensure minimal console output.
            await ChildProcess.spawn(yarnCommand.binary, [...yarnCommand.args, 'bazelisk', 'run', '@npm2//:sync'], { cwd: projectDir });
        }
        catch (e) {
            // Note: Gracefully handling these errors because `sync` command
            // alway exits with a non-zero exit code.
        }
        Log.info(green('  ✓   Updated Aspect `rules_js` lock files.'));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZXJuYWwtY29tbWFuZHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9wdWJsaXNoL2V4dGVybmFsLWNvbW1hbmRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUMxRCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFHL0MsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDM0QsT0FBTyxFQUFDLDJCQUEyQixFQUFDLE1BQU0saUNBQWlDLENBQUM7QUFLNUUsT0FBTyxFQUFDLEtBQUssRUFBRSxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUVsRDs7Ozs7Ozs7Ozs7Ozs7O0dBZUc7QUFFSCwwRUFBMEU7QUFDMUUsTUFBTSxPQUFnQixnQkFBZ0I7SUFDcEM7Ozs7OztPQU1HO0lBQ0gsTUFBTSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FDM0IsVUFBa0IsRUFDbEIsVUFBc0IsRUFDdEIsT0FBc0IsRUFDdEIsVUFBK0MsRUFBQyx3QkFBd0IsRUFBRSxLQUFLLEVBQUM7UUFFaEYsNkVBQTZFO1FBQzdFLG1GQUFtRjtRQUNuRiwyRUFBMkU7UUFDM0UsTUFBTSxXQUFXLEdBQUcsTUFBTSwyQkFBMkIsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUVsRSxJQUFJLENBQUM7WUFDSCxtRkFBbUY7WUFDbkYsZ0VBQWdFO1lBQ2hFLE1BQU0sWUFBWSxDQUFDLEtBQUssQ0FDdEIsV0FBVyxDQUFDLE1BQU0sRUFDbEI7Z0JBQ0UsR0FBRyxXQUFXLENBQUMsSUFBSTtnQkFDbkIsUUFBUTtnQkFDUixTQUFTO2dCQUNULGNBQWM7Z0JBQ2QsVUFBVTtnQkFDVixPQUFPLENBQUMsTUFBTSxFQUFFO2dCQUNoQixnQ0FBZ0MsT0FBTyxDQUFDLHdCQUF3QixF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QUFDLG1CQUFtQixFQUFFLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUM7YUFDdkYsRUFDRCxFQUFDLEdBQUcsRUFBRSxVQUFVLEVBQUMsQ0FDbEIsQ0FBQztZQUNGLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLHVDQUF1QyxDQUFDLENBQUMsQ0FBQztRQUMzRCxDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNYLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDYixHQUFHLENBQUMsS0FBSyxDQUFDLHdEQUF3RCxDQUFDLENBQUM7WUFDcEUsTUFBTSxJQUFJLHVCQUF1QixFQUFFLENBQUM7UUFDdEMsQ0FBQztJQUNILENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsS0FBSyxDQUFDLGdDQUFnQyxDQUFDLFVBQWtCO1FBQzlELDZFQUE2RTtRQUM3RSxtRkFBbUY7UUFDbkYsMkVBQTJFO1FBQzNFLE1BQU0sV0FBVyxHQUFHLE1BQU0sMkJBQTJCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFbEUsSUFBSSxDQUFDO1lBQ0gsbUZBQW1GO1lBQ25GLGdGQUFnRjtZQUNoRixNQUFNLFlBQVksQ0FBQyxLQUFLLENBQ3RCLFdBQVcsQ0FBQyxNQUFNLEVBQ2xCLENBQUMsR0FBRyxXQUFXLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUUsY0FBYyxDQUFDLEVBQ3hELEVBQUMsR0FBRyxFQUFFLFVBQVUsRUFBQyxDQUNsQixDQUFDO1FBQ0osQ0FBQztRQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDWCxnRUFBZ0U7WUFDaEUseUNBQXlDO1FBQzNDLENBQUM7UUFFRCxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyw2Q0FBNkMsQ0FBQyxDQUFDLENBQUM7SUFDakUsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBzZW12ZXIgZnJvbSAnc2VtdmVyJztcblxuaW1wb3J0IHtDaGlsZFByb2Nlc3N9IGZyb20gJy4uLy4uL3V0aWxzL2NoaWxkLXByb2Nlc3MuanMnO1xuaW1wb3J0IHtTcGlubmVyfSBmcm9tICcuLi8uLi91dGlscy9zcGlubmVyLmpzJztcbmltcG9ydCB7TnBtRGlzdFRhZ30gZnJvbSAnLi4vdmVyc2lvbmluZy9pbmRleC5qcyc7XG5cbmltcG9ydCB7RmF0YWxSZWxlYXNlQWN0aW9uRXJyb3J9IGZyb20gJy4vYWN0aW9ucy1lcnJvci5qcyc7XG5pbXBvcnQge3Jlc29sdmVZYXJuU2NyaXB0Rm9yUHJvamVjdH0gZnJvbSAnLi4vLi4vdXRpbHMvcmVzb2x2ZS15YXJuLWJpbi5qcyc7XG5pbXBvcnQge1JlbGVhc2VCdWlsZEpzb25TdGRvdXR9IGZyb20gJy4uL2J1aWxkL2NsaS5qcyc7XG5pbXBvcnQge1JlbGVhc2VJbmZvSnNvblN0ZG91dH0gZnJvbSAnLi4vaW5mby9jbGkuanMnO1xuaW1wb3J0IHtSZWxlYXNlUHJlY2hlY2tKc29uU3RkaW59IGZyb20gJy4uL3ByZWNoZWNrL2NsaS5qcyc7XG5pbXBvcnQge0J1aWx0UGFja2FnZVdpdGhJbmZvfSBmcm9tICcuLi9jb25maWcvaW5kZXguanMnO1xuaW1wb3J0IHtncmVlbiwgTG9nfSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcblxuLypcbiAqICMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjI1xuICpcbiAqIFRoaXMgZmlsZSBjb250YWlucyBoZWxwZXJzIGZvciBpbnZva2luZyBleHRlcm5hbCBgbmctZGV2YCBjb21tYW5kcy4gQSBzdWJzZXQgb2YgYWN0aW9ucyxcbiAqIGxpa2UgYnVpbGRpbmcgcmVsZWFzZSBvdXRwdXQgb3Igc2V0dGluZyBhzr0gTlBNIGRpc3QgdGFnIGZvciByZWxlYXNlIHBhY2thZ2VzLCBjYW5ub3QgYmVcbiAqIHBlcmZvcm1lZCBkaXJlY3RseSBhcyBwYXJ0IG9mIHRoZSByZWxlYXNlIHRvb2wgYW5kIG5lZWQgdG8gYmUgZGVsZWdhdGVkIHRvIGV4dGVybmFsIGBuZy1kZXZgXG4gKiBjb21tYW5kcyB0aGF0IGV4aXN0IGFjcm9zcyBhcmJpdHJhcnkgdmVyc2lvbiBicmFuY2hlcy5cbiAqXG4gKiBJbiBhIGNvbmNyZXRlIGV4YW1wbGU6IENvbnNpZGVyIGEgbmV3IHBhdGNoIHZlcnNpb24gaXMgcmVsZWFzZWQgYW5kIHRoYXQgYSBuZXcgcmVsZWFzZVxuICogcGFja2FnZSBoYXMgYmVlbiBhZGRlZCB0byB0aGUgYG5leHRgIGJyYW5jaC4gVGhlIHBhdGNoIGJyYW5jaCB3aWxsIG5vdCBjb250YWluIHRoZSBuZXdcbiAqIHJlbGVhc2UgcGFja2FnZSwgc28gd2UgY291bGQgbm90IGJ1aWxkIHRoZSByZWxlYXNlIG91dHB1dCBmb3IgaXQuIFRvIHdvcmsgYXJvdW5kIHRoaXMsIHdlXG4gKiBjYWxsIHRoZSBuZy1kZXYgYnVpbGQgY29tbWFuZCBmb3IgdGhlIHBhdGNoIHZlcnNpb24gYnJhbmNoIGFuZCBleHBlY3QgaXQgdG8gcmV0dXJuIGEgbGlzdFxuICogb2YgYnVpbHQgcGFja2FnZXMgdGhhdCBuZWVkIHRvIGJlIHJlbGVhc2VkIGFzIHBhcnQgb2YgdGhpcyByZWxlYXNlIHRyYWluLlxuICpcbiAqICMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjI1xuICovXG5cbi8qKiBDbGFzcyBob2xkaW5nIG1ldGhvZCBmb3IgaW52b2tpbmcgcmVsZWFzZSBhY3Rpb24gZXh0ZXJuYWwgY29tbWFuZHMuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRXh0ZXJuYWxDb21tYW5kcyB7XG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBgbmctZGV2IHJlbGVhc2Ugc2V0LWRpc3QtdGFnYCBjb21tYW5kIGluIG9yZGVyIHRvIHNldCB0aGUgc3BlY2lmaWVkXG4gICAqIE5QTSBkaXN0IHRhZyBmb3IgYWxsIHBhY2thZ2VzIGluIHRoZSBjaGVja2VkIG91dCBicmFuY2ggdG8gdGhlIGdpdmVuIHZlcnNpb24uXG4gICAqXG4gICAqIE9wdGlvbmFsbHksIHRoZSBOUE0gZGlzdCB0YWcgdXBkYXRlIGNhbiBiZSBza2lwcGVkIGZvciBleHBlcmltZW50YWwgcGFja2FnZXMuIFRoaXNcbiAgICogaXMgdXNlZnVsIHdoZW4gdGFnZ2luZyBsb25nLXRlcm0tc3VwcG9ydCBwYWNrYWdlcyB3aXRoaW4gTlBNLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZVNldE5wbURpc3QoXG4gICAgcHJvamVjdERpcjogc3RyaW5nLFxuICAgIG5wbURpc3RUYWc6IE5wbURpc3RUYWcsXG4gICAgdmVyc2lvbjogc2VtdmVyLlNlbVZlcixcbiAgICBvcHRpb25zOiB7c2tpcEV4cGVyaW1lbnRhbFBhY2thZ2VzOiBib29sZWFufSA9IHtza2lwRXhwZXJpbWVudGFsUGFja2FnZXM6IGZhbHNlfSxcbiAgKSB7XG4gICAgLy8gTm90ZTogV2UgY2Fubm90IHVzZSBgeWFybmAgZGlyZWN0bHkgYXMgY29tbWFuZCBiZWNhdXNlIHdlIG1pZ2h0IG9wZXJhdGUgaW5cbiAgICAvLyBhIGRpZmZlcmVudCBwdWJsaXNoIGJyYW5jaCBhbmQgdGhlIGN1cnJlbnQgYFBBVEhgIHdpbGwgcG9pbnQgdG8gdGhlIFlhcm4gdmVyc2lvblxuICAgIC8vIHRoYXQgaW52b2tlZCB0aGUgcmVsZWFzZSB0b29sLiBNb3JlIGRldGFpbHMgaW4gdGhlIGZ1bmN0aW9uIGRlc2NyaXB0aW9uLlxuICAgIGNvbnN0IHlhcm5Db21tYW5kID0gYXdhaXQgcmVzb2x2ZVlhcm5TY3JpcHRGb3JQcm9qZWN0KHByb2plY3REaXIpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIE5vdGU6IE5vIHByb2dyZXNzIGluZGljYXRvciBuZWVkZWQgYXMgdGhhdCBpcyB0aGUgcmVzcG9uc2liaWxpdHkgb2YgdGhlIGNvbW1hbmQuXG4gICAgICAvLyBUT0RPOiBkZXRlY3QgeWFybiBiZXJyeSBhbmQgaGFuZGxlIGZsYWcgZGlmZmVyZW5jZXMgcHJvcGVybHkuXG4gICAgICBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oXG4gICAgICAgIHlhcm5Db21tYW5kLmJpbmFyeSxcbiAgICAgICAgW1xuICAgICAgICAgIC4uLnlhcm5Db21tYW5kLmFyZ3MsXG4gICAgICAgICAgJ25nLWRldicsXG4gICAgICAgICAgJ3JlbGVhc2UnLFxuICAgICAgICAgICdzZXQtZGlzdC10YWcnLFxuICAgICAgICAgIG5wbURpc3RUYWcsXG4gICAgICAgICAgdmVyc2lvbi5mb3JtYXQoKSxcbiAgICAgICAgICBgLS1za2lwLWV4cGVyaW1lbnRhbC1wYWNrYWdlcz0ke29wdGlvbnMuc2tpcEV4cGVyaW1lbnRhbFBhY2thZ2VzfWAsXG4gICAgICAgIF0sXG4gICAgICAgIHtjd2Q6IHByb2plY3REaXJ9LFxuICAgICAgKTtcbiAgICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIFNldCBcIiR7bnBtRGlzdFRhZ31cIiBOUE0gZGlzdCB0YWcgZm9yIGFsbCBwYWNrYWdlcyB0byB2JHt2ZXJzaW9ufS5gKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgTG9nLmVycm9yKGUpO1xuICAgICAgTG9nLmVycm9yKGAgIOKcmCAgIEFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHNldHRpbmcgdGhlIE5QTSBkaXN0IHRhZyBmb3IgXCIke25wbURpc3RUYWd9XCIuYCk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlcyB0aGUgYG5nLWRldiByZWxlYXNlIG5wbS1kaXN0LXRhZyBkZWxldGVgIGNvbW1hbmQgaW4gb3JkZXIgdG8gZGVsZXRlIHRoZVxuICAgKiBOUE0gZGlzdCB0YWcgZm9yIGFsbCBwYWNrYWdlcyBpbiB0aGUgY2hlY2tlZC1vdXQgdmVyc2lvbiBicmFuY2guXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW52b2tlRGVsZXRlTnBtRGlzdFRhZyhwcm9qZWN0RGlyOiBzdHJpbmcsIG5wbURpc3RUYWc6IE5wbURpc3RUYWcpIHtcbiAgICAvLyBOb3RlOiBXZSBjYW5ub3QgdXNlIGB5YXJuYCBkaXJlY3RseSBhcyBjb21tYW5kIGJlY2F1c2Ugd2UgbWlnaHQgb3BlcmF0ZSBpblxuICAgIC8vIGEgZGlmZmVyZW50IHB1Ymxpc2ggYnJhbmNoIGFuZCB0aGUgY3VycmVudCBgUEFUSGAgd2lsbCBwb2ludCB0byB0aGUgWWFybiB2ZXJzaW9uXG4gICAgLy8gdGhhdCBpbnZva2VkIHRoZSByZWxlYXNlIHRvb2wuIE1vcmUgZGV0YWlscyBpbiB0aGUgZnVuY3Rpb24gZGVzY3JpcHRpb24uXG4gICAgY29uc3QgeWFybkNvbW1hbmQgPSBhd2FpdCByZXNvbHZlWWFyblNjcmlwdEZvclByb2plY3QocHJvamVjdERpcik7XG5cbiAgICB0cnkge1xuICAgICAgLy8gTm90ZTogTm8gcHJvZ3Jlc3MgaW5kaWNhdG9yIG5lZWRlZCBhcyB0aGF0IGlzIHRoZSByZXNwb25zaWJpbGl0eSBvZiB0aGUgY29tbWFuZC5cbiAgICAgIC8vIFRPRE86IGRldGVjdCB5YXJuIGJlcnJ5IGFuZCBoYW5kbGUgZmxhZyBkaWZmZXJlbmNlcyBwcm9wZXJseS5cbiAgICAgIGF3YWl0IENoaWxkUHJvY2Vzcy5zcGF3bihcbiAgICAgICAgeWFybkNvbW1hbmQuYmluYXJ5LFxuICAgICAgICBbLi4ueWFybkNvbW1hbmQuYXJncywgJ25nLWRldicsICdyZWxlYXNlJywgJ25wbS1kaXN0LXRhZycsICdkZWxldGUnLCBucG1EaXN0VGFnXSxcbiAgICAgICAge2N3ZDogcHJvamVjdERpcn0sXG4gICAgICApO1xuICAgICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgRGVsZXRlZCBcIiR7bnBtRGlzdFRhZ31cIiBOUE0gZGlzdCB0YWcgZm9yIGFsbCBwYWNrYWdlcy5gKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgTG9nLmVycm9yKGUpO1xuICAgICAgTG9nLmVycm9yKGAgIOKcmCAgIEFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGRlbGV0aW5nIHRoZSBOUE0gZGlzdCB0YWc6IFwiJHtucG1EaXN0VGFnfVwiLmApO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEludm9rZXMgdGhlIGBuZy1kZXYgcmVsZWFzZSBidWlsZGAgY29tbWFuZCBpbiBvcmRlciB0byBidWlsZCB0aGUgcmVsZWFzZVxuICAgKiBwYWNrYWdlcyBmb3IgdGhlIGN1cnJlbnRseSBjaGVja2VkIG91dCBicmFuY2guXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW52b2tlUmVsZWFzZUJ1aWxkKHByb2plY3REaXI6IHN0cmluZyk6IFByb21pc2U8UmVsZWFzZUJ1aWxkSnNvblN0ZG91dD4ge1xuICAgIC8vIE5vdGU6IFdlIGNhbm5vdCB1c2UgYHlhcm5gIGRpcmVjdGx5IGFzIGNvbW1hbmQgYmVjYXVzZSB3ZSBtaWdodCBvcGVyYXRlIGluXG4gICAgLy8gYSBkaWZmZXJlbnQgcHVibGlzaCBicmFuY2ggYW5kIHRoZSBjdXJyZW50IGBQQVRIYCB3aWxsIHBvaW50IHRvIHRoZSBZYXJuIHZlcnNpb25cbiAgICAvLyB0aGF0IGludm9rZWQgdGhlIHJlbGVhc2UgdG9vbC4gTW9yZSBkZXRhaWxzIGluIHRoZSBmdW5jdGlvbiBkZXNjcmlwdGlvbi5cbiAgICBjb25zdCB5YXJuQ29tbWFuZCA9IGF3YWl0IHJlc29sdmVZYXJuU2NyaXB0Rm9yUHJvamVjdChwcm9qZWN0RGlyKTtcbiAgICAvLyBOb3RlOiBXZSBleHBsaWNpdGx5IG1lbnRpb24gdGhhdCB0aGlzIGNhbiB0YWtlIGEgZmV3IG1pbnV0ZXMsIHNvIHRoYXQgaXQncyBvYnZpb3VzXG4gICAgLy8gdG8gY2FyZXRha2VycyB0aGF0IGl0IGNhbiB0YWtlIGxvbmdlciB0aGFuIGp1c3QgYSBmZXcgc2Vjb25kcy5cbiAgICBjb25zdCBzcGlubmVyID0gbmV3IFNwaW5uZXIoJ0J1aWxkaW5nIHJlbGVhc2Ugb3V0cHV0LiBUaGlzIGNhbiB0YWtlIGEgZmV3IG1pbnV0ZXMuJyk7XG5cbiAgICB0cnkge1xuICAgICAgLy8gU2luY2Ugd2UgZXhwZWN0IEpTT04gdG8gYmUgcHJpbnRlZCBmcm9tIHRoZSBgbmctZGV2IHJlbGVhc2UgYnVpbGRgIGNvbW1hbmQsXG4gICAgICAvLyB3ZSBzcGF3biB0aGUgcHJvY2VzcyBpbiBzaWxlbnQgbW9kZS4gV2UgaGF2ZSBzZXQgdXAgYW4gT3JhIHByb2dyZXNzIHNwaW5uZXIuXG4gICAgICAvLyBUT0RPOiBkZXRlY3QgeWFybiBiZXJyeSBhbmQgaGFuZGxlIGZsYWcgZGlmZmVyZW5jZXMgcHJvcGVybHkuXG4gICAgICBjb25zdCB7c3Rkb3V0fSA9IGF3YWl0IENoaWxkUHJvY2Vzcy5zcGF3bihcbiAgICAgICAgeWFybkNvbW1hbmQuYmluYXJ5LFxuICAgICAgICBbLi4ueWFybkNvbW1hbmQuYXJncywgJ25nLWRldicsICdyZWxlYXNlJywgJ2J1aWxkJywgJy0tanNvbiddLFxuICAgICAgICB7XG4gICAgICAgICAgY3dkOiBwcm9qZWN0RGlyLFxuICAgICAgICAgIG1vZGU6ICdzaWxlbnQnLFxuICAgICAgICB9LFxuICAgICAgKTtcbiAgICAgIHNwaW5uZXIuY29tcGxldGUoKTtcbiAgICAgIExvZy5pbmZvKGdyZWVuKCcgIOKckyAgIEJ1aWx0IHJlbGVhc2Ugb3V0cHV0IGZvciBhbGwgcGFja2FnZXMuJykpO1xuICAgICAgLy8gVGhlIGBuZy1kZXYgcmVsZWFzZSBidWlsZGAgY29tbWFuZCBwcmludHMgYSBKU09OIGFycmF5IHRvIHN0ZG91dFxuICAgICAgLy8gdGhhdCByZXByZXNlbnRzIHRoZSBidWlsdCByZWxlYXNlIHBhY2thZ2VzIGFuZCB0aGVpciBvdXRwdXQgcGF0aHMuXG4gICAgICByZXR1cm4gSlNPTi5wYXJzZShzdGRvdXQudHJpbSgpKSBhcyBSZWxlYXNlQnVpbGRKc29uU3Rkb3V0O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHNwaW5uZXIuY29tcGxldGUoKTtcbiAgICAgIExvZy5lcnJvcihlKTtcbiAgICAgIExvZy5lcnJvcignICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBidWlsZGluZyB0aGUgcmVsZWFzZSBwYWNrYWdlcy4nKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBgbmctZGV2IHJlbGVhc2UgaW5mb2AgY29tbWFuZCBpbiBvcmRlciB0byByZXRyaWV2ZSBpbmZvcm1hdGlvblxuICAgKiBhYm91dCB0aGUgcmVsZWFzZSBmb3IgdGhlIGN1cnJlbnRseSBjaGVja2VkLW91dCBicmFuY2guXG4gICAqXG4gICAqIFRoaXMgaXMgdXNlZnVsIHRvIGUuZy4gZGV0ZXJtaW5lIHdoZXRoZXIgYSBidWlsdCBwYWNrYWdlIGlzIGN1cnJlbnRseVxuICAgKiBkZW5vdGVkIGFzIGV4cGVyaW1lbnRhbCBvciBub3QuXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW52b2tlUmVsZWFzZUluZm8ocHJvamVjdERpcjogc3RyaW5nKTogUHJvbWlzZTxSZWxlYXNlSW5mb0pzb25TdGRvdXQ+IHtcbiAgICAvLyBOb3RlOiBXZSBjYW5ub3QgdXNlIGB5YXJuYCBkaXJlY3RseSBhcyBjb21tYW5kIGJlY2F1c2Ugd2UgbWlnaHQgb3BlcmF0ZSBpblxuICAgIC8vIGEgZGlmZmVyZW50IHB1Ymxpc2ggYnJhbmNoIGFuZCB0aGUgY3VycmVudCBgUEFUSGAgd2lsbCBwb2ludCB0byB0aGUgWWFybiB2ZXJzaW9uXG4gICAgLy8gdGhhdCBpbnZva2VkIHRoZSByZWxlYXNlIHRvb2wuIE1vcmUgZGV0YWlscyBpbiB0aGUgZnVuY3Rpb24gZGVzY3JpcHRpb24uXG4gICAgY29uc3QgeWFybkNvbW1hbmQgPSBhd2FpdCByZXNvbHZlWWFyblNjcmlwdEZvclByb2plY3QocHJvamVjdERpcik7XG5cbiAgICB0cnkge1xuICAgICAgLy8gTm90ZTogTm8gcHJvZ3Jlc3MgaW5kaWNhdG9yIG5lZWRlZCBhcyB0aGF0IGlzIGV4cGVjdGVkIHRvIGJlIGEgZmFzdCBvcGVyYXRpb24uXG4gICAgICAvLyBUT0RPOiBkZXRlY3QgeWFybiBiZXJyeSBhbmQgaGFuZGxlIGZsYWcgZGlmZmVyZW5jZXMgcHJvcGVybHkuXG4gICAgICBjb25zdCB7c3Rkb3V0fSA9IGF3YWl0IENoaWxkUHJvY2Vzcy5zcGF3bihcbiAgICAgICAgeWFybkNvbW1hbmQuYmluYXJ5LFxuICAgICAgICBbLi4ueWFybkNvbW1hbmQuYXJncywgJ25nLWRldicsICdyZWxlYXNlJywgJ2luZm8nLCAnLS1qc29uJ10sXG4gICAgICAgIHtcbiAgICAgICAgICBjd2Q6IHByb2plY3REaXIsXG4gICAgICAgICAgbW9kZTogJ3NpbGVudCcsXG4gICAgICAgIH0sXG4gICAgICApO1xuICAgICAgLy8gVGhlIGBuZy1kZXYgcmVsZWFzZSBpbmZvYCBjb21tYW5kIHByaW50cyBhIEpTT04gb2JqZWN0IHRvIHN0ZG91dC5cbiAgICAgIHJldHVybiBKU09OLnBhcnNlKHN0ZG91dC50cmltKCkpIGFzIFJlbGVhc2VJbmZvSnNvblN0ZG91dDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBMb2cuZXJyb3IoZSk7XG4gICAgICBMb2cuZXJyb3IoXG4gICAgICAgIGAgIOKcmCAgIEFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHJldHJpZXZpbmcgdGhlIHJlbGVhc2UgaW5mb3JtYXRpb24gZm9yIGAgK1xuICAgICAgICAgIGB0aGUgY3VycmVudGx5IGNoZWNrZWQtb3V0IGJyYW5jaC5gLFxuICAgICAgKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBgbmctZGV2IHJlbGVhc2UgcHJlY2hlY2tgIGNvbW1hbmQgaW4gb3JkZXIgdG8gdmFsaWRhdGUgdGhlXG4gICAqIGJ1aWx0IHBhY2thZ2VzIG9yIHJ1biBvdGhlciB2YWxpZGF0aW9ucyBiZWZvcmUgYWN0dWFsbHkgcmVsZWFzaW5nLlxuICAgKlxuICAgKiBUaGlzIGlzIHJ1biBhcyBhbiBleHRlcm5hbCBjb21tYW5kIGJlY2F1c2UgcHJlY2hlY2tzIGNhbiBiZSBjdXN0b21pemVkXG4gICAqIHRocm91Z2ggdGhlIGBuZy1kZXZgIGNvbmZpZ3VyYXRpb24sIGFuZCB3ZSB3b3VsZG4ndCB3YW50IHRvIHJ1biBwcmVjaGVja3NcbiAgICogZnJvbSB0aGUgYG5leHRgIGJyYW5jaCBmb3Igb2xkZXIgYnJhbmNoZXMsIGxpa2UgcGF0Y2ggb3IgYW4gTFRTIGJyYW5jaC5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBpbnZva2VSZWxlYXNlUHJlY2hlY2soXG4gICAgcHJvamVjdERpcjogc3RyaW5nLFxuICAgIG5ld1ZlcnNpb246IHNlbXZlci5TZW1WZXIsXG4gICAgYnVpbHRQYWNrYWdlc1dpdGhJbmZvOiBCdWlsdFBhY2thZ2VXaXRoSW5mb1tdLFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBOb3RlOiBXZSBjYW5ub3QgdXNlIGB5YXJuYCBkaXJlY3RseSBhcyBjb21tYW5kIGJlY2F1c2Ugd2UgbWlnaHQgb3BlcmF0ZSBpblxuICAgIC8vIGEgZGlmZmVyZW50IHB1Ymxpc2ggYnJhbmNoIGFuZCB0aGUgY3VycmVudCBgUEFUSGAgd2lsbCBwb2ludCB0byB0aGUgWWFybiB2ZXJzaW9uXG4gICAgLy8gdGhhdCBpbnZva2VkIHRoZSByZWxlYXNlIHRvb2wuIE1vcmUgZGV0YWlscyBpbiB0aGUgZnVuY3Rpb24gZGVzY3JpcHRpb24uXG4gICAgY29uc3QgeWFybkNvbW1hbmQgPSBhd2FpdCByZXNvbHZlWWFyblNjcmlwdEZvclByb2plY3QocHJvamVjdERpcik7XG4gICAgY29uc3QgcHJlY2hlY2tTdGRpbjogUmVsZWFzZVByZWNoZWNrSnNvblN0ZGluID0ge1xuICAgICAgYnVpbHRQYWNrYWdlc1dpdGhJbmZvLFxuICAgICAgbmV3VmVyc2lvbjogbmV3VmVyc2lvbi5mb3JtYXQoKSxcbiAgICB9O1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIE5vdGU6IE5vIHByb2dyZXNzIGluZGljYXRvciBuZWVkZWQgYXMgdGhhdCBpcyBleHBlY3RlZCB0byBiZSBhIGZhc3Qgb3BlcmF0aW9uLiBBbHNvXG4gICAgICAvLyB3ZSBleHBlY3QgdGhlIGNvbW1hbmQgdG8gaGFuZGxlIGNvbnNvbGUgbWVzc2FnaW5nIGFuZCB3b3VsZG4ndCB3YW50IHRvIGNsb2JiZXIgaXQuXG4gICAgICAvLyBUT0RPOiBkZXRlY3QgeWFybiBiZXJyeSBhbmQgaGFuZGxlIGZsYWcgZGlmZmVyZW5jZXMgcHJvcGVybHkuXG4gICAgICBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oXG4gICAgICAgIHlhcm5Db21tYW5kLmJpbmFyeSxcbiAgICAgICAgWy4uLnlhcm5Db21tYW5kLmFyZ3MsICduZy1kZXYnLCAncmVsZWFzZScsICdwcmVjaGVjayddLFxuICAgICAgICB7XG4gICAgICAgICAgY3dkOiBwcm9qZWN0RGlyLFxuICAgICAgICAgIC8vIE5vdGU6IFdlIHBhc3MgdGhlIHByZWNoZWNrIGluZm9ybWF0aW9uIHRvIHRoZSBjb21tYW5kIHRocm91Z2ggYHN0ZGluYFxuICAgICAgICAgIC8vIGJlY2F1c2UgY29tbWFuZCBsaW5lIGFyZ3VtZW50cyBhcmUgbGVzcyByZWxpYWJsZSBhbmQgaGF2ZSBsZW5ndGggbGltaXRzLlxuICAgICAgICAgIGlucHV0OiBKU09OLnN0cmluZ2lmeShwcmVjaGVja1N0ZGluKSxcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBFeGVjdXRlZCByZWxlYXNlIHByZS1jaGVja3MgZm9yICR7bmV3VmVyc2lvbn1gKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gVGhlIGBzcGF3bmAgaW52b2NhdGlvbiBhbHJlYWR5IHByaW50cyBhbGwgc3Rkb3V0L3N0ZGVyciwgc28gd2UgZG9uJ3QgbmVlZCByZS1wcmludC5cbiAgICAgIC8vIFRvIGVhc2UgZGVidWdnaW5nIGluIGNhc2Ugb2YgcnVudGltZSBleGNlcHRpb25zLCB3ZSBzdGlsbCBwcmludCB0aGUgZXJyb3IgdG8gYGRlYnVnYC5cbiAgICAgIExvZy5kZWJ1ZyhlKTtcbiAgICAgIExvZy5lcnJvcihgICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBydW5uaW5nIHJlbGVhc2UgcHJlLWNoZWNrcy5gKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBgeWFybiBpbnN0YWxsYCBjb21tYW5kIGluIG9yZGVyIHRvIGluc3RhbGwgZGVwZW5kZW5jaWVzIGZvclxuICAgKiB0aGUgY29uZmlndXJlZCBwcm9qZWN0IHdpdGggdGhlIGN1cnJlbnRseSBjaGVja2VkIG91dCByZXZpc2lvbi5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBpbnZva2VZYXJuSW5zdGFsbChwcm9qZWN0RGlyOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyBOb3RlOiBXZSBjYW5ub3QgdXNlIGB5YXJuYCBkaXJlY3RseSBhcyBjb21tYW5kIGJlY2F1c2Ugd2UgbWlnaHQgb3BlcmF0ZSBpblxuICAgIC8vIGEgZGlmZmVyZW50IHB1Ymxpc2ggYnJhbmNoIGFuZCB0aGUgY3VycmVudCBgUEFUSGAgd2lsbCBwb2ludCB0byB0aGUgWWFybiB2ZXJzaW9uXG4gICAgLy8gdGhhdCBpbnZva2VkIHRoZSByZWxlYXNlIHRvb2wuIE1vcmUgZGV0YWlscyBpbiB0aGUgZnVuY3Rpb24gZGVzY3JpcHRpb24uXG4gICAgY29uc3QgeWFybkNvbW1hbmQgPSBhd2FpdCByZXNvbHZlWWFyblNjcmlwdEZvclByb2plY3QocHJvamVjdERpcik7XG5cbiAgICB0cnkge1xuICAgICAgLy8gTm90ZTogTm8gcHJvZ3Jlc3MgaW5kaWNhdG9yIG5lZWRlZCBhcyB0aGF0IGlzIHRoZSByZXNwb25zaWJpbGl0eSBvZiB0aGUgY29tbWFuZC5cbiAgICAgIC8vIFRPRE86IENvbnNpZGVyIHVzaW5nIGFuIE9yYSBzcGlubmVyIGluc3RlYWQgdG8gZW5zdXJlIG1pbmltYWwgY29uc29sZSBvdXRwdXQuXG4gICAgICBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oXG4gICAgICAgIHlhcm5Db21tYW5kLmJpbmFyeSxcbiAgICAgICAgW1xuICAgICAgICAgIC4uLnlhcm5Db21tYW5kLmFyZ3MsXG4gICAgICAgICAgJ2luc3RhbGwnLFxuICAgICAgICAgIC4uLih5YXJuQ29tbWFuZC5sZWdhY3kgPyBbJy0tZnJvemVuLWxvY2tmaWxlJywgJy0tbm9uLWludGVyYWN0aXZlJ10gOiBbJy0taW1tdXRhYmxlJ10pLFxuICAgICAgICBdLFxuICAgICAgICB7Y3dkOiBwcm9qZWN0RGlyfSxcbiAgICAgICk7XG4gICAgICBMb2cuaW5mbyhncmVlbignICDinJMgICBJbnN0YWxsZWQgcHJvamVjdCBkZXBlbmRlbmNpZXMuJykpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIExvZy5lcnJvcihlKTtcbiAgICAgIExvZy5lcnJvcignICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBpbnN0YWxsaW5nIGRlcGVuZGVuY2llcy4nKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBgeWFybiBiYXplbCBydW4gQG5wbTIvLzpzeW5jYCBjb21tYW5kIGluIG9yZGVyXG4gICAqIHRvIHJlZnJlc2ggQXNwZWN0IGxvY2sgZmlsZXMuXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW52b2tlQmF6ZWxVcGRhdGVBc3BlY3RMb2NrRmlsZXMocHJvamVjdERpcjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gTm90ZTogV2UgY2Fubm90IHVzZSBgeWFybmAgZGlyZWN0bHkgYXMgY29tbWFuZCBiZWNhdXNlIHdlIG1pZ2h0IG9wZXJhdGUgaW5cbiAgICAvLyBhIGRpZmZlcmVudCBwdWJsaXNoIGJyYW5jaCBhbmQgdGhlIGN1cnJlbnQgYFBBVEhgIHdpbGwgcG9pbnQgdG8gdGhlIFlhcm4gdmVyc2lvblxuICAgIC8vIHRoYXQgaW52b2tlZCB0aGUgcmVsZWFzZSB0b29sLiBNb3JlIGRldGFpbHMgaW4gdGhlIGZ1bmN0aW9uIGRlc2NyaXB0aW9uLlxuICAgIGNvbnN0IHlhcm5Db21tYW5kID0gYXdhaXQgcmVzb2x2ZVlhcm5TY3JpcHRGb3JQcm9qZWN0KHByb2plY3REaXIpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIE5vdGU6IE5vIHByb2dyZXNzIGluZGljYXRvciBuZWVkZWQgYXMgdGhhdCBpcyB0aGUgcmVzcG9uc2liaWxpdHkgb2YgdGhlIGNvbW1hbmQuXG4gICAgICAvLyBUT0RPOiBDb25zaWRlciB1c2luZyBhbiBPcmEgc3Bpbm5lciBpbnN0ZWFkIHRvIGVuc3VyZSBtaW5pbWFsIGNvbnNvbGUgb3V0cHV0LlxuICAgICAgYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKFxuICAgICAgICB5YXJuQ29tbWFuZC5iaW5hcnksXG4gICAgICAgIFsuLi55YXJuQ29tbWFuZC5hcmdzLCAnYmF6ZWxpc2snLCAncnVuJywgJ0BucG0yLy86c3luYyddLFxuICAgICAgICB7Y3dkOiBwcm9qZWN0RGlyfSxcbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gTm90ZTogR3JhY2VmdWxseSBoYW5kbGluZyB0aGVzZSBlcnJvcnMgYmVjYXVzZSBgc3luY2AgY29tbWFuZFxuICAgICAgLy8gYWx3YXkgZXhpdHMgd2l0aCBhIG5vbi16ZXJvIGV4aXQgY29kZS5cbiAgICB9XG5cbiAgICBMb2cuaW5mbyhncmVlbignICDinJMgICBVcGRhdGVkIEFzcGVjdCBgcnVsZXNfanNgIGxvY2sgZmlsZXMuJykpO1xuICB9XG59XG4iXX0=