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
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZXJuYWwtY29tbWFuZHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9wdWJsaXNoL2V4dGVybmFsLWNvbW1hbmRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUMxRCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFHL0MsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDM0QsT0FBTyxFQUFDLDJCQUEyQixFQUFDLE1BQU0saUNBQWlDLENBQUM7QUFLNUUsT0FBTyxFQUFDLEtBQUssRUFBRSxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNsRCxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFFckQ7Ozs7Ozs7Ozs7Ozs7OztHQWVHO0FBRUgsMEVBQTBFO0FBQzFFLE1BQU0sT0FBZ0IsZ0JBQWdCO0lBQ3BDOzs7Ozs7T0FNRztJQUNILE1BQU0sQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQzNCLFVBQWtCLEVBQ2xCLFVBQXNCLEVBQ3RCLE9BQXNCLEVBQ3RCLFVBQStDLEVBQUMsd0JBQXdCLEVBQUUsS0FBSyxFQUFDO1FBRWhGLDZFQUE2RTtRQUM3RSxtRkFBbUY7UUFDbkYsMkVBQTJFO1FBQzNFLE1BQU0sV0FBVyxHQUFHLE1BQU0sMkJBQTJCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFbEUsSUFBSSxDQUFDO1lBQ0gsbUZBQW1GO1lBQ25GLGdFQUFnRTtZQUNoRSxNQUFNLFlBQVksQ0FBQyxLQUFLLENBQ3RCLFdBQVcsQ0FBQyxNQUFNLEVBQ2xCO2dCQUNFLEdBQUcsV0FBVyxDQUFDLElBQUk7Z0JBQ25CLFFBQVE7Z0JBQ1IsU0FBUztnQkFDVCxjQUFjO2dCQUNkLFVBQVU7Z0JBQ1YsT0FBTyxDQUFD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VCxHQUFHLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2FBQ3ZGLEVBQ0QsRUFBQyxHQUFHLEVBQUUsVUFBVSxFQUFDLENBQ2xCLENBQUM7WUFDRixHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDLENBQUM7UUFDM0QsQ0FBQztRQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDWCxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2IsR0FBRyxDQUFDLEtBQUssQ0FBQyx3REFBd0QsQ0FBQyxDQUFDO1lBQ3BFLE1BQU0sSUFBSSx1QkFBdUIsRUFBRSxDQUFDO1FBQ3RDLENBQUM7SUFDSCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQyxVQUFrQjtRQUM5RCxNQUFNLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO1FBQzFELElBQUksQ0FBQztZQUNILE1BQU0sWUFBWSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLE1BQU0sRUFBRSxhQUFhLENBQUMsRUFBRTtnQkFDL0QsR0FBRyxFQUFFLFVBQVU7Z0JBQ2YsSUFBSSxFQUFFLFFBQVE7YUFDZixDQUFDLENBQUM7UUFDTCxDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNYLGdFQUFnRTtZQUNoRSx1RUFBdUU7WUFDdkUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNmLENBQUM7UUFDRCxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDLENBQUM7SUFDbkUsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBzZW12ZXIgZnJvbSAnc2VtdmVyJztcblxuaW1wb3J0IHtDaGlsZFByb2Nlc3N9IGZyb20gJy4uLy4uL3V0aWxzL2NoaWxkLXByb2Nlc3MuanMnO1xuaW1wb3J0IHtTcGlubmVyfSBmcm9tICcuLi8uLi91dGlscy9zcGlubmVyLmpzJztcbmltcG9ydCB7TnBtRGlzdFRhZ30gZnJvbSAnLi4vdmVyc2lvbmluZy9pbmRleC5qcyc7XG5cbmltcG9ydCB7RmF0YWxSZWxlYXNlQWN0aW9uRXJyb3J9IGZyb20gJy4vYWN0aW9ucy1lcnJvci5qcyc7XG5pbXBvcnQge3Jlc29sdmVZYXJuU2NyaXB0Rm9yUHJvamVjdH0gZnJvbSAnLi4vLi4vdXRpbHMvcmVzb2x2ZS15YXJuLWJpbi5qcyc7XG5pbXBvcnQge1JlbGVhc2VCdWlsZEpzb25TdGRvdXR9IGZyb20gJy4uL2J1aWxkL2NsaS5qcyc7XG5pbXBvcnQge1JlbGVhc2VJbmZvSnNvblN0ZG91dH0gZnJvbSAnLi4vaW5mby9jbGkuanMnO1xuaW1wb3J0IHtSZWxlYXNlUHJlY2hlY2tKc29uU3RkaW59IGZyb20gJy4uL3ByZWNoZWNrL2NsaS5qcyc7XG5pbXBvcnQge0J1aWx0UGFja2FnZVdpdGhJbmZvfSBmcm9tICcuLi9jb25maWcvaW5kZXguanMnO1xuaW1wb3J0IHtncmVlbiwgTG9nfSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7Z2V0QmF6ZWxCaW59IGZyb20gJy4uLy4uL3V0aWxzL2JhemVsLWJpbi5qcyc7XG5cbi8qXG4gKiAjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyNcbiAqXG4gKiBUaGlzIGZpbGUgY29udGFpbnMgaGVscGVycyBmb3IgaW52b2tpbmcgZXh0ZXJuYWwgYG5nLWRldmAgY29tbWFuZHMuIEEgc3Vic2V0IG9mIGFjdGlvbnMsXG4gKiBsaWtlIGJ1aWxkaW5nIHJlbGVhc2Ugb3V0cHV0IG9yIHNldHRpbmcgYc69IE5QTSBkaXN0IHRhZyBmb3IgcmVsZWFzZSBwYWNrYWdlcywgY2Fubm90IGJlXG4gKiBwZXJmb3JtZWQgZGlyZWN0bHkgYXMgcGFydCBvZiB0aGUgcmVsZWFzZSB0b29sIGFuZCBuZWVkIHRvIGJlIGRlbGVnYXRlZCB0byBleHRlcm5hbCBgbmctZGV2YFxuICogY29tbWFuZHMgdGhhdCBleGlzdCBhY3Jvc3MgYXJiaXRyYXJ5IHZlcnNpb24gYnJhbmNoZXMuXG4gKlxuICogSW4gYSBjb25jcmV0ZSBleGFtcGxlOiBDb25zaWRlciBhIG5ldyBwYXRjaCB2ZXJzaW9uIGlzIHJlbGVhc2VkIGFuZCB0aGF0IGEgbmV3IHJlbGVhc2VcbiAqIHBhY2thZ2UgaGFzIGJlZW4gYWRkZWQgdG8gdGhlIGBuZXh0YCBicmFuY2guIFRoZSBwYXRjaCBicmFuY2ggd2lsbCBub3QgY29udGFpbiB0aGUgbmV3XG4gKiByZWxlYXNlIHBhY2thZ2UsIHNvIHdlIGNvdWxkIG5vdCBidWlsZCB0aGUgcmVsZWFzZSBvdXRwdXQgZm9yIGl0LiBUbyB3b3JrIGFyb3VuZCB0aGlzLCB3ZVxuICogY2FsbCB0aGUgbmctZGV2IGJ1aWxkIGNvbW1hbmQgZm9yIHRoZSBwYXRjaCB2ZXJzaW9uIGJyYW5jaCBhbmQgZXhwZWN0IGl0IHRvIHJldHVybiBhIGxpc3RcbiAqIG9mIGJ1aWx0IHBhY2thZ2VzIHRoYXQgbmVlZCB0byBiZSByZWxlYXNlZCBhcyBwYXJ0IG9mIHRoaXMgcmVsZWFzZSB0cmFpbi5cbiAqXG4gKiAjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyNcbiAqL1xuXG4vKiogQ2xhc3MgaG9sZGluZyBtZXRob2QgZm9yIGludm9raW5nIHJlbGVhc2UgYWN0aW9uIGV4dGVybmFsIGNvbW1hbmRzLiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEV4dGVybmFsQ29tbWFuZHMge1xuICAvKipcbiAgICogSW52b2tlcyB0aGUgYG5nLWRldiByZWxlYXNlIHNldC1kaXN0LXRhZ2AgY29tbWFuZCBpbiBvcmRlciB0byBzZXQgdGhlIHNwZWNpZmllZFxuICAgKiBOUE0gZGlzdCB0YWcgZm9yIGFsbCBwYWNrYWdlcyBpbiB0aGUgY2hlY2tlZCBvdXQgYnJhbmNoIHRvIHRoZSBnaXZlbiB2ZXJzaW9uLlxuICAgKlxuICAgKiBPcHRpb25hbGx5LCB0aGUgTlBNIGRpc3QgdGFnIHVwZGF0ZSBjYW4gYmUgc2tpcHBlZCBmb3IgZXhwZXJpbWVudGFsIHBhY2thZ2VzLiBUaGlzXG4gICAqIGlzIHVzZWZ1bCB3aGVuIHRhZ2dpbmcgbG9uZy10ZXJtLXN1cHBvcnQgcGFja2FnZXMgd2l0aGluIE5QTS5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBpbnZva2VTZXROcG1EaXN0KFxuICAgIHByb2plY3REaXI6IHN0cmluZyxcbiAgICBucG1EaXN0VGFnOiBOcG1EaXN0VGFnLFxuICAgIHZlcnNpb246IHNlbXZlci5TZW1WZXIsXG4gICAgb3B0aW9uczoge3NraXBFeHBlcmltZW50YWxQYWNrYWdlczogYm9vbGVhbn0gPSB7c2tpcEV4cGVyaW1lbnRhbFBhY2thZ2VzOiBmYWxzZX0sXG4gICkge1xuICAgIC8vIE5vdGU6IFdlIGNhbm5vdCB1c2UgYHlhcm5gIGRpcmVjdGx5IGFzIGNvbW1hbmQgYmVjYXVzZSB3ZSBtaWdodCBvcGVyYXRlIGluXG4gICAgLy8gYSBkaWZmZXJlbnQgcHVibGlzaCBicmFuY2ggYW5kIHRoZSBjdXJyZW50IGBQQVRIYCB3aWxsIHBvaW50IHRvIHRoZSBZYXJuIHZlcnNpb25cbiAgICAvLyB0aGF0IGludm9rZWQgdGhlIHJlbGVhc2UgdG9vbC4gTW9yZSBkZXRhaWxzIGluIHRoZSBmdW5jdGlvbiBkZXNjcmlwdGlvbi5cbiAgICBjb25zdCB5YXJuQ29tbWFuZCA9IGF3YWl0IHJlc29sdmVZYXJuU2NyaXB0Rm9yUHJvamVjdChwcm9qZWN0RGlyKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyBOb3RlOiBObyBwcm9ncmVzcyBpbmRpY2F0b3IgbmVlZGVkIGFzIHRoYXQgaXMgdGhlIHJlc3BvbnNpYmlsaXR5IG9mIHRoZSBjb21tYW5kLlxuICAgICAgLy8gVE9ETzogZGV0ZWN0IHlhcm4gYmVycnkgYW5kIGhhbmRsZSBmbGFnIGRpZmZlcmVuY2VzIHByb3Blcmx5LlxuICAgICAgYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKFxuICAgICAgICB5YXJuQ29tbWFuZC5iaW5hcnksXG4gICAgICAgIFtcbiAgICAgICAgICAuLi55YXJuQ29tbWFuZC5hcmdzLFxuICAgICAgICAgICduZy1kZXYnLFxuICAgICAgICAgICdyZWxlYXNlJyxcbiAgICAgICAgICAnc2V0LWRpc3QtdGFnJyxcbiAgICAgICAgICBucG1EaXN0VGFnLFxuICAgICAgICAgIHZlcnNpb24uZm9ybWF0KCksXG4gICAgICAgICAgYC0tc2tpcC1leHBlcmltZW50YWwtcGFja2FnZXM9JHtvcHRpb25zLnNraXBFeHBlcmltZW50YWxQYWNrYWdlc31gLFxuICAgICAgICBdLFxuICAgICAgICB7Y3dkOiBwcm9qZWN0RGlyfSxcbiAgICAgICk7XG4gICAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBTZXQgXCIke25wbURpc3RUYWd9XCIgTlBNIGRpc3QgdGFnIGZvciBhbGwgcGFja2FnZXMgdG8gdiR7dmVyc2lvbn0uYCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIExvZy5lcnJvcihlKTtcbiAgICAgIExvZy5lcnJvcihgICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBzZXR0aW5nIHRoZSBOUE0gZGlzdCB0YWcgZm9yIFwiJHtucG1EaXN0VGFnfVwiLmApO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEludm9rZXMgdGhlIGBuZy1kZXYgcmVsZWFzZSBucG0tZGlzdC10YWcgZGVsZXRlYCBjb21tYW5kIGluIG9yZGVyIHRvIGRlbGV0ZSB0aGVcbiAgICogTlBNIGRpc3QgdGFnIGZvciBhbGwgcGFja2FnZXMgaW4gdGhlIGNoZWNrZWQtb3V0IHZlcnNpb24gYnJhbmNoLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZURlbGV0ZU5wbURpc3RUYWcocHJvamVjdERpcjogc3RyaW5nLCBucG1EaXN0VGFnOiBOcG1EaXN0VGFnKSB7XG4gICAgLy8gTm90ZTogV2UgY2Fubm90IHVzZSBgeWFybmAgZGlyZWN0bHkgYXMgY29tbWFuZCBiZWNhdXNlIHdlIG1pZ2h0IG9wZXJhdGUgaW5cbiAgICAvLyBhIGRpZmZlcmVudCBwdWJsaXNoIGJyYW5jaCBhbmQgdGhlIGN1cnJlbnQgYFBBVEhgIHdpbGwgcG9pbnQgdG8gdGhlIFlhcm4gdmVyc2lvblxuICAgIC8vIHRoYXQgaW52b2tlZCB0aGUgcmVsZWFzZSB0b29sLiBNb3JlIGRldGFpbHMgaW4gdGhlIGZ1bmN0aW9uIGRlc2NyaXB0aW9uLlxuICAgIGNvbnN0IHlhcm5Db21tYW5kID0gYXdhaXQgcmVzb2x2ZVlhcm5TY3JpcHRGb3JQcm9qZWN0KHByb2plY3REaXIpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIE5vdGU6IE5vIHByb2dyZXNzIGluZGljYXRvciBuZWVkZWQgYXMgdGhhdCBpcyB0aGUgcmVzcG9uc2liaWxpdHkgb2YgdGhlIGNvbW1hbmQuXG4gICAgICAvLyBUT0RPOiBkZXRlY3QgeWFybiBiZXJyeSBhbmQgaGFuZGxlIGZsYWcgZGlmZmVyZW5jZXMgcHJvcGVybHkuXG4gICAgICBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oXG4gICAgICAgIHlhcm5Db21tYW5kLmJpbmFyeSxcbiAgICAgICAgWy4uLnlhcm5Db21tYW5kLmFyZ3MsICduZy1kZXYnLCAncmVsZWFzZScsICducG0tZGlzdC10YWcnLCAnZGVsZXRlJywgbnBtRGlzdFRhZ10sXG4gICAgICAgIHtjd2Q6IHByb2plY3REaXJ9LFxuICAgICAgKTtcbiAgICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIERlbGV0ZWQgXCIke25wbURpc3RUYWd9XCIgTlBNIGRpc3QgdGFnIGZvciBhbGwgcGFja2FnZXMuYCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIExvZy5lcnJvcihlKTtcbiAgICAgIExvZy5lcnJvcihgICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBkZWxldGluZyB0aGUgTlBNIGRpc3QgdGFnOiBcIiR7bnBtRGlzdFRhZ31cIi5gKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBgbmctZGV2IHJlbGVhc2UgYnVpbGRgIGNvbW1hbmQgaW4gb3JkZXIgdG8gYnVpbGQgdGhlIHJlbGVhc2VcbiAgICogcGFja2FnZXMgZm9yIHRoZSBjdXJyZW50bHkgY2hlY2tlZCBvdXQgYnJhbmNoLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZVJlbGVhc2VCdWlsZChwcm9qZWN0RGlyOiBzdHJpbmcpOiBQcm9taXNlPFJlbGVhc2VCdWlsZEpzb25TdGRvdXQ+IHtcbiAgICAvLyBOb3RlOiBXZSBjYW5ub3QgdXNlIGB5YXJuYCBkaXJlY3RseSBhcyBjb21tYW5kIGJlY2F1c2Ugd2UgbWlnaHQgb3BlcmF0ZSBpblxuICAgIC8vIGEgZGlmZmVyZW50IHB1Ymxpc2ggYnJhbmNoIGFuZCB0aGUgY3VycmVudCBgUEFUSGAgd2lsbCBwb2ludCB0byB0aGUgWWFybiB2ZXJzaW9uXG4gICAgLy8gdGhhdCBpbnZva2VkIHRoZSByZWxlYXNlIHRvb2wuIE1vcmUgZGV0YWlscyBpbiB0aGUgZnVuY3Rpb24gZGVzY3JpcHRpb24uXG4gICAgY29uc3QgeWFybkNvbW1hbmQgPSBhd2FpdCByZXNvbHZlWWFyblNjcmlwdEZvclByb2plY3QocHJvamVjdERpcik7XG4gICAgLy8gTm90ZTogV2UgZXhwbGljaXRseSBtZW50aW9uIHRoYXQgdGhpcyBjYW4gdGFrZSBhIGZldyBtaW51dGVzLCBzbyB0aGF0IGl0J3Mgb2J2aW91c1xuICAgIC8vIHRvIGNhcmV0YWtlcnMgdGhhdCBpdCBjYW4gdGFrZSBsb25nZXIgdGhhbiBqdXN0IGEgZmV3IHNlY29uZHMuXG4gICAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKCdCdWlsZGluZyByZWxlYXNlIG91dHB1dC4gVGhpcyBjYW4gdGFrZSBhIGZldyBtaW51dGVzLicpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFNpbmNlIHdlIGV4cGVjdCBKU09OIHRvIGJlIHByaW50ZWQgZnJvbSB0aGUgYG5nLWRldiByZWxlYXNlIGJ1aWxkYCBjb21tYW5kLFxuICAgICAgLy8gd2Ugc3Bhd24gdGhlIHByb2Nlc3MgaW4gc2lsZW50IG1vZGUuIFdlIGhhdmUgc2V0IHVwIGFuIE9yYSBwcm9ncmVzcyBzcGlubmVyLlxuICAgICAgLy8gVE9ETzogZGV0ZWN0IHlhcm4gYmVycnkgYW5kIGhhbmRsZSBmbGFnIGRpZmZlcmVuY2VzIHByb3Blcmx5LlxuICAgICAgY29uc3Qge3N0ZG91dH0gPSBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oXG4gICAgICAgIHlhcm5Db21tYW5kLmJpbmFyeSxcbiAgICAgICAgWy4uLnlhcm5Db21tYW5kLmFyZ3MsICduZy1kZXYnLCAncmVsZWFzZScsICdidWlsZCcsICctLWpzb24nXSxcbiAgICAgICAge1xuICAgICAgICAgIGN3ZDogcHJvamVjdERpcixcbiAgICAgICAgICBtb2RlOiAnc2lsZW50JyxcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgICBzcGlubmVyLmNvbXBsZXRlKCk7XG4gICAgICBMb2cuaW5mbyhncmVlbignICDinJMgICBCdWlsdCByZWxlYXNlIG91dHB1dCBmb3IgYWxsIHBhY2thZ2VzLicpKTtcbiAgICAgIC8vIFRoZSBgbmctZGV2IHJlbGVhc2UgYnVpbGRgIGNvbW1hbmQgcHJpbnRzIGEgSlNPTiBhcnJheSB0byBzdGRvdXRcbiAgICAgIC8vIHRoYXQgcmVwcmVzZW50cyB0aGUgYnVpbHQgcmVsZWFzZSBwYWNrYWdlcyBhbmQgdGhlaXIgb3V0cHV0IHBhdGhzLlxuICAgICAgcmV0dXJuIEpTT04ucGFyc2Uoc3Rkb3V0LnRyaW0oKSkgYXMgUmVsZWFzZUJ1aWxkSnNvblN0ZG91dDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBzcGlubmVyLmNvbXBsZXRlKCk7XG4gICAgICBMb2cuZXJyb3IoZSk7XG4gICAgICBMb2cuZXJyb3IoJyAg4pyYICAgQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgYnVpbGRpbmcgdGhlIHJlbGVhc2UgcGFja2FnZXMuJyk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlcyB0aGUgYG5nLWRldiByZWxlYXNlIGluZm9gIGNvbW1hbmQgaW4gb3JkZXIgdG8gcmV0cmlldmUgaW5mb3JtYXRpb25cbiAgICogYWJvdXQgdGhlIHJlbGVhc2UgZm9yIHRoZSBjdXJyZW50bHkgY2hlY2tlZC1vdXQgYnJhbmNoLlxuICAgKlxuICAgKiBUaGlzIGlzIHVzZWZ1bCB0byBlLmcuIGRldGVybWluZSB3aGV0aGVyIGEgYnVpbHQgcGFja2FnZSBpcyBjdXJyZW50bHlcbiAgICogZGVub3RlZCBhcyBleHBlcmltZW50YWwgb3Igbm90LlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZVJlbGVhc2VJbmZvKHByb2plY3REaXI6IHN0cmluZyk6IFByb21pc2U8UmVsZWFzZUluZm9Kc29uU3Rkb3V0PiB7XG4gICAgLy8gTm90ZTogV2UgY2Fubm90IHVzZSBgeWFybmAgZGlyZWN0bHkgYXMgY29tbWFuZCBiZWNhdXNlIHdlIG1pZ2h0IG9wZXJhdGUgaW5cbiAgICAvLyBhIGRpZmZlcmVudCBwdWJsaXNoIGJyYW5jaCBhbmQgdGhlIGN1cnJlbnQgYFBBVEhgIHdpbGwgcG9pbnQgdG8gdGhlIFlhcm4gdmVyc2lvblxuICAgIC8vIHRoYXQgaW52b2tlZCB0aGUgcmVsZWFzZSB0b29sLiBNb3JlIGRldGFpbHMgaW4gdGhlIGZ1bmN0aW9uIGRlc2NyaXB0aW9uLlxuICAgIGNvbnN0IHlhcm5Db21tYW5kID0gYXdhaXQgcmVzb2x2ZVlhcm5TY3JpcHRGb3JQcm9qZWN0KHByb2plY3REaXIpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIE5vdGU6IE5vIHByb2dyZXNzIGluZGljYXRvciBuZWVkZWQgYXMgdGhhdCBpcyBleHBlY3RlZCB0byBiZSBhIGZhc3Qgb3BlcmF0aW9uLlxuICAgICAgLy8gVE9ETzogZGV0ZWN0IHlhcm4gYmVycnkgYW5kIGhhbmRsZSBmbGFnIGRpZmZlcmVuY2VzIHByb3Blcmx5LlxuICAgICAgY29uc3Qge3N0ZG91dH0gPSBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oXG4gICAgICAgIHlhcm5Db21tYW5kLmJpbmFyeSxcbiAgICAgICAgWy4uLnlhcm5Db21tYW5kLmFyZ3MsICduZy1kZXYnLCAncmVsZWFzZScsICdpbmZvJywgJy0tanNvbiddLFxuICAgICAgICB7XG4gICAgICAgICAgY3dkOiBwcm9qZWN0RGlyLFxuICAgICAgICAgIG1vZGU6ICdzaWxlbnQnLFxuICAgICAgICB9LFxuICAgICAgKTtcbiAgICAgIC8vIFRoZSBgbmctZGV2IHJlbGVhc2UgaW5mb2AgY29tbWFuZCBwcmludHMgYSBKU09OIG9iamVjdCB0byBzdGRvdXQuXG4gICAgICByZXR1cm4gSlNPTi5wYXJzZShzdGRvdXQudHJpbSgpKSBhcyBSZWxlYXNlSW5mb0pzb25TdGRvdXQ7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgTG9nLmVycm9yKGUpO1xuICAgICAgTG9nLmVycm9yKFxuICAgICAgICBgICDinJggICBBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSByZXRyaWV2aW5nIHRoZSByZWxlYXNlIGluZm9ybWF0aW9uIGZvciBgICtcbiAgICAgICAgICBgdGhlIGN1cnJlbnRseSBjaGVja2VkLW91dCBicmFuY2guYCxcbiAgICAgICk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlcyB0aGUgYG5nLWRldiByZWxlYXNlIHByZWNoZWNrYCBjb21tYW5kIGluIG9yZGVyIHRvIHZhbGlkYXRlIHRoZVxuICAgKiBidWlsdCBwYWNrYWdlcyBvciBydW4gb3RoZXIgdmFsaWRhdGlvbnMgYmVmb3JlIGFjdHVhbGx5IHJlbGVhc2luZy5cbiAgICpcbiAgICogVGhpcyBpcyBydW4gYXMgYW4gZXh0ZXJuYWwgY29tbWFuZCBiZWNhdXNlIHByZWNoZWNrcyBjYW4gYmUgY3VzdG9taXplZFxuICAgKiB0aHJvdWdoIHRoZSBgbmctZGV2YCBjb25maWd1cmF0aW9uLCBhbmQgd2Ugd291bGRuJ3Qgd2FudCB0byBydW4gcHJlY2hlY2tzXG4gICAqIGZyb20gdGhlIGBuZXh0YCBicmFuY2ggZm9yIG9sZGVyIGJyYW5jaGVzLCBsaWtlIHBhdGNoIG9yIGFuIExUUyBicmFuY2guXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW52b2tlUmVsZWFzZVByZWNoZWNrKFxuICAgIHByb2plY3REaXI6IHN0cmluZyxcbiAgICBuZXdWZXJzaW9uOiBzZW12ZXIuU2VtVmVyLFxuICAgIGJ1aWx0UGFja2FnZXNXaXRoSW5mbzogQnVpbHRQYWNrYWdlV2l0aEluZm9bXSxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gTm90ZTogV2UgY2Fubm90IHVzZSBgeWFybmAgZGlyZWN0bHkgYXMgY29tbWFuZCBiZWNhdXNlIHdlIG1pZ2h0IG9wZXJhdGUgaW5cbiAgICAvLyBhIGRpZmZlcmVudCBwdWJsaXNoIGJyYW5jaCBhbmQgdGhlIGN1cnJlbnQgYFBBVEhgIHdpbGwgcG9pbnQgdG8gdGhlIFlhcm4gdmVyc2lvblxuICAgIC8vIHRoYXQgaW52b2tlZCB0aGUgcmVsZWFzZSB0b29sLiBNb3JlIGRldGFpbHMgaW4gdGhlIGZ1bmN0aW9uIGRlc2NyaXB0aW9uLlxuICAgIGNvbnN0IHlhcm5Db21tYW5kID0gYXdhaXQgcmVzb2x2ZVlhcm5TY3JpcHRGb3JQcm9qZWN0KHByb2plY3REaXIpO1xuICAgIGNvbnN0IHByZWNoZWNrU3RkaW46IFJlbGVhc2VQcmVjaGVja0pzb25TdGRpbiA9IHtcbiAgICAgIGJ1aWx0UGFja2FnZXNXaXRoSW5mbyxcbiAgICAgIG5ld1ZlcnNpb246IG5ld1ZlcnNpb24uZm9ybWF0KCksXG4gICAgfTtcblxuICAgIHRyeSB7XG4gICAgICAvLyBOb3RlOiBObyBwcm9ncmVzcyBpbmRpY2F0b3IgbmVlZGVkIGFzIHRoYXQgaXMgZXhwZWN0ZWQgdG8gYmUgYSBmYXN0IG9wZXJhdGlvbi4gQWxzb1xuICAgICAgLy8gd2UgZXhwZWN0IHRoZSBjb21tYW5kIHRvIGhhbmRsZSBjb25zb2xlIG1lc3NhZ2luZyBhbmQgd291bGRuJ3Qgd2FudCB0byBjbG9iYmVyIGl0LlxuICAgICAgLy8gVE9ETzogZGV0ZWN0IHlhcm4gYmVycnkgYW5kIGhhbmRsZSBmbGFnIGRpZmZlcmVuY2VzIHByb3Blcmx5LlxuICAgICAgYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKFxuICAgICAgICB5YXJuQ29tbWFuZC5iaW5hcnksXG4gICAgICAgIFsuLi55YXJuQ29tbWFuZC5hcmdzLCAnbmctZGV2JywgJ3JlbGVhc2UnLCAncHJlY2hlY2snXSxcbiAgICAgICAge1xuICAgICAgICAgIGN3ZDogcHJvamVjdERpcixcbiAgICAgICAgICAvLyBOb3RlOiBXZSBwYXNzIHRoZSBwcmVjaGVjayBpbmZvcm1hdGlvbiB0byB0aGUgY29tbWFuZCB0aHJvdWdoIGBzdGRpbmBcbiAgICAgICAgICAvLyBiZWNhdXNlIGNvbW1hbmQgbGluZSBhcmd1bWVudHMgYXJlIGxlc3MgcmVsaWFibGUgYW5kIGhhdmUgbGVuZ3RoIGxpbWl0cy5cbiAgICAgICAgICBpbnB1dDogSlNPTi5zdHJpbmdpZnkocHJlY2hlY2tTdGRpbiksXG4gICAgICAgIH0sXG4gICAgICApO1xuICAgICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgRXhlY3V0ZWQgcmVsZWFzZSBwcmUtY2hlY2tzIGZvciAke25ld1ZlcnNpb259YCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIFRoZSBgc3Bhd25gIGludm9jYXRpb24gYWxyZWFkeSBwcmludHMgYWxsIHN0ZG91dC9zdGRlcnIsIHNvIHdlIGRvbid0IG5lZWQgcmUtcHJpbnQuXG4gICAgICAvLyBUbyBlYXNlIGRlYnVnZ2luZyBpbiBjYXNlIG9mIHJ1bnRpbWUgZXhjZXB0aW9ucywgd2Ugc3RpbGwgcHJpbnQgdGhlIGVycm9yIHRvIGBkZWJ1Z2AuXG4gICAgICBMb2cuZGVidWcoZSk7XG4gICAgICBMb2cuZXJyb3IoYCAg4pyYICAgQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgcnVubmluZyByZWxlYXNlIHByZS1jaGVja3MuYCk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlcyB0aGUgYHlhcm4gaW5zdGFsbGAgY29tbWFuZCBpbiBvcmRlciB0byBpbnN0YWxsIGRlcGVuZGVuY2llcyBmb3JcbiAgICogdGhlIGNvbmZpZ3VyZWQgcHJvamVjdCB3aXRoIHRoZSBjdXJyZW50bHkgY2hlY2tlZCBvdXQgcmV2aXNpb24uXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW52b2tlWWFybkluc3RhbGwocHJvamVjdERpcjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gTm90ZTogV2UgY2Fubm90IHVzZSBgeWFybmAgZGlyZWN0bHkgYXMgY29tbWFuZCBiZWNhdXNlIHdlIG1pZ2h0IG9wZXJhdGUgaW5cbiAgICAvLyBhIGRpZmZlcmVudCBwdWJsaXNoIGJyYW5jaCBhbmQgdGhlIGN1cnJlbnQgYFBBVEhgIHdpbGwgcG9pbnQgdG8gdGhlIFlhcm4gdmVyc2lvblxuICAgIC8vIHRoYXQgaW52b2tlZCB0aGUgcmVsZWFzZSB0b29sLiBNb3JlIGRldGFpbHMgaW4gdGhlIGZ1bmN0aW9uIGRlc2NyaXB0aW9uLlxuICAgIGNvbnN0IHlhcm5Db21tYW5kID0gYXdhaXQgcmVzb2x2ZVlhcm5TY3JpcHRGb3JQcm9qZWN0KHByb2plY3REaXIpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIE5vdGU6IE5vIHByb2dyZXNzIGluZGljYXRvciBuZWVkZWQgYXMgdGhhdCBpcyB0aGUgcmVzcG9uc2liaWxpdHkgb2YgdGhlIGNvbW1hbmQuXG4gICAgICAvLyBUT0RPOiBDb25zaWRlciB1c2luZyBhbiBPcmEgc3Bpbm5lciBpbnN0ZWFkIHRvIGVuc3VyZSBtaW5pbWFsIGNvbnNvbGUgb3V0cHV0LlxuICAgICAgYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKFxuICAgICAgICB5YXJuQ29tbWFuZC5iaW5hcnksXG4gICAgICAgIFtcbiAgICAgICAgICAuLi55YXJuQ29tbWFuZC5hcmdzLFxuICAgICAgICAgICdpbnN0YWxsJyxcbiAgICAgICAgICAuLi4oeWFybkNvbW1hbmQubGVnYWN5ID8gWyctLWZyb3plbi1sb2NrZmlsZScsICctLW5vbi1pbnRlcmFjdGl2ZSddIDogWyctLWltbXV0YWJsZSddKSxcbiAgICAgICAgXSxcbiAgICAgICAge2N3ZDogcHJvamVjdERpcn0sXG4gICAgICApO1xuICAgICAgTG9nLmluZm8oZ3JlZW4oJyAg4pyTICAgSW5zdGFsbGVkIHByb2plY3QgZGVwZW5kZW5jaWVzLicpKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBMb2cuZXJyb3IoZSk7XG4gICAgICBMb2cuZXJyb3IoJyAg4pyYICAgQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgaW5zdGFsbGluZyBkZXBlbmRlbmNpZXMuJyk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlcyB0aGUgYHlhcm4gYmF6ZWwgc3luYyAtLW9ubHk9cmVwb2AgY29tbWFuZCBpbiBvcmRlclxuICAgKiB0byByZWZyZXNoIEFzcGVjdCBsb2NrIGZpbGVzLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZUJhemVsVXBkYXRlQXNwZWN0TG9ja0ZpbGVzKHByb2plY3REaXI6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcignVXBkYXRpbmcgQXNwZWN0IGxvY2sgZmlsZXMnKTtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKGdldEJhemVsQmluKCksIFsnc3luYycsICctLW9ubHk9cmVwbyddLCB7XG4gICAgICAgIGN3ZDogcHJvamVjdERpcixcbiAgICAgICAgbW9kZTogJ3NpbGVudCcsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBOb3RlOiBHcmFjZWZ1bGx5IGhhbmRsaW5nIHRoZXNlIGVycm9ycyBiZWNhdXNlIGBzeW5jYCBjb21tYW5kXG4gICAgICAvLyBleGl0cyB3aXRoIGEgbm9uLXplcm8gZXhpdCBjb2RlIHdoZW4gcG5wbS1sb2NrLnlhbWwgZmlsZSBpcyB1cGRhdGVkLlxuICAgICAgTG9nLmRlYnVnKGUpO1xuICAgIH1cbiAgICBzcGlubmVyLnN1Y2Nlc3MoZ3JlZW4oJyBVcGRhdGVkIEFzcGVjdCBgcnVsZXNfanNgIGxvY2sgZmlsZXMuJykpO1xuICB9XG59XG4iXX0=