/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// ---- **IMPORTANT** ----
// This command is part of our external commands invoked by the release publish
// command. Before making changes, keep in mind that more recent `ng-dev` versions
// can still invoke this command.
// ------------------------
import semver from 'semver';
import { getConfig } from '../../../utils/config.js';
import { Log, bold, green } from '../../../utils/logging.js';
import { Spinner } from '../../../utils/spinner.js';
import { assertValidReleaseConfig } from '../../config/index.js';
import { NpmCommand } from '../../versioning/npm-command.js';
import { createExperimentalSemver, isExperimentalSemver, } from '../../versioning/experimental-versions.js';
function builder(args) {
    return args
        .positional('tagName', {
        type: 'string',
        demandOption: true,
        description: 'Name of the NPM dist tag.',
    })
        .positional('targetVersion', {
        type: 'string',
        demandOption: true,
        description: 'Version to which the NPM dist tag should be set.\nThis version will be ' +
            'converted to an experimental version for experimental packages.',
    })
        .option('skipExperimentalPackages', {
        type: 'boolean',
        description: 'Whether the dist tag should not be set for experimental NPM packages.',
        default: false,
    });
}
/** Yargs command handler for setting an NPM dist tag. */
async function handler(args) {
    const { targetVersion: rawVersion, tagName, skipExperimentalPackages } = args;
    const config = await getConfig();
    assertValidReleaseConfig(config);
    const { npmPackages, publishRegistry } = config.release;
    const version = semver.parse(rawVersion);
    if (version === null) {
        Log.error(`Invalid version specified (${rawVersion}). Unable to set NPM dist tag.`);
        process.exit(1);
    }
    else if (isExperimentalSemver(version)) {
        Log.error(`Unexpected experimental SemVer version specified. This command expects a ` +
            `non-experimental project SemVer version.`);
        process.exit(1);
    }
    Log.debug(`Setting "${tagName}" NPM dist tag for release packages to v${version}.`);
    const spinner = new Spinner('');
    for (const pkg of npmPackages) {
        // If `--skip-experimental-packages` is specified, all NPM packages which
        // are marked as experimental will not receive the NPM dist tag update.
        if (pkg.experimental && skipExperimentalPackages) {
            spinner.update(`Skipping "${pkg.name}" due to it being experimental.`);
            continue;
        }
        spinner.update(`Setting NPM dist tag for "${pkg.name}"`);
        const distTagVersion = pkg.experimental ? createExperimentalSemver(version) : version;
        try {
            await NpmCommand.setDistTagForPackage(pkg.name, tagName, distTagVersion, publishRegistry);
            Log.debug(`Successfully set "${tagName}" NPM dist tag for "${pkg.name}".`);
        }
        catch (e) {
            spinner.complete();
            Log.error(e);
            Log.error(`  ✘   An error occurred while setting the NPM dist tag for "${pkg.name}".`);
            process.exit(1);
        }
    }
    spinner.complete();
    Log.info(green(`  ✓   Set NPM dist tag for all release packages.`));
    Log.info(green(`      ${bold(tagName)} will now point to ${bold(`v${version}`)}.`));
}
/** CLI command module for setting an NPM dist tag. */
export const ReleaseNpmDistTagSetCommand = {
    builder,
    handler,
    command: 'set <tag-name> <target-version>',
    describe: 'Sets a given NPM dist tag for all release packages.',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3JlbGVhc2UvbnBtLWRpc3QtdGFnL3NldC9jbGkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsMEJBQTBCO0FBQzFCLCtFQUErRTtBQUMvRSxrRkFBa0Y7QUFDbEYsaUNBQWlDO0FBQ2pDLDJCQUEyQjtBQUUzQixPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFFNUIsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBRW5ELE9BQU8sRUFBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBQzNELE9BQU8sRUFBQyxPQUFPLEVBQUMsTUFBTSwyQkFBMkIsQ0FBQztBQUNsRCxPQUFPLEVBQUMsd0JBQXdCLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUMvRCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0saUNBQWlDLENBQUM7QUFDM0QsT0FBTyxFQUNMLHdCQUF3QixFQUN4QixvQkFBb0IsR0FDckIsTUFBTSwyQ0FBMkMsQ0FBQztBQVNuRCxTQUFTLE9BQU8sQ0FBQyxJQUFVO0lBQ3pCLE9BQU8sSUFBSTtTQUNSLFVBQVUsQ0FBQyxTQUFTLEVBQUU7UUFDckIsSUFBSSxFQUFFLFFBQVE7UUFDZCxZQUFZLEVBQUUsSUFBSTtRQUNsQixXQUFXLEVBQUUsMkJBQTJCO0tBQ3pDLENBQUM7U0FDRCxVQUFVLENBQUMsZUFBZSxFQUFFO1FBQzNCLElBQUksRUFBRSxRQUFRO1FBQ2QsWUFBWSxFQUFFLElBQUk7UUFDbEIsV0FBVyxFQUNULHlFQUF5RTtZQUN6RSxpRUFBaUU7S0FDcEUsQ0FBQztTQUNELE1BQU0sQ0FBQywwQkFBMEIsRUFBRTtRQUNsQyxJQUFJLEVBQUUsU0FBUztRQUNmLFdBQVcsRUFBRSx1RUFBdUU7UUFDcEYsT0FBTyxFQUFFLEtBQUs7S0FDZixD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aUNBQWlDO0lBQzFDLFFBQVEsRUFBRSxxREFBcUQ7Q0FDaEUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vLyAtLS0tICoqSU1QT1JUQU5UKiogLS0tLVxuLy8gVGhpcyBjb21tYW5kIGlzIHBhcnQgb2Ygb3VyIGV4dGVybmFsIGNvbW1hbmRzIGludm9rZWQgYnkgdGhlIHJlbGVhc2UgcHVibGlzaFxuLy8gY29tbWFuZC4gQmVmb3JlIG1ha2luZyBjaGFuZ2VzLCBrZWVwIGluIG1pbmQgdGhhdCBtb3JlIHJlY2VudCBgbmctZGV2YCB2ZXJzaW9uc1xuLy8gY2FuIHN0aWxsIGludm9rZSB0aGlzIGNvbW1hbmQuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xuaW1wb3J0IHtBcmd2LCBBcmd1bWVudHMsIENvbW1hbmRNb2R1bGV9IGZyb20gJ3lhcmdzJztcbmltcG9ydCB7Z2V0Q29uZmlnfSBmcm9tICcuLi8uLi8uLi91dGlscy9jb25maWcuanMnO1xuXG5pbXBvcnQge0xvZywgYm9sZCwgZ3JlZW59IGZyb20gJy4uLy4uLy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuaW1wb3J0IHtTcGlubmVyfSBmcm9tICcuLi8uLi8uLi91dGlscy9zcGlubmVyLmpzJztcbmltcG9ydCB7YXNzZXJ0VmFsaWRSZWxlYXNlQ29uZmlnfSBmcm9tICcuLi8uLi9jb25maWcvaW5kZXguanMnO1xuaW1wb3J0IHtOcG1Db21tYW5kfSBmcm9tICcuLi8uLi92ZXJzaW9uaW5nL25wbS1jb21tYW5kLmpzJztcbmltcG9ydCB7XG4gIGNyZWF0ZUV4cGVyaW1lbnRhbFNlbXZlcixcbiAgaXNFeHBlcmltZW50YWxTZW12ZXIsXG59IGZyb20gJy4uLy4uL3ZlcnNpb25pbmcvZXhwZXJpbWVudGFsLXZlcnNpb25zLmpzJztcblxuLyoqIENvbW1hbmQgbGluZSBvcHRpb25zIGZvciBzZXR0aW5nIGFuIE5QTSBkaXN0IHRhZy4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmVsZWFzZU5wbURpc3RUYWdTZXRPcHRpb25zIHtcbiAgdGFnTmFtZTogc3RyaW5nO1xuICB0YXJnZXRWZXJzaW9uOiBzdHJpbmc7XG4gIHNraXBFeHBlcmltZW50YWxQYWNrYWdlczogYm9vbGVhbjtcbn1cblxuZnVuY3Rpb24gYnVpbGRlcihhcmdzOiBBcmd2KTogQXJndjxSZWxlYXNlTnBtRGlzdFRhZ1NldE9wdGlvbnM+IHtcbiAgcmV0dXJuIGFyZ3NcbiAgICAucG9zaXRpb25hbCgndGFnTmFtZScsIHtcbiAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgZGVtYW5kT3B0aW9uOiB0cnVlLFxuICAgICAgZGVzY3JpcHRpb246ICdOYW1lIG9mIHRoZSBOUE0gZGlzdCB0YWcuJyxcbiAgICB9KVxuICAgIC5wb3NpdGlvbmFsKCd0YXJnZXRWZXJzaW9uJywge1xuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICBkZW1hbmRPcHRpb246IHRydWUsXG4gICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgJ1ZlcnNpb24gdG8gd2hpY2ggdGhlIE5QTSBkaXN0IHRhZyBzaG91bGQgYmUgc2V0LlxcblRoaXMgdmVyc2lvbiB3aWxsIGJlICcgK1xuICAgICAgICAnY29udmVydGVkIHRvIGFuIGV4cGVyaW1lbnRhbCB2ZXJzaW9uIGZvciBleHBlcmltZW50YWwgcGFja2FnZXMuJyxcbiAgICB9KVxuICAgIC5vcHRpb24oJ3NraXBFeHBlcmltZW50YWxQYWNrYWdlcycsIHtcbiAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2hldGhlciB0aGUgZGlzdCB0YWcgc2hvdWxkIG5vdCBiZSBzZXQgZm9yIGV4cGVyaW1lbnRhbCBOUE0gcGFja2FnZXMuJyxcbiAgICAgIGRlZmF1bHQ6IGZhbHNlLFxuICAgIH0pO1xufVxuXG4vKiogWWFyZ3MgY29tbWFuZCBoYW5kbGVyIGZvciBzZXR0aW5nIGFuIE5QTSBkaXN0IHRhZy4gKi9cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIoYXJnczogQXJndW1lbnRzPFJlbGVhc2VOcG1EaXN0VGFnU2V0T3B0aW9ucz4pIHtcbiAgY29uc3Qge3RhcmdldFZlcnNpb246IHJhd1ZlcnNpb24sIHRhZ05hbWUsIHNraXBFeHBlcmltZW50YWxQYWNrYWdlc30gPSBhcmdzO1xuICBjb25zdCBjb25maWcgPSBhd2FpdCBnZXRDb25maWcoKTtcbiAgYXNzZXJ0VmFsaWRSZWxlYXNlQ29uZmlnKGNvbmZpZyk7XG4gIGNvbnN0IHtucG1QYWNrYWdlcywgcHVibGlzaFJlZ2lzdHJ5fSA9IGNvbmZpZy5yZWxlYXNlO1xuICBjb25zdCB2ZXJzaW9uID0gc2VtdmVyLnBhcnNlKHJhd1ZlcnNpb24pO1xuXG4gIGlmICh2ZXJzaW9uID09PSBudWxsKSB7XG4gICAgTG9nLmVycm9yKGBJbnZhbGlkIHZlcnNpb24gc3BlY2lmaWVkICgke3Jhd1ZlcnNpb259KS4gVW5hYmxlIHRvIHNldCBOUE0gZGlzdCB0YWcuYCk7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xuICB9IGVsc2UgaWYgKGlzRXhwZXJpbWVudGFsU2VtdmVyKHZlcnNpb24pKSB7XG4gICAgTG9nLmVycm9yKFxuICAgICAgYFVuZXhwZWN0ZWQgZXhwZXJpbWVudGFsIFNlbVZlciB2ZXJzaW9uIHNwZWNpZmllZC4gVGhpcyBjb21tYW5kIGV4cGVjdHMgYSBgICtcbiAgICAgICAgYG5vbi1leHBlcmltZW50YWwgcHJvamVjdCBTZW1WZXIgdmVyc2lvbi5gLFxuICAgICk7XG4gICAgcHJvY2Vzcy5leGl0KDEpO1xuICB9XG5cbiAgTG9nLmRlYnVnKGBTZXR0aW5nIFwiJHt0YWdOYW1lfVwiIE5QTSBkaXN0IHRhZyBmb3IgcmVsZWFzZSBwYWNrYWdlcyB0byB2JHt2ZXJzaW9ufS5gKTtcbiAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKCcnKTtcblxuICBmb3IgKGNvbnN0IHBrZyBvZiBucG1QYWNrYWdlcykge1xuICAgIC8vIElmIGAtLXNraXAtZXhwZXJpbWVudGFsLXBhY2thZ2VzYCBpcyBzcGVjaWZpZWQsIGFsbCBOUE0gcGFja2FnZXMgd2hpY2hcbiAgICAvLyBhcmUgbWFya2VkIGFzIGV4cGVyaW1lbnRhbCB3aWxsIG5vdCByZWNlaXZlIHRoZSBOUE0gZGlzdCB0YWcgdXBkYXRlLlxuICAgIGlmIChwa2cuZXhwZXJpbWVudGFsICYmIHNraXBFeHBlcmltZW50YWxQYWNrYWdlcykge1xuICAgICAgc3Bpbm5lci51cGRhdGUoYFNraXBwaW5nIFwiJHtwa2cubmFtZX1cIiBkdWUgdG8gaXQgYmVpbmcgZXhwZXJpbWVudGFsLmApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgc3Bpbm5lci51cGRhdGUoYFNldHRpbmcgTlBNIGRpc3QgdGFnIGZvciBcIiR7cGtnLm5hbWV9XCJgKTtcbiAgICBjb25zdCBkaXN0VGFnVmVyc2lvbiA9IHBrZy5leHBlcmltZW50YWwgPyBjcmVhdGVFeHBlcmltZW50YWxTZW12ZXIodmVyc2lvbiEpIDogdmVyc2lvbiE7XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgTnBtQ29tbWFuZC5zZXREaXN0VGFnRm9yUGFja2FnZShwa2cubmFtZSwgdGFnTmFtZSwgZGlzdFRhZ1ZlcnNpb24sIHB1Ymxpc2hSZWdpc3RyeSk7XG4gICAgICBMb2cuZGVidWcoYFN1Y2Nlc3NmdWxseSBzZXQgXCIke3RhZ05hbWV9XCIgTlBNIGRpc3QgdGFnIGZvciBcIiR7cGtnLm5hbWV9XCIuYCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgc3Bpbm5lci5jb21wbGV0ZSgpO1xuICAgICAgTG9nLmVycm9yKGUpO1xuICAgICAgTG9nLmVycm9yKGAgIOKcmCAgIEFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHNldHRpbmcgdGhlIE5QTSBkaXN0IHRhZyBmb3IgXCIke3BrZy5uYW1lfVwiLmApO1xuICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgIH1cbiAgfVxuXG4gIHNwaW5uZXIuY29tcGxldGUoKTtcbiAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgU2V0IE5QTSBkaXN0IHRhZyBmb3IgYWxsIHJlbGVhc2UgcGFja2FnZXMuYCkpO1xuICBMb2cuaW5mbyhncmVlbihgICAgICAgJHtib2xkKHRhZ05hbWUpfSB3aWxsIG5vdyBwb2ludCB0byAke2JvbGQoYHYke3ZlcnNpb259YCl9LmApKTtcbn1cblxuLyoqIENMSSBjb21tYW5kIG1vZHVsZSBmb3Igc2V0dGluZyBhbiBOUE0gZGlzdCB0YWcuICovXG5leHBvcnQgY29uc3QgUmVsZWFzZU5wbURpc3RUYWdTZXRDb21tYW5kOiBDb21tYW5kTW9kdWxlPHt9LCBSZWxlYXNlTnBtRGlzdFRhZ1NldE9wdGlvbnM+ID0ge1xuICBidWlsZGVyLFxuICBoYW5kbGVyLFxuICBjb21tYW5kOiAnc2V0IDx0YWctbmFtZT4gPHRhcmdldC12ZXJzaW9uPicsXG4gIGRlc2NyaWJlOiAnU2V0cyBhIGdpdmVuIE5QTSBkaXN0IHRhZyBmb3IgYWxsIHJlbGVhc2UgcGFja2FnZXMuJyxcbn07XG4iXX0=