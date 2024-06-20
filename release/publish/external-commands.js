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
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZXJuYWwtY29tbWFuZHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9wdWJsaXNoL2V4dGVybmFsLWNvbW1hbmRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUMxRCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFHL0MsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDM0QsT0FBTyxFQUFDLDJCQUEyQixFQUFDLE1BQU0saUNBQWlDLENBQUM7QUFLNUUsT0FBTyxFQUFDLEtBQUssRUFBRSxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUVsRDs7Ozs7Ozs7Ozs7Ozs7O0dBZUc7QUFFSCwwRUFBMEU7QUFDMUUsTUFBTSxPQUFnQixnQkFBZ0I7SUFDcEM7Ozs7OztPQU1HO0lBQ0gsTUFBTSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FDM0IsVUFBa0IsRUFDbEIsVUFBc0IsRUFDdEIsT0FBc0IsRUFDdEIsVUFBK0MsRUFBQyx3QkFBd0IsRUFBRSxLQUFLLEVBQUM7UUFFaEYsNkVBQTZFO1FBQzdFLG1GQUFtRjtRQUNuRiwyRUFBMkU7UUFDM0UsTUFBTSxXQUFXLEdBQUcsTUFBTSwyQkFBMkIsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUVsRSxJQUFJLENBQUM7WUFDSCxtRkFBbUY7WUFDbkYsZ0VBQWdFO1lBQ2hFLE1BQU0sWUFBWSxDQUFDLEtBQUssQ0FDdEIsV0FBVyxDQUFDLE1BQU0sRUFDbEI7Z0JBQ0UsR0FBRyxXQUFXLENBQUMsSUFBSTtnQkFDbkIsUUFBUTtnQkFDUixTQUFTO2dCQUNULGNBQWM7Z0JBQ2QsVUFBVTtnQkFDVixPQUFPLENBQUMsTUFBTSxFQUFFO2dCQUNoQixnQ0FBZ0MsT0FBTyxDQUFDLHdCQUF3QixF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QUFDLG1CQUFtQixFQUFFLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUM7YUFDdkYsRUFDRCxFQUFDLEdBQUcsRUFBRSxVQUFVLEVBQUMsQ0FDbEIsQ0FBQztZQUNGLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLHVDQUF1QyxDQUFDLENBQUMsQ0FBQztRQUMzRCxDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNYLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDYixHQUFHLENBQUMsS0FBSyxDQUFDLHdEQUF3RCxDQUFDLENBQUM7WUFDcEUsTUFBTSxJQUFJLHVCQUF1QixFQUFFLENBQUM7UUFDdEMsQ0FBQztJQUNILENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XG5cbmltcG9ydCB7Q2hpbGRQcm9jZXNzfSBmcm9tICcuLi8uLi91dGlscy9jaGlsZC1wcm9jZXNzLmpzJztcbmltcG9ydCB7U3Bpbm5lcn0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lci5qcyc7XG5pbXBvcnQge05wbURpc3RUYWd9IGZyb20gJy4uL3ZlcnNpb25pbmcvaW5kZXguanMnO1xuXG5pbXBvcnQge0ZhdGFsUmVsZWFzZUFjdGlvbkVycm9yfSBmcm9tICcuL2FjdGlvbnMtZXJyb3IuanMnO1xuaW1wb3J0IHtyZXNvbHZlWWFyblNjcmlwdEZvclByb2plY3R9IGZyb20gJy4uLy4uL3V0aWxzL3Jlc29sdmUteWFybi1iaW4uanMnO1xuaW1wb3J0IHtSZWxlYXNlQnVpbGRKc29uU3Rkb3V0fSBmcm9tICcuLi9idWlsZC9jbGkuanMnO1xuaW1wb3J0IHtSZWxlYXNlSW5mb0pzb25TdGRvdXR9IGZyb20gJy4uL2luZm8vY2xpLmpzJztcbmltcG9ydCB7UmVsZWFzZVByZWNoZWNrSnNvblN0ZGlufSBmcm9tICcuLi9wcmVjaGVjay9jbGkuanMnO1xuaW1wb3J0IHtCdWlsdFBhY2thZ2VXaXRoSW5mb30gZnJvbSAnLi4vY29uZmlnL2luZGV4LmpzJztcbmltcG9ydCB7Z3JlZW4sIExvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5cbi8qXG4gKiAjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyNcbiAqXG4gKiBUaGlzIGZpbGUgY29udGFpbnMgaGVscGVycyBmb3IgaW52b2tpbmcgZXh0ZXJuYWwgYG5nLWRldmAgY29tbWFuZHMuIEEgc3Vic2V0IG9mIGFjdGlvbnMsXG4gKiBsaWtlIGJ1aWxkaW5nIHJlbGVhc2Ugb3V0cHV0IG9yIHNldHRpbmcgYc69IE5QTSBkaXN0IHRhZyBmb3IgcmVsZWFzZSBwYWNrYWdlcywgY2Fubm90IGJlXG4gKiBwZXJmb3JtZWQgZGlyZWN0bHkgYXMgcGFydCBvZiB0aGUgcmVsZWFzZSB0b29sIGFuZCBuZWVkIHRvIGJlIGRlbGVnYXRlZCB0byBleHRlcm5hbCBgbmctZGV2YFxuICogY29tbWFuZHMgdGhhdCBleGlzdCBhY3Jvc3MgYXJiaXRyYXJ5IHZlcnNpb24gYnJhbmNoZXMuXG4gKlxuICogSW4gYSBjb25jcmV0ZSBleGFtcGxlOiBDb25zaWRlciBhIG5ldyBwYXRjaCB2ZXJzaW9uIGlzIHJlbGVhc2VkIGFuZCB0aGF0IGEgbmV3IHJlbGVhc2VcbiAqIHBhY2thZ2UgaGFzIGJlZW4gYWRkZWQgdG8gdGhlIGBuZXh0YCBicmFuY2guIFRoZSBwYXRjaCBicmFuY2ggd2lsbCBub3QgY29udGFpbiB0aGUgbmV3XG4gKiByZWxlYXNlIHBhY2thZ2UsIHNvIHdlIGNvdWxkIG5vdCBidWlsZCB0aGUgcmVsZWFzZSBvdXRwdXQgZm9yIGl0LiBUbyB3b3JrIGFyb3VuZCB0aGlzLCB3ZVxuICogY2FsbCB0aGUgbmctZGV2IGJ1aWxkIGNvbW1hbmQgZm9yIHRoZSBwYXRjaCB2ZXJzaW9uIGJyYW5jaCBhbmQgZXhwZWN0IGl0IHRvIHJldHVybiBhIGxpc3RcbiAqIG9mIGJ1aWx0IHBhY2thZ2VzIHRoYXQgbmVlZCB0byBiZSByZWxlYXNlZCBhcyBwYXJ0IG9mIHRoaXMgcmVsZWFzZSB0cmFpbi5cbiAqXG4gKiAjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyNcbiAqL1xuXG4vKiogQ2xhc3MgaG9sZGluZyBtZXRob2QgZm9yIGludm9raW5nIHJlbGVhc2UgYWN0aW9uIGV4dGVybmFsIGNvbW1hbmRzLiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEV4dGVybmFsQ29tbWFuZHMge1xuICAvKipcbiAgICogSW52b2tlcyB0aGUgYG5nLWRldiByZWxlYXNlIHNldC1kaXN0LXRhZ2AgY29tbWFuZCBpbiBvcmRlciB0byBzZXQgdGhlIHNwZWNpZmllZFxuICAgKiBOUE0gZGlzdCB0YWcgZm9yIGFsbCBwYWNrYWdlcyBpbiB0aGUgY2hlY2tlZCBvdXQgYnJhbmNoIHRvIHRoZSBnaXZlbiB2ZXJzaW9uLlxuICAgKlxuICAgKiBPcHRpb25hbGx5LCB0aGUgTlBNIGRpc3QgdGFnIHVwZGF0ZSBjYW4gYmUgc2tpcHBlZCBmb3IgZXhwZXJpbWVudGFsIHBhY2thZ2VzLiBUaGlzXG4gICAqIGlzIHVzZWZ1bCB3aGVuIHRhZ2dpbmcgbG9uZy10ZXJtLXN1cHBvcnQgcGFja2FnZXMgd2l0aGluIE5QTS5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBpbnZva2VTZXROcG1EaXN0KFxuICAgIHByb2plY3REaXI6IHN0cmluZyxcbiAgICBucG1EaXN0VGFnOiBOcG1EaXN0VGFnLFxuICAgIHZlcnNpb246IHNlbXZlci5TZW1WZXIsXG4gICAgb3B0aW9uczoge3NraXBFeHBlcmltZW50YWxQYWNrYWdlczogYm9vbGVhbn0gPSB7c2tpcEV4cGVyaW1lbnRhbFBhY2thZ2VzOiBmYWxzZX0sXG4gICkge1xuICAgIC8vIE5vdGU6IFdlIGNhbm5vdCB1c2UgYHlhcm5gIGRpcmVjdGx5IGFzIGNvbW1hbmQgYmVjYXVzZSB3ZSBtaWdodCBvcGVyYXRlIGluXG4gICAgLy8gYSBkaWZmZXJlbnQgcHVibGlzaCBicmFuY2ggYW5kIHRoZSBjdXJyZW50IGBQQVRIYCB3aWxsIHBvaW50IHRvIHRoZSBZYXJuIHZlcnNpb25cbiAgICAvLyB0aGF0IGludm9rZWQgdGhlIHJlbGVhc2UgdG9vbC4gTW9yZSBkZXRhaWxzIGluIHRoZSBmdW5jdGlvbiBkZXNjcmlwdGlvbi5cbiAgICBjb25zdCB5YXJuQ29tbWFuZCA9IGF3YWl0IHJlc29sdmVZYXJuU2NyaXB0Rm9yUHJvamVjdChwcm9qZWN0RGlyKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyBOb3RlOiBObyBwcm9ncmVzcyBpbmRpY2F0b3IgbmVlZGVkIGFzIHRoYXQgaXMgdGhlIHJlc3BvbnNpYmlsaXR5IG9mIHRoZSBjb21tYW5kLlxuICAgICAgLy8gVE9ETzogZGV0ZWN0IHlhcm4gYmVycnkgYW5kIGhhbmRsZSBmbGFnIGRpZmZlcmVuY2VzIHByb3Blcmx5LlxuICAgICAgYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKFxuICAgICAgICB5YXJuQ29tbWFuZC5iaW5hcnksXG4gICAgICAgIFtcbiAgICAgICAgICAuLi55YXJuQ29tbWFuZC5hcmdzLFxuICAgICAgICAgICduZy1kZXYnLFxuICAgICAgICAgICdyZWxlYXNlJyxcbiAgICAgICAgICAnc2V0LWRpc3QtdGFnJyxcbiAgICAgICAgICBucG1EaXN0VGFnLFxuICAgICAgICAgIHZlcnNpb24uZm9ybWF0KCksXG4gICAgICAgICAgYC0tc2tpcC1leHBlcmltZW50YWwtcGFja2FnZXM9JHtvcHRpb25zLnNraXBFeHBlcmltZW50YWxQYWNrYWdlc31gLFxuICAgICAgICBdLFxuICAgICAgICB7Y3dkOiBwcm9qZWN0RGlyfSxcbiAgICAgICk7XG4gICAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBTZXQgXCIke25wbURpc3RUYWd9XCIgTlBNIGRpc3QgdGFnIGZvciBhbGwgcGFja2FnZXMgdG8gdiR7dmVyc2lvbn0uYCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIExvZy5lcnJvcihlKTtcbiAgICAgIExvZy5lcnJvcihgICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBzZXR0aW5nIHRoZSBOUE0gZGlzdCB0YWcgZm9yIFwiJHtucG1EaXN0VGFnfVwiLmApO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEludm9rZXMgdGhlIGBuZy1kZXYgcmVsZWFzZSBucG0tZGlzdC10YWcgZGVsZXRlYCBjb21tYW5kIGluIG9yZGVyIHRvIGRlbGV0ZSB0aGVcbiAgICogTlBNIGRpc3QgdGFnIGZvciBhbGwgcGFja2FnZXMgaW4gdGhlIGNoZWNrZWQtb3V0IHZlcnNpb24gYnJhbmNoLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZURlbGV0ZU5wbURpc3RUYWcocHJvamVjdERpcjogc3RyaW5nLCBucG1EaXN0VGFnOiBOcG1EaXN0VGFnKSB7XG4gICAgLy8gTm90ZTogV2UgY2Fubm90IHVzZSBgeWFybmAgZGlyZWN0bHkgYXMgY29tbWFuZCBiZWNhdXNlIHdlIG1pZ2h0IG9wZXJhdGUgaW5cbiAgICAvLyBhIGRpZmZlcmVudCBwdWJsaXNoIGJyYW5jaCBhbmQgdGhlIGN1cnJlbnQgYFBBVEhgIHdpbGwgcG9pbnQgdG8gdGhlIFlhcm4gdmVyc2lvblxuICAgIC8vIHRoYXQgaW52b2tlZCB0aGUgcmVsZWFzZSB0b29sLiBNb3JlIGRldGFpbHMgaW4gdGhlIGZ1bmN0aW9uIGRlc2NyaXB0aW9uLlxuICAgIGNvbnN0IHlhcm5Db21tYW5kID0gYXdhaXQgcmVzb2x2ZVlhcm5TY3JpcHRGb3JQcm9qZWN0KHByb2plY3REaXIpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIE5vdGU6IE5vIHByb2dyZXNzIGluZGljYXRvciBuZWVkZWQgYXMgdGhhdCBpcyB0aGUgcmVzcG9uc2liaWxpdHkgb2YgdGhlIGNvbW1hbmQuXG4gICAgICAvLyBUT0RPOiBkZXRlY3QgeWFybiBiZXJyeSBhbmQgaGFuZGxlIGZsYWcgZGlmZmVyZW5jZXMgcHJvcGVybHkuXG4gICAgICBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oXG4gICAgICAgIHlhcm5Db21tYW5kLmJpbmFyeSxcbiAgICAgICAgWy4uLnlhcm5Db21tYW5kLmFyZ3MsICduZy1kZXYnLCAncmVsZWFzZScsICducG0tZGlzdC10YWcnLCAnZGVsZXRlJywgbnBtRGlzdFRhZ10sXG4gICAgICAgIHtjd2Q6IHByb2plY3REaXJ9LFxuICAgICAgKTtcbiAgICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIERlbGV0ZWQgXCIke25wbURpc3RUYWd9XCIgTlBNIGRpc3QgdGFnIGZvciBhbGwgcGFja2FnZXMuYCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIExvZy5lcnJvcihlKTtcbiAgICAgIExvZy5lcnJvcihgICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBkZWxldGluZyB0aGUgTlBNIGRpc3QgdGFnOiBcIiR7bnBtRGlzdFRhZ31cIi5gKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBgbmctZGV2IHJlbGVhc2UgYnVpbGRgIGNvbW1hbmQgaW4gb3JkZXIgdG8gYnVpbGQgdGhlIHJlbGVhc2VcbiAgICogcGFja2FnZXMgZm9yIHRoZSBjdXJyZW50bHkgY2hlY2tlZCBvdXQgYnJhbmNoLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZVJlbGVhc2VCdWlsZChwcm9qZWN0RGlyOiBzdHJpbmcpOiBQcm9taXNlPFJlbGVhc2VCdWlsZEpzb25TdGRvdXQ+IHtcbiAgICAvLyBOb3RlOiBXZSBjYW5ub3QgdXNlIGB5YXJuYCBkaXJlY3RseSBhcyBjb21tYW5kIGJlY2F1c2Ugd2UgbWlnaHQgb3BlcmF0ZSBpblxuICAgIC8vIGEgZGlmZmVyZW50IHB1Ymxpc2ggYnJhbmNoIGFuZCB0aGUgY3VycmVudCBgUEFUSGAgd2lsbCBwb2ludCB0byB0aGUgWWFybiB2ZXJzaW9uXG4gICAgLy8gdGhhdCBpbnZva2VkIHRoZSByZWxlYXNlIHRvb2wuIE1vcmUgZGV0YWlscyBpbiB0aGUgZnVuY3Rpb24gZGVzY3JpcHRpb24uXG4gICAgY29uc3QgeWFybkNvbW1hbmQgPSBhd2FpdCByZXNvbHZlWWFyblNjcmlwdEZvclByb2plY3QocHJvamVjdERpcik7XG4gICAgLy8gTm90ZTogV2UgZXhwbGljaXRseSBtZW50aW9uIHRoYXQgdGhpcyBjYW4gdGFrZSBhIGZldyBtaW51dGVzLCBzbyB0aGF0IGl0J3Mgb2J2aW91c1xuICAgIC8vIHRvIGNhcmV0YWtlcnMgdGhhdCBpdCBjYW4gdGFrZSBsb25nZXIgdGhhbiBqdXN0IGEgZmV3IHNlY29uZHMuXG4gICAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKCdCdWlsZGluZyByZWxlYXNlIG91dHB1dC4gVGhpcyBjYW4gdGFrZSBhIGZldyBtaW51dGVzLicpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFNpbmNlIHdlIGV4cGVjdCBKU09OIHRvIGJlIHByaW50ZWQgZnJvbSB0aGUgYG5nLWRldiByZWxlYXNlIGJ1aWxkYCBjb21tYW5kLFxuICAgICAgLy8gd2Ugc3Bhd24gdGhlIHByb2Nlc3MgaW4gc2lsZW50IG1vZGUuIFdlIGhhdmUgc2V0IHVwIGFuIE9yYSBwcm9ncmVzcyBzcGlubmVyLlxuICAgICAgLy8gVE9ETzogZGV0ZWN0IHlhcm4gYmVycnkgYW5kIGhhbmRsZSBmbGFnIGRpZmZlcmVuY2VzIHByb3Blcmx5LlxuICAgICAgY29uc3Qge3N0ZG91dH0gPSBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oXG4gICAgICAgIHlhcm5Db21tYW5kLmJpbmFyeSxcbiAgICAgICAgWy4uLnlhcm5Db21tYW5kLmFyZ3MsICduZy1kZXYnLCAncmVsZWFzZScsICdidWlsZCcsICctLWpzb24nXSxcbiAgICAgICAge1xuICAgICAgICAgIGN3ZDogcHJvamVjdERpcixcbiAgICAgICAgICBtb2RlOiAnc2lsZW50JyxcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgICBzcGlubmVyLmNvbXBsZXRlKCk7XG4gICAgICBMb2cuaW5mbyhncmVlbignICDinJMgICBCdWlsdCByZWxlYXNlIG91dHB1dCBmb3IgYWxsIHBhY2thZ2VzLicpKTtcbiAgICAgIC8vIFRoZSBgbmctZGV2IHJlbGVhc2UgYnVpbGRgIGNvbW1hbmQgcHJpbnRzIGEgSlNPTiBhcnJheSB0byBzdGRvdXRcbiAgICAgIC8vIHRoYXQgcmVwcmVzZW50cyB0aGUgYnVpbHQgcmVsZWFzZSBwYWNrYWdlcyBhbmQgdGhlaXIgb3V0cHV0IHBhdGhzLlxuICAgICAgcmV0dXJuIEpTT04ucGFyc2Uoc3Rkb3V0LnRyaW0oKSkgYXMgUmVsZWFzZUJ1aWxkSnNvblN0ZG91dDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBzcGlubmVyLmNvbXBsZXRlKCk7XG4gICAgICBMb2cuZXJyb3IoZSk7XG4gICAgICBMb2cuZXJyb3IoJyAg4pyYICAgQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgYnVpbGRpbmcgdGhlIHJlbGVhc2UgcGFja2FnZXMuJyk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlcyB0aGUgYG5nLWRldiByZWxlYXNlIGluZm9gIGNvbW1hbmQgaW4gb3JkZXIgdG8gcmV0cmlldmUgaW5mb3JtYXRpb25cbiAgICogYWJvdXQgdGhlIHJlbGVhc2UgZm9yIHRoZSBjdXJyZW50bHkgY2hlY2tlZC1vdXQgYnJhbmNoLlxuICAgKlxuICAgKiBUaGlzIGlzIHVzZWZ1bCB0byBlLmcuIGRldGVybWluZSB3aGV0aGVyIGEgYnVpbHQgcGFja2FnZSBpcyBjdXJyZW50bHlcbiAgICogZGVub3RlZCBhcyBleHBlcmltZW50YWwgb3Igbm90LlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZVJlbGVhc2VJbmZvKHByb2plY3REaXI6IHN0cmluZyk6IFByb21pc2U8UmVsZWFzZUluZm9Kc29uU3Rkb3V0PiB7XG4gICAgLy8gTm90ZTogV2UgY2Fubm90IHVzZSBgeWFybmAgZGlyZWN0bHkgYXMgY29tbWFuZCBiZWNhdXNlIHdlIG1pZ2h0IG9wZXJhdGUgaW5cbiAgICAvLyBhIGRpZmZlcmVudCBwdWJsaXNoIGJyYW5jaCBhbmQgdGhlIGN1cnJlbnQgYFBBVEhgIHdpbGwgcG9pbnQgdG8gdGhlIFlhcm4gdmVyc2lvblxuICAgIC8vIHRoYXQgaW52b2tlZCB0aGUgcmVsZWFzZSB0b29sLiBNb3JlIGRldGFpbHMgaW4gdGhlIGZ1bmN0aW9uIGRlc2NyaXB0aW9uLlxuICAgIGNvbnN0IHlhcm5Db21tYW5kID0gYXdhaXQgcmVzb2x2ZVlhcm5TY3JpcHRGb3JQcm9qZWN0KHByb2plY3REaXIpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIE5vdGU6IE5vIHByb2dyZXNzIGluZGljYXRvciBuZWVkZWQgYXMgdGhhdCBpcyBleHBlY3RlZCB0byBiZSBhIGZhc3Qgb3BlcmF0aW9uLlxuICAgICAgLy8gVE9ETzogZGV0ZWN0IHlhcm4gYmVycnkgYW5kIGhhbmRsZSBmbGFnIGRpZmZlcmVuY2VzIHByb3Blcmx5LlxuICAgICAgY29uc3Qge3N0ZG91dH0gPSBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oXG4gICAgICAgIHlhcm5Db21tYW5kLmJpbmFyeSxcbiAgICAgICAgWy4uLnlhcm5Db21tYW5kLmFyZ3MsICduZy1kZXYnLCAncmVsZWFzZScsICdpbmZvJywgJy0tanNvbiddLFxuICAgICAgICB7XG4gICAgICAgICAgY3dkOiBwcm9qZWN0RGlyLFxuICAgICAgICAgIG1vZGU6ICdzaWxlbnQnLFxuICAgICAgICB9LFxuICAgICAgKTtcbiAgICAgIC8vIFRoZSBgbmctZGV2IHJlbGVhc2UgaW5mb2AgY29tbWFuZCBwcmludHMgYSBKU09OIG9iamVjdCB0byBzdGRvdXQuXG4gICAgICByZXR1cm4gSlNPTi5wYXJzZShzdGRvdXQudHJpbSgpKSBhcyBSZWxlYXNlSW5mb0pzb25TdGRvdXQ7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgTG9nLmVycm9yKGUpO1xuICAgICAgTG9nLmVycm9yKFxuICAgICAgICBgICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSByZXRyaWV2aW5nIHRoZSByZWxlYXNlIGluZm9ybWF0aW9uIGZvciBgICtcbiAgICAgICAgICBgdGhlIGN1cnJlbnRseSBjaGVja2VkLW91dCBicmFuY2guYCxcbiAgICAgICk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlcyB0aGUgYG5nLWRldiByZWxlYXNlIHByZWNoZWNrYCBjb21tYW5kIGluIG9yZGVyIHRvIHZhbGlkYXRlIHRoZVxuICAgKiBidWlsdCBwYWNrYWdlcyBvciBydW4gb3RoZXIgdmFsaWRhdGlvbnMgYmVmb3JlIGFjdHVhbGx5IHJlbGVhc2luZy5cbiAgICpcbiAgICogVGhpcyBpcyBydW4gYXMgYW4gZXh0ZXJuYWwgY29tbWFuZCBiZWNhdXNlIHByZWNoZWNrcyBjYW4gYmUgY3VzdG9taXplZFxuICAgKiB0aHJvdWdoIHRoZSBgbmctZGV2YCBjb25maWd1cmF0aW9uLCBhbmQgd2Ugd291bGRuJ3Qgd2FudCB0byBydW4gcHJlY2hlY2tzXG4gICAqIGZyb20gdGhlIGBuZXh0YCBicmFuY2ggZm9yIG9sZGVyIGJyYW5jaGVzLCBsaWtlIHBhdGNoIG9yIGFuIExUUyBicmFuY2guXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW52b2tlUmVsZWFzZVByZWNoZWNrKFxuICAgIHByb2plY3REaXI6IHN0cmluZyxcbiAgICBuZXdWZXJzaW9uOiBzZW12ZXIuU2VtVmVyLFxuICAgIGJ1aWx0UGFja2FnZXNXaXRoSW5mbzogQnVpbHRQYWNrYWdlV2l0aEluZm9bXSxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gTm90ZTogV2UgY2Fubm90IHVzZSBgeWFybmAgZGlyZWN0bHkgYXMgY29tbWFuZCBiZWNhdXNlIHdlIG1pZ2h0IG9wZXJhdGUgaW5cbiAgICAvLyBhIGRpZmZlcmVudCBwdWJsaXNoIGJyYW5jaCBhbmQgdGhlIGN1cnJlbnQgYFBBVEhgIHdpbGwgcG9pbnQgdG8gdGhlIFlhcm4gdmVyc2lvblxuICAgIC8vIHRoYXQgaW52b2tlZCB0aGUgcmVsZWFzZSB0b29sLiBNb3JlIGRldGFpbHMgaW4gdGhlIGZ1bmN0aW9uIGRlc2NyaXB0aW9uLlxuICAgIGNvbnN0IHlhcm5Db21tYW5kID0gYXdhaXQgcmVzb2x2ZVlhcm5TY3JpcHRGb3JQcm9qZWN0KHByb2plY3REaXIpO1xuICAgIGNvbnN0IHByZWNoZWNrU3RkaW46IFJlbGVhc2VQcmVjaGVja0pzb25TdGRpbiA9IHtcbiAgICAgIGJ1aWx0UGFja2FnZXNXaXRoSW5mbyxcbiAgICAgIG5ld1ZlcnNpb246IG5ld1ZlcnNpb24uZm9ybWF0KCksXG4gICAgfTtcblxuICAgIHRyeSB7XG4gICAgICAvLyBOb3RlOiBObyBwcm9ncmVzcyBpbmRpY2F0b3IgbmVlZGVkIGFzIHRoYXQgaXMgZXhwZWN0ZWQgdG8gYmUgYSBmYXN0IG9wZXJhdGlvbi4gQWxzb1xuICAgICAgLy8gd2UgZXhwZWN0IHRoZSBjb21tYW5kIHRvIGhhbmRsZSBjb25zb2xlIG1lc3NhZ2luZyBhbmQgd291bGRuJ3Qgd2FudCB0byBjbG9iYmVyIGl0LlxuICAgICAgLy8gVE9ETzogZGV0ZWN0IHlhcm4gYmVycnkgYW5kIGhhbmRsZSBmbGFnIGRpZmZlcmVuY2VzIHByb3Blcmx5LlxuICAgICAgYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKFxuICAgICAgICB5YXJuQ29tbWFuZC5iaW5hcnksXG4gICAgICAgIFsuLi55YXJuQ29tbWFuZC5hcmdzLCAnbmctZGV2JywgJ3JlbGVhc2UnLCAncHJlY2hlY2snXSxcbiAgICAgICAge1xuICAgICAgICAgIGN3ZDogcHJvamVjdERpcixcbiAgICAgICAgICAvLyBOb3RlOiBXZSBwYXNzIHRoZSBwcmVjaGVjayBpbmZvcm1hdGlvbiB0byB0aGUgY29tbWFuZCB0aHJvdWdoIGBzdGRpbmBcbiAgICAgICAgICAvLyBiZWNhdXNlIGNvbW1hbmQgbGluZSBhcmd1bWVudHMgYXJlIGxlc3MgcmVsaWFibGUgYW5kIGhhdmUgbGVuZ3RoIGxpbWl0cy5cbiAgICAgICAgICBpbnB1dDogSlNPTi5zdHJpbmdpZnkocHJlY2hlY2tTdGRpbiksXG4gICAgICAgIH0sXG4gICAgICApO1xuICAgICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgRXhlY3V0ZWQgcmVsZWFzZSBwcmUtY2hlY2tzIGZvciAke25ld1ZlcnNpb259YCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIFRoZSBgc3Bhd25gIGludm9jYXRpb24gYWxyZWFkeSBwcmludHMgYWxsIHN0ZG91dC9zdGRlcnIsIHNvIHdlIGRvbid0IG5lZWQgcmUtcHJpbnQuXG4gICAgICAvLyBUbyBlYXNlIGRlYnVnZ2luZyBpbiBjYXNlIG9mIHJ1bnRpbWUgZXhjZXB0aW9ucywgd2Ugc3RpbGwgcHJpbnQgdGhlIGVycm9yIHRvIGBkZWJ1Z2AuXG4gICAgICBMb2cuZGVidWcoZSk7XG4gICAgICBMb2cuZXJyb3IoYCAg4pyYICAgQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgcnVubmluZyByZWxlYXNlIHByZS1jaGVja3MuYCk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlcyB0aGUgYHlhcm4gaW5zdGFsbGAgY29tbWFuZCBpbiBvcmRlciB0byBpbnN0YWxsIGRlcGVuZGVuY2llcyBmb3JcbiAgICogdGhlIGNvbmZpZ3VyZWQgcHJvamVjdCB3aXRoIHRoZSBjdXJyZW50bHkgY2hlY2tlZCBvdXQgcmV2aXNpb24uXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW52b2tlWWFybkluc3RhbGwocHJvamVjdERpcjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gTm90ZTogV2UgY2Fubm90IHVzZSBgeWFybmAgZGlyZWN0bHkgYXMgY29tbWFuZCBiZWNhdXNlIHdlIG1pZ2h0IG9wZXJhdGUgaW5cbiAgICAvLyBhIGRpZmZlcmVudCBwdWJsaXNoIGJyYW5jaCBhbmQgdGhlIGN1cnJlbnQgYFBBVEhgIHdpbGwgcG9pbnQgdG8gdGhlIFlhcm4gdmVyc2lvblxuICAgIC8vIHRoYXQgaW52b2tlZCB0aGUgcmVsZWFzZSB0b29sLiBNb3JlIGRldGFpbHMgaW4gdGhlIGZ1bmN0aW9uIGRlc2NyaXB0aW9uLlxuICAgIGNvbnN0IHlhcm5Db21tYW5kID0gYXdhaXQgcmVzb2x2ZVlhcm5TY3JpcHRGb3JQcm9qZWN0KHByb2plY3REaXIpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIE5vdGU6IE5vIHByb2dyZXNzIGluZGljYXRvciBuZWVkZWQgYXMgdGhhdCBpcyB0aGUgcmVzcG9uc2liaWxpdHkgb2YgdGhlIGNvbW1hbmQuXG4gICAgICAvLyBUT0RPOiBDb25zaWRlciB1c2luZyBhbiBPcmEgc3Bpbm5lciBpbnN0ZWFkIHRvIGVuc3VyZSBtaW5pbWFsIGNvbnNvbGUgb3V0cHV0LlxuICAgICAgYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKFxuICAgICAgICB5YXJuQ29tbWFuZC5iaW5hcnksXG4gICAgICAgIFtcbiAgICAgICAgICAuLi55YXJuQ29tbWFuZC5hcmdzLFxuICAgICAgICAgICdpbnN0YWxsJyxcbiAgICAgICAgICAuLi4oeWFybkNvbW1hbmQubGVnYWN5ID8gWyctLWZyb3plbi1sb2NrZmlsZScsICctLW5vbi1pbnRlcmFjdGl2ZSddIDogWyctLWltbXV0YWJsZSddKSxcbiAgICAgICAgXSxcbiAgICAgICAge2N3ZDogcHJvamVjdERpcn0sXG4gICAgICApO1xuICAgICAgTG9nLmluZm8oZ3JlZW4oJyAg4pyTICAgSW5zdGFsbGVkIHByb2plY3QgZGVwZW5kZW5jaWVzLicpKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBMb2cuZXJyb3IoZSk7XG4gICAgICBMb2cuZXJyb3IoJyAg4pyYICAgQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgaW5zdGFsbGluZyBkZXBlbmRlbmNpZXMuJyk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==