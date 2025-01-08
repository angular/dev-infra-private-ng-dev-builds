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
     * Invokes the `yarn bazel run @npm2//:sync` command in order
     * to refresh Aspect lock files.
     */
    static async invokeBazelUpdateAspectLockFiles(projectDir) {
        try {
            // Note: No progress indicator needed as that is the responsibility of the command.
            // TODO: Consider using an Ora spinner instead to ensure minimal console output.
            await ChildProcess.spawn(getBazelBin(), ['run', '@npm2//:sync'], { cwd: projectDir });
        }
        catch (e) {
            // Note: Gracefully handling these errors because `sync` command
            // alway exits with a non-zero exit code.
        }
        Log.info(green('  ✓   Updated Aspect `rules_js` lock files.'));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZXJuYWwtY29tbWFuZHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9wdWJsaXNoL2V4dGVybmFsLWNvbW1hbmRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUMxRCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFHL0MsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDM0QsT0FBTyxFQUFDLDJCQUEyQixFQUFDLE1BQU0saUNBQWlDLENBQUM7QUFLNUUsT0FBTyxFQUFDLEtBQUssRUFBRSxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNsRCxPQUFPLEVBQUMsV0FBVyxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFFckQ7Ozs7Ozs7Ozs7Ozs7OztHQWVHO0FBRUgsMEVBQTBFO0FBQzFFLE1BQU0sT0FBZ0IsZ0JBQWdCO0lBQ3BDOzs7Ozs7T0FNRztJQUNILE1BQU0sQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQzNCLFVBQWtCLEVBQ2xCLFVBQXNCLEVBQ3RCLE9BQXNCLEVBQ3RCLFVBQStDLEVBQUMsd0JBQXdCLEVBQUUsS0FBSyxFQUFDO1FBRWhGLDZFQUE2RTtRQUM3RSxtRkFBbUY7UUFDbkYsMkVBQTJFO1FBQzNFLE1BQU0sV0FBVyxHQUFHLE1BQU0sMkJBQTJCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFbEUsSUFBSSxDQUFDO1lBQ0gsbUZBQW1GO1lBQ25GLGdFQUFnRTtZQUNoRSxNQUFNLFlBQVksQ0FBQyxLQUFLLENBQ3RCLFdBQVcsQ0FBQyxNQUFNLEVBQ2xCO2dCQUNFLEdBQUcsV0FBVyxDQUFDLElBQUk7Z0JBQ25CLFFBQVE7Z0JBQ1IsU0FBUztnQkFDVCxjQUFjO2dCQUNkLFVBQVU7Z0JBQ1YsT0FBTyxDQUFD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VCxHQUFHLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2FBQ3ZGLEVBQ0QsRUFBQyxHQUFHLEVBQUUsVUFBVSxFQUFDLENBQ2xCLENBQUM7WUFDRixHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDLENBQUM7UUFDM0QsQ0FBQztRQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDWCxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2IsR0FBRyxDQUFDLEtBQUssQ0FBQyx3REFBd0QsQ0FBQyxDQUFDO1lBQ3BFLE1BQU0sSUFBSSx1QkFBdUIsRUFBRSxDQUFDO1FBQ3RDLENBQUM7SUFDSCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQyxVQUFrQjtRQUM5RCxJQUFJLENBQUM7WUFDSCxtRkFBbUY7WUFDbkYsZ0ZBQWdGO1lBQ2hGLE1BQU0sWUFBWSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLEtBQUssRUFBRSxjQUFjLENBQUMsRUFBRSxFQUFDLEdBQUcsRUFBRSxVQUFVLEVBQUMsQ0FBQyxDQUFDO1FBQ3RGLENBQUM7UUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ1gsZ0VBQWdFO1lBQ2hFLHlDQUF5QztRQUMzQyxDQUFDO1FBRUQsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsNkNBQTZDLENBQUMsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XG5cbmltcG9ydCB7Q2hpbGRQcm9jZXNzfSBmcm9tICcuLi8uLi91dGlscy9jaGlsZC1wcm9jZXNzLmpzJztcbmltcG9ydCB7U3Bpbm5lcn0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lci5qcyc7XG5pbXBvcnQge05wbURpc3RUYWd9IGZyb20gJy4uL3ZlcnNpb25pbmcvaW5kZXguanMnO1xuXG5pbXBvcnQge0ZhdGFsUmVsZWFzZUFjdGlvbkVycm9yfSBmcm9tICcuL2FjdGlvbnMtZXJyb3IuanMnO1xuaW1wb3J0IHtyZXNvbHZlWWFyblNjcmlwdEZvclByb2plY3R9IGZyb20gJy4uLy4uL3V0aWxzL3Jlc29sdmUteWFybi1iaW4uanMnO1xuaW1wb3J0IHtSZWxlYXNlQnVpbGRKc29uU3Rkb3V0fSBmcm9tICcuLi9idWlsZC9jbGkuanMnO1xuaW1wb3J0IHtSZWxlYXNlSW5mb0pzb25TdGRvdXR9IGZyb20gJy4uL2luZm8vY2xpLmpzJztcbmltcG9ydCB7UmVsZWFzZVByZWNoZWNrSnNvblN0ZGlufSBmcm9tICcuLi9wcmVjaGVjay9jbGkuanMnO1xuaW1wb3J0IHtCdWlsdFBhY2thZ2VXaXRoSW5mb30gZnJvbSAnLi4vY29uZmlnL2luZGV4LmpzJztcbmltcG9ydCB7Z3JlZW4sIExvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge2dldEJhemVsQmlufSBmcm9tICcuLi8uLi91dGlscy9iYXplbC1iaW4uanMnO1xuXG4vKlxuICogIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjXG4gKlxuICogVGhpcyBmaWxlIGNvbnRhaW5zIGhlbHBlcnMgZm9yIGludm9raW5nIGV4dGVybmFsIGBuZy1kZXZgIGNvbW1hbmRzLiBBIHN1YnNldCBvZiBhY3Rpb25zLFxuICogbGlrZSBidWlsZGluZyByZWxlYXNlIG91dHB1dCBvciBzZXR0aW5nIGHOvSBOUE0gZGlzdCB0YWcgZm9yIHJlbGVhc2UgcGFja2FnZXMsIGNhbm5vdCBiZVxuICogcGVyZm9ybWVkIGRpcmVjdGx5IGFzIHBhcnQgb2YgdGhlIHJlbGVhc2UgdG9vbCBhbmQgbmVlZCB0byBiZSBkZWxlZ2F0ZWQgdG8gZXh0ZXJuYWwgYG5nLWRldmBcbiAqIGNvbW1hbmRzIHRoYXQgZXhpc3QgYWNyb3NzIGFyYml0cmFyeSB2ZXJzaW9uIGJyYW5jaGVzLlxuICpcbiAqIEluIGEgY29uY3JldGUgZXhhbXBsZTogQ29uc2lkZXIgYSBuZXcgcGF0Y2ggdmVyc2lvbiBpcyByZWxlYXNlZCBhbmQgdGhhdCBhIG5ldyByZWxlYXNlXG4gKiBwYWNrYWdlIGhhcyBiZWVuIGFkZGVkIHRvIHRoZSBgbmV4dGAgYnJhbmNoLiBUaGUgcGF0Y2ggYnJhbmNoIHdpbGwgbm90IGNvbnRhaW4gdGhlIG5ld1xuICogcmVsZWFzZSBwYWNrYWdlLCBzbyB3ZSBjb3VsZCBub3QgYnVpbGQgdGhlIHJlbGVhc2Ugb3V0cHV0IGZvciBpdC4gVG8gd29yayBhcm91bmQgdGhpcywgd2VcbiAqIGNhbGwgdGhlIG5nLWRldiBidWlsZCBjb21tYW5kIGZvciB0aGUgcGF0Y2ggdmVyc2lvbiBicmFuY2ggYW5kIGV4cGVjdCBpdCB0byByZXR1cm4gYSBsaXN0XG4gKiBvZiBidWlsdCBwYWNrYWdlcyB0aGF0IG5lZWQgdG8gYmUgcmVsZWFzZWQgYXMgcGFydCBvZiB0aGlzIHJlbGVhc2UgdHJhaW4uXG4gKlxuICogIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjXG4gKi9cblxuLyoqIENsYXNzIGhvbGRpbmcgbWV0aG9kIGZvciBpbnZva2luZyByZWxlYXNlIGFjdGlvbiBleHRlcm5hbCBjb21tYW5kcy4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBFeHRlcm5hbENvbW1hbmRzIHtcbiAgLyoqXG4gICAqIEludm9rZXMgdGhlIGBuZy1kZXYgcmVsZWFzZSBzZXQtZGlzdC10YWdgIGNvbW1hbmQgaW4gb3JkZXIgdG8gc2V0IHRoZSBzcGVjaWZpZWRcbiAgICogTlBNIGRpc3QgdGFnIGZvciBhbGwgcGFja2FnZXMgaW4gdGhlIGNoZWNrZWQgb3V0IGJyYW5jaCB0byB0aGUgZ2l2ZW4gdmVyc2lvbi5cbiAgICpcbiAgICogT3B0aW9uYWxseSwgdGhlIE5QTSBkaXN0IHRhZyB1cGRhdGUgY2FuIGJlIHNraXBwZWQgZm9yIGV4cGVyaW1lbnRhbCBwYWNrYWdlcy4gVGhpc1xuICAgKiBpcyB1c2VmdWwgd2hlbiB0YWdnaW5nIGxvbmctdGVybS1zdXBwb3J0IHBhY2thZ2VzIHdpdGhpbiBOUE0uXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW52b2tlU2V0TnBtRGlzdChcbiAgICBwcm9qZWN0RGlyOiBzdHJpbmcsXG4gICAgbnBtRGlzdFRhZzogTnBtRGlzdFRhZyxcbiAgICB2ZXJzaW9uOiBzZW12ZXIuU2VtVmVyLFxuICAgIG9wdGlvbnM6IHtza2lwRXhwZXJpbWVudGFsUGFja2FnZXM6IGJvb2xlYW59ID0ge3NraXBFeHBlcmltZW50YWxQYWNrYWdlczogZmFsc2V9LFxuICApIHtcbiAgICAvLyBOb3RlOiBXZSBjYW5ub3QgdXNlIGB5YXJuYCBkaXJlY3RseSBhcyBjb21tYW5kIGJlY2F1c2Ugd2UgbWlnaHQgb3BlcmF0ZSBpblxuICAgIC8vIGEgZGlmZmVyZW50IHB1Ymxpc2ggYnJhbmNoIGFuZCB0aGUgY3VycmVudCBgUEFUSGAgd2lsbCBwb2ludCB0byB0aGUgWWFybiB2ZXJzaW9uXG4gICAgLy8gdGhhdCBpbnZva2VkIHRoZSByZWxlYXNlIHRvb2wuIE1vcmUgZGV0YWlscyBpbiB0aGUgZnVuY3Rpb24gZGVzY3JpcHRpb24uXG4gICAgY29uc3QgeWFybkNvbW1hbmQgPSBhd2FpdCByZXNvbHZlWWFyblNjcmlwdEZvclByb2plY3QocHJvamVjdERpcik7XG5cbiAgICB0cnkge1xuICAgICAgLy8gTm90ZTogTm8gcHJvZ3Jlc3MgaW5kaWNhdG9yIG5lZWRlZCBhcyB0aGF0IGlzIHRoZSByZXNwb25zaWJpbGl0eSBvZiB0aGUgY29tbWFuZC5cbiAgICAgIC8vIFRPRE86IGRldGVjdCB5YXJuIGJlcnJ5IGFuZCBoYW5kbGUgZmxhZyBkaWZmZXJlbmNlcyBwcm9wZXJseS5cbiAgICAgIGF3YWl0IENoaWxkUHJvY2Vzcy5zcGF3bihcbiAgICAgICAgeWFybkNvbW1hbmQuYmluYXJ5LFxuICAgICAgICBbXG4gICAgICAgICAgLi4ueWFybkNvbW1hbmQuYXJncyxcbiAgICAgICAgICAnbmctZGV2JyxcbiAgICAgICAgICAncmVsZWFzZScsXG4gICAgICAgICAgJ3NldC1kaXN0LXRhZycsXG4gICAgICAgICAgbnBtRGlzdFRhZyxcbiAgICAgICAgICB2ZXJzaW9uLmZvcm1hdCgpLFxuICAgICAgICAgIGAtLXNraXAtZXhwZXJpbWVudGFsLXBhY2thZ2VzPSR7b3B0aW9ucy5za2lwRXhwZXJpbWVudGFsUGFja2FnZXN9YCxcbiAgICAgICAgXSxcbiAgICAgICAge2N3ZDogcHJvamVjdERpcn0sXG4gICAgICApO1xuICAgICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgU2V0IFwiJHtucG1EaXN0VGFnfVwiIE5QTSBkaXN0IHRhZyBmb3IgYWxsIHBhY2thZ2VzIHRvIHYke3ZlcnNpb259LmApKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBMb2cuZXJyb3IoZSk7XG4gICAgICBMb2cuZXJyb3IoYCAg4pyYICAgQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgc2V0dGluZyB0aGUgTlBNIGRpc3QgdGFnIGZvciBcIiR7bnBtRGlzdFRhZ31cIi5gKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbnZva2VzIHRoZSBgbmctZGV2IHJlbGVhc2UgbnBtLWRpc3QtdGFnIGRlbGV0ZWAgY29tbWFuZCBpbiBvcmRlciB0byBkZWxldGUgdGhlXG4gICAqIE5QTSBkaXN0IHRhZyBmb3IgYWxsIHBhY2thZ2VzIGluIHRoZSBjaGVja2VkLW91dCB2ZXJzaW9uIGJyYW5jaC5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBpbnZva2VEZWxldGVOcG1EaXN0VGFnKHByb2plY3REaXI6IHN0cmluZywgbnBtRGlzdFRhZzogTnBtRGlzdFRhZykge1xuICAgIC8vIE5vdGU6IFdlIGNhbm5vdCB1c2UgYHlhcm5gIGRpcmVjdGx5IGFzIGNvbW1hbmQgYmVjYXVzZSB3ZSBtaWdodCBvcGVyYXRlIGluXG4gICAgLy8gYSBkaWZmZXJlbnQgcHVibGlzaCBicmFuY2ggYW5kIHRoZSBjdXJyZW50IGBQQVRIYCB3aWxsIHBvaW50IHRvIHRoZSBZYXJuIHZlcnNpb25cbiAgICAvLyB0aGF0IGludm9rZWQgdGhlIHJlbGVhc2UgdG9vbC4gTW9yZSBkZXRhaWxzIGluIHRoZSBmdW5jdGlvbiBkZXNjcmlwdGlvbi5cbiAgICBjb25zdCB5YXJuQ29tbWFuZCA9IGF3YWl0IHJlc29sdmVZYXJuU2NyaXB0Rm9yUHJvamVjdChwcm9qZWN0RGlyKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyBOb3RlOiBObyBwcm9ncmVzcyBpbmRpY2F0b3IgbmVlZGVkIGFzIHRoYXQgaXMgdGhlIHJlc3BvbnNpYmlsaXR5IG9mIHRoZSBjb21tYW5kLlxuICAgICAgLy8gVE9ETzogZGV0ZWN0IHlhcm4gYmVycnkgYW5kIGhhbmRsZSBmbGFnIGRpZmZlcmVuY2VzIHByb3Blcmx5LlxuICAgICAgYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKFxuICAgICAgICB5YXJuQ29tbWFuZC5iaW5hcnksXG4gICAgICAgIFsuLi55YXJuQ29tbWFuZC5hcmdzLCAnbmctZGV2JywgJ3JlbGVhc2UnLCAnbnBtLWRpc3QtdGFnJywgJ2RlbGV0ZScsIG5wbURpc3RUYWddLFxuICAgICAgICB7Y3dkOiBwcm9qZWN0RGlyfSxcbiAgICAgICk7XG4gICAgICBMb2cuaW5mbyhncmVlbihgICDinJMgICBEZWxldGVkIFwiJHtucG1EaXN0VGFnfVwiIE5QTSBkaXN0IHRhZyBmb3IgYWxsIHBhY2thZ2VzLmApKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBMb2cuZXJyb3IoZSk7XG4gICAgICBMb2cuZXJyb3IoYCAg4pyYICAgQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgZGVsZXRpbmcgdGhlIE5QTSBkaXN0IHRhZzogXCIke25wbURpc3RUYWd9XCIuYCk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlcyB0aGUgYG5nLWRldiByZWxlYXNlIGJ1aWxkYCBjb21tYW5kIGluIG9yZGVyIHRvIGJ1aWxkIHRoZSByZWxlYXNlXG4gICAqIHBhY2thZ2VzIGZvciB0aGUgY3VycmVudGx5IGNoZWNrZWQgb3V0IGJyYW5jaC5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBpbnZva2VSZWxlYXNlQnVpbGQocHJvamVjdERpcjogc3RyaW5nKTogUHJvbWlzZTxSZWxlYXNlQnVpbGRKc29uU3Rkb3V0PiB7XG4gICAgLy8gTm90ZTogV2UgY2Fubm90IHVzZSBgeWFybmAgZGlyZWN0bHkgYXMgY29tbWFuZCBiZWNhdXNlIHdlIG1pZ2h0IG9wZXJhdGUgaW5cbiAgICAvLyBhIGRpZmZlcmVudCBwdWJsaXNoIGJyYW5jaCBhbmQgdGhlIGN1cnJlbnQgYFBBVEhgIHdpbGwgcG9pbnQgdG8gdGhlIFlhcm4gdmVyc2lvblxuICAgIC8vIHRoYXQgaW52b2tlZCB0aGUgcmVsZWFzZSB0b29sLiBNb3JlIGRldGFpbHMgaW4gdGhlIGZ1bmN0aW9uIGRlc2NyaXB0aW9uLlxuICAgIGNvbnN0IHlhcm5Db21tYW5kID0gYXdhaXQgcmVzb2x2ZVlhcm5TY3JpcHRGb3JQcm9qZWN0KHByb2plY3REaXIpO1xuICAgIC8vIE5vdGU6IFdlIGV4cGxpY2l0bHkgbWVudGlvbiB0aGF0IHRoaXMgY2FuIHRha2UgYSBmZXcgbWludXRlcywgc28gdGhhdCBpdCdzIG9idmlvdXNcbiAgICAvLyB0byBjYXJldGFrZXJzIHRoYXQgaXQgY2FuIHRha2UgbG9uZ2VyIHRoYW4ganVzdCBhIGZldyBzZWNvbmRzLlxuICAgIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcignQnVpbGRpbmcgcmVsZWFzZSBvdXRwdXQuIFRoaXMgY2FuIHRha2UgYSBmZXcgbWludXRlcy4nKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyBTaW5jZSB3ZSBleHBlY3QgSlNPTiB0byBiZSBwcmludGVkIGZyb20gdGhlIGBuZy1kZXYgcmVsZWFzZSBidWlsZGAgY29tbWFuZCxcbiAgICAgIC8vIHdlIHNwYXduIHRoZSBwcm9jZXNzIGluIHNpbGVudCBtb2RlLiBXZSBoYXZlIHNldCB1cCBhbiBPcmEgcHJvZ3Jlc3Mgc3Bpbm5lci5cbiAgICAgIC8vIFRPRE86IGRldGVjdCB5YXJuIGJlcnJ5IGFuZCBoYW5kbGUgZmxhZyBkaWZmZXJlbmNlcyBwcm9wZXJseS5cbiAgICAgIGNvbnN0IHtzdGRvdXR9ID0gYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKFxuICAgICAgICB5YXJuQ29tbWFuZC5iaW5hcnksXG4gICAgICAgIFsuLi55YXJuQ29tbWFuZC5hcmdzLCAnbmctZGV2JywgJ3JlbGVhc2UnLCAnYnVpbGQnLCAnLS1qc29uJ10sXG4gICAgICAgIHtcbiAgICAgICAgICBjd2Q6IHByb2plY3REaXIsXG4gICAgICAgICAgbW9kZTogJ3NpbGVudCcsXG4gICAgICAgIH0sXG4gICAgICApO1xuICAgICAgc3Bpbm5lci5jb21wbGV0ZSgpO1xuICAgICAgTG9nLmluZm8oZ3JlZW4oJyAg4pyTICAgQnVpbHQgcmVsZWFzZSBvdXRwdXQgZm9yIGFsbCBwYWNrYWdlcy4nKSk7XG4gICAgICAvLyBUaGUgYG5nLWRldiByZWxlYXNlIGJ1aWxkYCBjb21tYW5kIHByaW50cyBhIEpTT04gYXJyYXkgdG8gc3Rkb3V0XG4gICAgICAvLyB0aGF0IHJlcHJlc2VudHMgdGhlIGJ1aWx0IHJlbGVhc2UgcGFja2FnZXMgYW5kIHRoZWlyIG91dHB1dCBwYXRocy5cbiAgICAgIHJldHVybiBKU09OLnBhcnNlKHN0ZG91dC50cmltKCkpIGFzIFJlbGVhc2VCdWlsZEpzb25TdGRvdXQ7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgc3Bpbm5lci5jb21wbGV0ZSgpO1xuICAgICAgTG9nLmVycm9yKGUpO1xuICAgICAgTG9nLmVycm9yKCcgIOKcmCAgIEFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGJ1aWxkaW5nIHRoZSByZWxlYXNlIHBhY2thZ2VzLicpO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEludm9rZXMgdGhlIGBuZy1kZXYgcmVsZWFzZSBpbmZvYCBjb21tYW5kIGluIG9yZGVyIHRvIHJldHJpZXZlIGluZm9ybWF0aW9uXG4gICAqIGFib3V0IHRoZSByZWxlYXNlIGZvciB0aGUgY3VycmVudGx5IGNoZWNrZWQtb3V0IGJyYW5jaC5cbiAgICpcbiAgICogVGhpcyBpcyB1c2VmdWwgdG8gZS5nLiBkZXRlcm1pbmUgd2hldGhlciBhIGJ1aWx0IHBhY2thZ2UgaXMgY3VycmVudGx5XG4gICAqIGRlbm90ZWQgYXMgZXhwZXJpbWVudGFsIG9yIG5vdC5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBpbnZva2VSZWxlYXNlSW5mbyhwcm9qZWN0RGlyOiBzdHJpbmcpOiBQcm9taXNlPFJlbGVhc2VJbmZvSnNvblN0ZG91dD4ge1xuICAgIC8vIE5vdGU6IFdlIGNhbm5vdCB1c2UgYHlhcm5gIGRpcmVjdGx5IGFzIGNvbW1hbmQgYmVjYXVzZSB3ZSBtaWdodCBvcGVyYXRlIGluXG4gICAgLy8gYSBkaWZmZXJlbnQgcHVibGlzaCBicmFuY2ggYW5kIHRoZSBjdXJyZW50IGBQQVRIYCB3aWxsIHBvaW50IHRvIHRoZSBZYXJuIHZlcnNpb25cbiAgICAvLyB0aGF0IGludm9rZWQgdGhlIHJlbGVhc2UgdG9vbC4gTW9yZSBkZXRhaWxzIGluIHRoZSBmdW5jdGlvbiBkZXNjcmlwdGlvbi5cbiAgICBjb25zdCB5YXJuQ29tbWFuZCA9IGF3YWl0IHJlc29sdmVZYXJuU2NyaXB0Rm9yUHJvamVjdChwcm9qZWN0RGlyKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyBOb3RlOiBObyBwcm9ncmVzcyBpbmRpY2F0b3IgbmVlZGVkIGFzIHRoYXQgaXMgZXhwZWN0ZWQgdG8gYmUgYSBmYXN0IG9wZXJhdGlvbi5cbiAgICAgIC8vIFRPRE86IGRldGVjdCB5YXJuIGJlcnJ5IGFuZCBoYW5kbGUgZmxhZyBkaWZmZXJlbmNlcyBwcm9wZXJseS5cbiAgICAgIGNvbnN0IHtzdGRvdXR9ID0gYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKFxuICAgICAgICB5YXJuQ29tbWFuZC5iaW5hcnksXG4gICAgICAgIFsuLi55YXJuQ29tbWFuZC5hcmdzLCAnbmctZGV2JywgJ3JlbGVhc2UnLCAnaW5mbycsICctLWpzb24nXSxcbiAgICAgICAge1xuICAgICAgICAgIGN3ZDogcHJvamVjdERpcixcbiAgICAgICAgICBtb2RlOiAnc2lsZW50JyxcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgICAvLyBUaGUgYG5nLWRldiByZWxlYXNlIGluZm9gIGNvbW1hbmQgcHJpbnRzIGEgSlNPTiBvYmplY3QgdG8gc3Rkb3V0LlxuICAgICAgcmV0dXJuIEpTT04ucGFyc2Uoc3Rkb3V0LnRyaW0oKSkgYXMgUmVsZWFzZUluZm9Kc29uU3Rkb3V0O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIExvZy5lcnJvcihlKTtcbiAgICAgIExvZy5lcnJvcihcbiAgICAgICAgYCAg4pyYICAgQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgcmV0cmlldmluZyB0aGUgcmVsZWFzZSBpbmZvcm1hdGlvbiBmb3IgYCArXG4gICAgICAgICAgYHRoZSBjdXJyZW50bHkgY2hlY2tlZC1vdXQgYnJhbmNoLmAsXG4gICAgICApO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEludm9rZXMgdGhlIGBuZy1kZXYgcmVsZWFzZSBwcmVjaGVja2AgY29tbWFuZCBpbiBvcmRlciB0byB2YWxpZGF0ZSB0aGVcbiAgICogYnVpbHQgcGFja2FnZXMgb3IgcnVuIG90aGVyIHZhbGlkYXRpb25zIGJlZm9yZSBhY3R1YWxseSByZWxlYXNpbmcuXG4gICAqXG4gICAqIFRoaXMgaXMgcnVuIGFzIGFuIGV4dGVybmFsIGNvbW1hbmQgYmVjYXVzZSBwcmVjaGVja3MgY2FuIGJlIGN1c3RvbWl6ZWRcbiAgICogdGhyb3VnaCB0aGUgYG5nLWRldmAgY29uZmlndXJhdGlvbiwgYW5kIHdlIHdvdWxkbid0IHdhbnQgdG8gcnVuIHByZWNoZWNrc1xuICAgKiBmcm9tIHRoZSBgbmV4dGAgYnJhbmNoIGZvciBvbGRlciBicmFuY2hlcywgbGlrZSBwYXRjaCBvciBhbiBMVFMgYnJhbmNoLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZVJlbGVhc2VQcmVjaGVjayhcbiAgICBwcm9qZWN0RGlyOiBzdHJpbmcsXG4gICAgbmV3VmVyc2lvbjogc2VtdmVyLlNlbVZlcixcbiAgICBidWlsdFBhY2thZ2VzV2l0aEluZm86IEJ1aWx0UGFja2FnZVdpdGhJbmZvW10sXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIE5vdGU6IFdlIGNhbm5vdCB1c2UgYHlhcm5gIGRpcmVjdGx5IGFzIGNvbW1hbmQgYmVjYXVzZSB3ZSBtaWdodCBvcGVyYXRlIGluXG4gICAgLy8gYSBkaWZmZXJlbnQgcHVibGlzaCBicmFuY2ggYW5kIHRoZSBjdXJyZW50IGBQQVRIYCB3aWxsIHBvaW50IHRvIHRoZSBZYXJuIHZlcnNpb25cbiAgICAvLyB0aGF0IGludm9rZWQgdGhlIHJlbGVhc2UgdG9vbC4gTW9yZSBkZXRhaWxzIGluIHRoZSBmdW5jdGlvbiBkZXNjcmlwdGlvbi5cbiAgICBjb25zdCB5YXJuQ29tbWFuZCA9IGF3YWl0IHJlc29sdmVZYXJuU2NyaXB0Rm9yUHJvamVjdChwcm9qZWN0RGlyKTtcbiAgICBjb25zdCBwcmVjaGVja1N0ZGluOiBSZWxlYXNlUHJlY2hlY2tKc29uU3RkaW4gPSB7XG4gICAgICBidWlsdFBhY2thZ2VzV2l0aEluZm8sXG4gICAgICBuZXdWZXJzaW9uOiBuZXdWZXJzaW9uLmZvcm1hdCgpLFxuICAgIH07XG5cbiAgICB0cnkge1xuICAgICAgLy8gTm90ZTogTm8gcHJvZ3Jlc3MgaW5kaWNhdG9yIG5lZWRlZCBhcyB0aGF0IGlzIGV4cGVjdGVkIHRvIGJlIGEgZmFzdCBvcGVyYXRpb24uIEFsc29cbiAgICAgIC8vIHdlIGV4cGVjdCB0aGUgY29tbWFuZCB0byBoYW5kbGUgY29uc29sZSBtZXNzYWdpbmcgYW5kIHdvdWxkbid0IHdhbnQgdG8gY2xvYmJlciBpdC5cbiAgICAgIC8vIFRPRE86IGRldGVjdCB5YXJuIGJlcnJ5IGFuZCBoYW5kbGUgZmxhZyBkaWZmZXJlbmNlcyBwcm9wZXJseS5cbiAgICAgIGF3YWl0IENoaWxkUHJvY2Vzcy5zcGF3bihcbiAgICAgICAgeWFybkNvbW1hbmQuYmluYXJ5LFxuICAgICAgICBbLi4ueWFybkNvbW1hbmQuYXJncywgJ25nLWRldicsICdyZWxlYXNlJywgJ3ByZWNoZWNrJ10sXG4gICAgICAgIHtcbiAgICAgICAgICBjd2Q6IHByb2plY3REaXIsXG4gICAgICAgICAgLy8gTm90ZTogV2UgcGFzcyB0aGUgcHJlY2hlY2sgaW5mb3JtYXRpb24gdG8gdGhlIGNvbW1hbmQgdGhyb3VnaCBgc3RkaW5gXG4gICAgICAgICAgLy8gYmVjYXVzZSBjb21tYW5kIGxpbmUgYXJndW1lbnRzIGFyZSBsZXNzIHJlbGlhYmxlIGFuZCBoYXZlIGxlbmd0aCBsaW1pdHMuXG4gICAgICAgICAgaW5wdXQ6IEpTT04uc3RyaW5naWZ5KHByZWNoZWNrU3RkaW4pLFxuICAgICAgICB9LFxuICAgICAgKTtcbiAgICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIEV4ZWN1dGVkIHJlbGVhc2UgcHJlLWNoZWNrcyBmb3IgJHtuZXdWZXJzaW9ufWApKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBUaGUgYHNwYXduYCBpbnZvY2F0aW9uIGFscmVhZHkgcHJpbnRzIGFsbCBzdGRvdXQvc3RkZXJyLCBzbyB3ZSBkb24ndCBuZWVkIHJlLXByaW50LlxuICAgICAgLy8gVG8gZWFzZSBkZWJ1Z2dpbmcgaW4gY2FzZSBvZiBydW50aW1lIGV4Y2VwdGlvbnMsIHdlIHN0aWxsIHByaW50IHRoZSBlcnJvciB0byBgZGVidWdgLlxuICAgICAgTG9nLmRlYnVnKGUpO1xuICAgICAgTG9nLmVycm9yKGAgIOKcmCAgIEFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHJ1bm5pbmcgcmVsZWFzZSBwcmUtY2hlY2tzLmApO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEludm9rZXMgdGhlIGB5YXJuIGluc3RhbGxgIGNvbW1hbmQgaW4gb3JkZXIgdG8gaW5zdGFsbCBkZXBlbmRlbmNpZXMgZm9yXG4gICAqIHRoZSBjb25maWd1cmVkIHByb2plY3Qgd2l0aCB0aGUgY3VycmVudGx5IGNoZWNrZWQgb3V0IHJldmlzaW9uLlxuICAgKi9cbiAgc3RhdGljIGFzeW5jIGludm9rZVlhcm5JbnN0YWxsKHByb2plY3REaXI6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIE5vdGU6IFdlIGNhbm5vdCB1c2UgYHlhcm5gIGRpcmVjdGx5IGFzIGNvbW1hbmQgYmVjYXVzZSB3ZSBtaWdodCBvcGVyYXRlIGluXG4gICAgLy8gYSBkaWZmZXJlbnQgcHVibGlzaCBicmFuY2ggYW5kIHRoZSBjdXJyZW50IGBQQVRIYCB3aWxsIHBvaW50IHRvIHRoZSBZYXJuIHZlcnNpb25cbiAgICAvLyB0aGF0IGludm9rZWQgdGhlIHJlbGVhc2UgdG9vbC4gTW9yZSBkZXRhaWxzIGluIHRoZSBmdW5jdGlvbiBkZXNjcmlwdGlvbi5cbiAgICBjb25zdCB5YXJuQ29tbWFuZCA9IGF3YWl0IHJlc29sdmVZYXJuU2NyaXB0Rm9yUHJvamVjdChwcm9qZWN0RGlyKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyBOb3RlOiBObyBwcm9ncmVzcyBpbmRpY2F0b3IgbmVlZGVkIGFzIHRoYXQgaXMgdGhlIHJlc3BvbnNpYmlsaXR5IG9mIHRoZSBjb21tYW5kLlxuICAgICAgLy8gVE9ETzogQ29uc2lkZXIgdXNpbmcgYW4gT3JhIHNwaW5uZXIgaW5zdGVhZCB0byBlbnN1cmUgbWluaW1hbCBjb25zb2xlIG91dHB1dC5cbiAgICAgIGF3YWl0IENoaWxkUHJvY2Vzcy5zcGF3bihcbiAgICAgICAgeWFybkNvbW1hbmQuYmluYXJ5LFxuICAgICAgICBbXG4gICAgICAgICAgLi4ueWFybkNvbW1hbmQuYXJncyxcbiAgICAgICAgICAnaW5zdGFsbCcsXG4gICAgICAgICAgLi4uKHlhcm5Db21tYW5kLmxlZ2FjeSA/IFsnLS1mcm96ZW4tbG9ja2ZpbGUnLCAnLS1ub24taW50ZXJhY3RpdmUnXSA6IFsnLS1pbW11dGFibGUnXSksXG4gICAgICAgIF0sXG4gICAgICAgIHtjd2Q6IHByb2plY3REaXJ9LFxuICAgICAgKTtcbiAgICAgIExvZy5pbmZvKGdyZWVuKCcgIOKckyAgIEluc3RhbGxlZCBwcm9qZWN0IGRlcGVuZGVuY2llcy4nKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgTG9nLmVycm9yKGUpO1xuICAgICAgTG9nLmVycm9yKCcgIOKcmCAgIEFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGluc3RhbGxpbmcgZGVwZW5kZW5jaWVzLicpO1xuICAgICAgdGhyb3cgbmV3IEZhdGFsUmVsZWFzZUFjdGlvbkVycm9yKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEludm9rZXMgdGhlIGB5YXJuIGJhemVsIHJ1biBAbnBtMi8vOnN5bmNgIGNvbW1hbmQgaW4gb3JkZXJcbiAgICogdG8gcmVmcmVzaCBBc3BlY3QgbG9jayBmaWxlcy5cbiAgICovXG4gIHN0YXRpYyBhc3luYyBpbnZva2VCYXplbFVwZGF0ZUFzcGVjdExvY2tGaWxlcyhwcm9qZWN0RGlyOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgLy8gTm90ZTogTm8gcHJvZ3Jlc3MgaW5kaWNhdG9yIG5lZWRlZCBhcyB0aGF0IGlzIHRoZSByZXNwb25zaWJpbGl0eSBvZiB0aGUgY29tbWFuZC5cbiAgICAgIC8vIFRPRE86IENvbnNpZGVyIHVzaW5nIGFuIE9yYSBzcGlubmVyIGluc3RlYWQgdG8gZW5zdXJlIG1pbmltYWwgY29uc29sZSBvdXRwdXQuXG4gICAgICBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oZ2V0QmF6ZWxCaW4oKSwgWydydW4nLCAnQG5wbTIvLzpzeW5jJ10sIHtjd2Q6IHByb2plY3REaXJ9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBOb3RlOiBHcmFjZWZ1bGx5IGhhbmRsaW5nIHRoZXNlIGVycm9ycyBiZWNhdXNlIGBzeW5jYCBjb21tYW5kXG4gICAgICAvLyBhbHdheSBleGl0cyB3aXRoIGEgbm9uLXplcm8gZXhpdCBjb2RlLlxuICAgIH1cblxuICAgIExvZy5pbmZvKGdyZWVuKCcgIOKckyAgIFVwZGF0ZWQgQXNwZWN0IGBydWxlc19qc2AgbG9jayBmaWxlcy4nKSk7XG4gIH1cbn1cbiJdfQ==