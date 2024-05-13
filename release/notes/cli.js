/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import semver from 'semver';
import { Log } from '../../utils/logging.js';
import { ReleaseNotes } from './release-notes.js';
import { GitClient } from '../../utils/git/git-client.js';
/** Yargs command builder for configuring the `ng-dev release build` command. */
function builder(argv) {
    return argv
        .option('releaseVersion', {
        type: 'string',
        default: '0.0.0',
        coerce: (version) => new semver.SemVer(version),
    })
        .option('from', {
        type: 'string',
        description: 'The git tag or ref to start the changelog entry from',
        demandOption: true,
    })
        .option('to', {
        type: 'string',
        description: 'The git tag or ref to end the changelog entry with',
        default: 'HEAD',
    })
        .option('type', {
        type: 'string',
        description: 'The type of release notes to create',
        choices: ['github-release', 'changelog'],
        default: 'changelog',
    })
        .option('prependToChangelog', {
        type: 'boolean',
        default: false,
        description: 'Whether to update the changelog with the newly created entry',
    });
}
/** Yargs command handler for generating release notes. */
async function handler({ releaseVersion, from, to, prependToChangelog, type }) {
    /** Git client to use for generating the release notes. */
    const git = await GitClient.get();
    /** The ReleaseNotes instance to generate release notes. */
    const releaseNotes = await ReleaseNotes.forRange(git, releaseVersion, from, to);
    if (prependToChangelog) {
        await releaseNotes.prependEntryToChangelogFile();
        Log.info(`Added release notes for "${releaseVersion}" to the changelog`);
        return;
    }
    /** The requested release notes entry. */
    const releaseNotesEntry = type === 'changelog'
        ? await releaseNotes.getChangelogEntry()
        : await releaseNotes.getGithubReleaseEntry();
    process.stdout.write(releaseNotesEntry);
}
/** CLI command module for generating release notes. */
export const ReleaseNotesCommandModule = {
    builder,
    handler,
    command: 'notes',
    describe: 'Generate release notes',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3JlbGVhc2Uvbm90ZXMvY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUNILE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUc1QixPQUFPLEVBQUMsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFM0MsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQ2hELE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQVd4RCxnRkFBZ0Y7QUFDaEYsU0FBUyxPQUFPLENBQUMsSUFBVTtJQUN6QixPQUFPLElBQUk7U0FDUixNQUFNLENBQUMsZ0JBQWdCLEVBQUU7UUFDeEIsSUFBSSxFQUFFLFFBQVE7UUFDZCxPQUFPLEVBQUUsT0FBTztRQUNoQixNQUFNLEVBQUUsQ0FBQyxPQUFlLEVBQUUsRUFBRSxDQUFDLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7S0FDeEQsQ0FBQztTQUNELE1BQU0sQ0FBQyxNQUFNLEVBQUU7UUFDZCxJQUFJLEVBQUUsUUFBUTtRQUNkLFdBQVcsRUFBRSxzREFBc0Q7UUFDbkUsWUFBWSxFQUFFLElBQUk7S0FDbkIsQ0FBQztTQUNELE1BQU0sQ0FBQyxJQUFJLEVBQUU7UUFDWixJQUFJLEVBQUUsUUFBUTtRQUNkLFdBQVcsRUFBRSxvREFBb0Q7UUFDakUsT0FBTyxFQUFFLE1BQU07S0FDaEIsQ0FBQztTQUNELE1BQU0sQ0FBQyxNQUFNLEVBQUU7UUFDZCxJQUFJLEVBQUUsUUFBUTtRQUNkLFdBQVcsRUFBRSxxQ0FBcUM7UUFDbEQsT0FBTyxFQUFFLENBQUMsZ0JBQWdCLEVBQUUsV0FBVyxDQUFVO1FBQ2pELE9BQU8sRUFBRSxXQUFvQjtLQUM5QixDQUFDO1NBQ0QsTUFBTSxDQUFDLG9CQUFvQixFQUFFO1FBQzVCLElBQUksRUFBRSxTQUFTO1FBQ2YsT0FBTyxFQUFFLEtBQUs7UUFDZCxXQUFXLEVBQUUsOERBQThEO0tBQzVFLENBQUMsQ0FBQztBQUNQLENBQUM7QUFFRCwwREFBMEQ7QUFDMUQsS0FBSyxVQUFVLE9BQU8sQ0FBQyxFQUFDLGNBQWMsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLGtCQUFrQixFQUFFLElBQUksRUFBcUI7SUFDN0YsMERBQTBEO0lBQzFELE1BQU0sR0FBRyxHQUFHLE1BQU0sU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ2xDLDJEQUEyRDtJQUMzRCxNQUFNLFlBQVksR0FBRyxNQUFNLFlBQVksQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFFaEYsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO1FBQ3ZCLE1BQU0sWUFBWSxDQUFDLDJCQUEyQixFQUFFLENBQUM7UUFDakQsR0FBRyxDQUFDLElBQUksQ0FBQyw0QkFBNEIsY0FBYyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ3pFLE9BQU87SUFDVCxDQUFDO0lBRUQseUNBQXlDO0lBQ3pDLE1BQU0saUJBQWlCLEdBQ3JCLElBQUksS0FBSyxXQUFXO1FBQ2xCLENBQUMsQ0FBQyxNQUFNLFlBQVksQ0FBQyxpQkFBaUIsRUFBRTtRQUN4QyxDQUFDLENBQUMsTUFBTSxZQUFZLENBQUMscUJBQXFCLEVBQUUsQ0FBQztJQUVqRCxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQzFDLENBQUM7QUFFRCx1REFBdUQ7QUFDdkQsTUFBTSxDQUFDLE1BQU0seUJBQXlCLEdBQStCO0lBQ25FLE9BQU87SUFDUCxPQUFPO0lBQ1AsT0FBTyxFQUFFLE9BQU87SUFDaEIsUUFBUSxFQUFFLHdCQUF3QjtDQUNuQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XG5pbXBvcnQge0FyZ3YsIEFyZ3VtZW50cywgQ29tbWFuZE1vZHVsZX0gZnJvbSAneWFyZ3MnO1xuXG5pbXBvcnQge0xvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5cbmltcG9ydCB7UmVsZWFzZU5vdGVzfSBmcm9tICcuL3JlbGVhc2Utbm90ZXMuanMnO1xuaW1wb3J0IHtHaXRDbGllbnR9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9naXQtY2xpZW50LmpzJztcblxuLyoqIENvbW1hbmQgbGluZSBvcHRpb25zIGZvciBidWlsZGluZyBhIHJlbGVhc2UuICovXG5leHBvcnQgaW50ZXJmYWNlIE9wdGlvbnMge1xuICBmcm9tOiBzdHJpbmc7XG4gIHRvOiBzdHJpbmc7XG4gIHByZXBlbmRUb0NoYW5nZWxvZzogYm9vbGVhbjtcbiAgcmVsZWFzZVZlcnNpb246IHNlbXZlci5TZW1WZXI7XG4gIHR5cGU6ICdnaXRodWItcmVsZWFzZScgfCAnY2hhbmdlbG9nJztcbn1cblxuLyoqIFlhcmdzIGNvbW1hbmQgYnVpbGRlciBmb3IgY29uZmlndXJpbmcgdGhlIGBuZy1kZXYgcmVsZWFzZSBidWlsZGAgY29tbWFuZC4gKi9cbmZ1bmN0aW9uIGJ1aWxkZXIoYXJndjogQXJndik6IEFyZ3Y8T3B0aW9ucz4ge1xuICByZXR1cm4gYXJndlxuICAgIC5vcHRpb24oJ3JlbGVhc2VWZXJzaW9uJywge1xuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICBkZWZhdWx0OiAnMC4wLjAnLFxuICAgICAgY29lcmNlOiAodmVyc2lvbjogc3RyaW5nKSA9PiBuZXcgc2VtdmVyLlNlbVZlcih2ZXJzaW9uKSxcbiAgICB9KVxuICAgIC5vcHRpb24oJ2Zyb20nLCB7XG4gICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVGhlIGdpdCB0YWcgb3IgcmVmIHRvIHN0YXJ0IHRoZSBjaGFuZ2Vsb2cgZW50cnkgZnJvbScsXG4gICAgICBkZW1hbmRPcHRpb246IHRydWUsXG4gICAgfSlcbiAgICAub3B0aW9uKCd0bycsIHtcbiAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgZGVzY3JpcHRpb246ICdUaGUgZ2l0IHRhZyBvciByZWYgdG8gZW5kIHRoZSBjaGFuZ2Vsb2cgZW50cnkgd2l0aCcsXG4gICAgICBkZWZhdWx0OiAnSEVBRCcsXG4gICAgfSlcbiAgICAub3B0aW9uKCd0eXBlJywge1xuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RoZSB0eXBlIG9mIHJlbGVhc2Ugbm90ZXMgdG8gY3JlYXRlJyxcbiAgICAgIGNob2ljZXM6IFsnZ2l0aHViLXJlbGVhc2UnLCAnY2hhbmdlbG9nJ10gYXMgY29uc3QsXG4gICAgICBkZWZhdWx0OiAnY2hhbmdlbG9nJyBhcyBjb25zdCxcbiAgICB9KVxuICAgIC5vcHRpb24oJ3ByZXBlbmRUb0NoYW5nZWxvZycsIHtcbiAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgIGRlZmF1bHQ6IGZhbHNlLFxuICAgICAgZGVzY3JpcHRpb246ICdXaGV0aGVyIHRvIHVwZGF0ZSB0aGUgY2hhbmdlbG9nIHdpdGggdGhlIG5ld2x5IGNyZWF0ZWQgZW50cnknLFxuICAgIH0pO1xufVxuXG4vKiogWWFyZ3MgY29tbWFuZCBoYW5kbGVyIGZvciBnZW5lcmF0aW5nIHJlbGVhc2Ugbm90ZXMuICovXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVyKHtyZWxlYXNlVmVyc2lvbiwgZnJvbSwgdG8sIHByZXBlbmRUb0NoYW5nZWxvZywgdHlwZX06IEFyZ3VtZW50czxPcHRpb25zPikge1xuICAvKiogR2l0IGNsaWVudCB0byB1c2UgZm9yIGdlbmVyYXRpbmcgdGhlIHJlbGVhc2Ugbm90ZXMuICovXG4gIGNvbnN0IGdpdCA9IGF3YWl0IEdpdENsaWVudC5nZXQoKTtcbiAgLyoqIFRoZSBSZWxlYXNlTm90ZXMgaW5zdGFuY2UgdG8gZ2VuZXJhdGUgcmVsZWFzZSBub3Rlcy4gKi9cbiAgY29uc3QgcmVsZWFzZU5vdGVzID0gYXdhaXQgUmVsZWFzZU5vdGVzLmZvclJhbmdlKGdpdCwgcmVsZWFzZVZlcnNpb24sIGZyb20sIHRvKTtcblxuICBpZiAocHJlcGVuZFRvQ2hhbmdlbG9nKSB7XG4gICAgYXdhaXQgcmVsZWFzZU5vdGVzLnByZXBlbmRFbnRyeVRvQ2hhbmdlbG9nRmlsZSgpO1xuICAgIExvZy5pbmZvKGBBZGRlZCByZWxlYXNlIG5vdGVzIGZvciBcIiR7cmVsZWFzZVZlcnNpb259XCIgdG8gdGhlIGNoYW5nZWxvZ2ApO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8qKiBUaGUgcmVxdWVzdGVkIHJlbGVhc2Ugbm90ZXMgZW50cnkuICovXG4gIGNvbnN0IHJlbGVhc2VOb3Rlc0VudHJ5ID1cbiAgICB0eXBlID09PSAnY2hhbmdlbG9nJ1xuICAgICAgPyBhd2FpdCByZWxlYXNlTm90ZXMuZ2V0Q2hhbmdlbG9nRW50cnkoKVxuICAgICAgOiBhd2FpdCByZWxlYXNlTm90ZXMuZ2V0R2l0aHViUmVsZWFzZUVudHJ5KCk7XG5cbiAgcHJvY2Vzcy5zdGRvdXQud3JpdGUocmVsZWFzZU5vdGVzRW50cnkpO1xufVxuXG4vKiogQ0xJIGNvbW1hbmQgbW9kdWxlIGZvciBnZW5lcmF0aW5nIHJlbGVhc2Ugbm90ZXMuICovXG5leHBvcnQgY29uc3QgUmVsZWFzZU5vdGVzQ29tbWFuZE1vZHVsZTogQ29tbWFuZE1vZHVsZTx7fSwgT3B0aW9ucz4gPSB7XG4gIGJ1aWxkZXIsXG4gIGhhbmRsZXIsXG4gIGNvbW1hbmQ6ICdub3RlcycsXG4gIGRlc2NyaWJlOiAnR2VuZXJhdGUgcmVsZWFzZSBub3RlcycsXG59O1xuIl19