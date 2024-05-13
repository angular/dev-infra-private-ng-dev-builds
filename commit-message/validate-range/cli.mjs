/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Log } from '../../utils/logging.js';
import { validateCommitRange } from './validate-range.js';
/** Builds the command. */
function builder(argv) {
    return argv
        .positional('startingRef', {
        description: 'The first ref in the range to select',
        type: 'string',
        demandOption: true,
    })
        .positional('endingRef', {
        description: 'The last ref in the range to select',
        type: 'string',
        default: 'HEAD',
    });
}
/** Handles the command. */
async function handler({ startingRef, endingRef }) {
    // If on CI, and no pull request number is provided, assume the branch
    // being run on is an upstream branch.
    if (process.env['CI'] && process.env['CI_PULL_REQUEST'] === 'false') {
        Log.info(`Since valid commit messages are enforced by PR linting on CI, we do not`);
        Log.info(`need to validate commit messages on CI runs on upstream branches.`);
        Log.info();
        Log.info(`Skipping check of provided commit range`);
        return;
    }
    await validateCommitRange(startingRef, endingRef);
}
/** yargs command module describing the command. */
export const ValidateRangeModule = {
    handler,
    builder,
    command: 'validate-range <starting-ref> [ending-ref]',
    describe: 'Validate a range of commit messages',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L2NvbW1pdC1tZXNzYWdlL3ZhbGlkYXRlLXJhbmdlL2NsaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFJSCxPQUFPLEVBQUMsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFM0MsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFPeEQsMEJBQTBCO0FBQzFCLFNBQVMsT0FBTyxDQUFDLElBQVU7SUFDekIsT0FBTyxJQUFJO1NBQ1IsVUFBVSxDQUFDLGFBQWEsRUFBRTtRQUN6QixXQUFXLEVBQUUsc0NBQXNDO1FBQ25ELElBQUksRUFBRSxRQUFRO1FBQ2QsWUFBWSxFQUFFLElBQUk7S0FDbkIsQ0FBQztTQUNELFVBQVUsQ0FBQyxXQUFXLEVBQUU7UUFDdkIsV0FBVyxFQUFFLHFDQUFxQztRQUNsRCxJQUFJLEVBQUUsUUFBUTtRQUNkLE9BQU8sRUFBRSxNQUFNO0tBQ2hCLENBQUMsQ0FBQztBQUNQLENBQUM7QUFFRCwyQkFBMkI7QUFDM0IsS0FBSyxVQUFVLE9BQU8sQ0FBQyxFQUFDLFdBQVcsRUFBRSxTQUFTLEVBQWtDO0lBQzlFLHNFQUFzRTtJQUN0RSxzQ0FBc0M7SUFDdEMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsS0FBSyxPQUFPLEVBQUUsQ0FBQztRQUNwRSxHQUFHLENBQUMsSUFBSSxDQUFDLHlFQUF5RSxDQUFDLENBQUM7UUFDcEYsR0FBRyxDQUFDLElBQUksQ0FBQyxtRUFBbUUsQ0FBQyxDQUFDO1FBQzlFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNYLEdBQUcsQ0FBQyxJQUFJLENBQUMseUNBQXlDLENBQUMsQ0FBQztRQUNwRCxPQUFPO0lBQ1QsQ0FBQztJQUNELE1BQU0sbUJBQW1CLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQ3BELENBQUM7QUFFRCxtREFBbUQ7QUFDbkQsTUFBTSxDQUFDLE1BQU0sbUJBQW1CLEdBQTRDO0lBQzFFLE9BQU87SUFDUCxPQUFPO0lBQ1AsT0FBTyxFQUFFLDRDQUE0QztJQUNyRCxRQUFRLEVBQUUscUNBQXFDO0NBQ2hELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBcmd2LCBBcmd1bWVudHMsIENvbW1hbmRNb2R1bGV9IGZyb20gJ3lhcmdzJztcblxuaW1wb3J0IHtMb2d9IGZyb20gJy4uLy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuXG5pbXBvcnQge3ZhbGlkYXRlQ29tbWl0UmFuZ2V9IGZyb20gJy4vdmFsaWRhdGUtcmFuZ2UuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZhbGlkYXRlUmFuZ2VPcHRpb25zIHtcbiAgc3RhcnRpbmdSZWY6IHN0cmluZztcbiAgZW5kaW5nUmVmOiBzdHJpbmc7XG59XG5cbi8qKiBCdWlsZHMgdGhlIGNvbW1hbmQuICovXG5mdW5jdGlvbiBidWlsZGVyKGFyZ3Y6IEFyZ3YpIHtcbiAgcmV0dXJuIGFyZ3ZcbiAgICAucG9zaXRpb25hbCgnc3RhcnRpbmdSZWYnLCB7XG4gICAgICBkZXNjcmlwdGlvbjogJ1RoZSBmaXJzdCByZWYgaW4gdGhlIHJhbmdlIHRvIHNlbGVjdCcsXG4gICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgIGRlbWFuZE9wdGlvbjogdHJ1ZSxcbiAgICB9KVxuICAgIC5wb3NpdGlvbmFsKCdlbmRpbmdSZWYnLCB7XG4gICAgICBkZXNjcmlwdGlvbjogJ1RoZSBsYXN0IHJlZiBpbiB0aGUgcmFuZ2UgdG8gc2VsZWN0JyxcbiAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgZGVmYXVsdDogJ0hFQUQnLFxuICAgIH0pO1xufVxuXG4vKiogSGFuZGxlcyB0aGUgY29tbWFuZC4gKi9cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIoe3N0YXJ0aW5nUmVmLCBlbmRpbmdSZWZ9OiBBcmd1bWVudHM8VmFsaWRhdGVSYW5nZU9wdGlvbnM+KSB7XG4gIC8vIElmIG9uIENJLCBhbmQgbm8gcHVsbCByZXF1ZXN0IG51bWJlciBpcyBwcm92aWRlZCwgYXNzdW1lIHRoZSBicmFuY2hcbiAgLy8gYmVpbmcgcnVuIG9uIGlzIGFuIHVwc3RyZWFtIGJyYW5jaC5cbiAgaWYgKHByb2Nlc3MuZW52WydDSSddICYmIHByb2Nlc3MuZW52WydDSV9QVUxMX1JFUVVFU1QnXSA9PT0gJ2ZhbHNlJykge1xuICAgIExvZy5pbmZvKGBTaW5jZSB2YWxpZCBjb21taXQgbWVzc2FnZXMgYXJlIGVuZm9yY2VkIGJ5IFBSIGxpbnRpbmcgb24gQ0ksIHdlIGRvIG5vdGApO1xuICAgIExvZy5pbmZvKGBuZWVkIHRvIHZhbGlkYXRlIGNvbW1pdCBtZXNzYWdlcyBvbiBDSSBydW5zIG9uIHVwc3RyZWFtIGJyYW5jaGVzLmApO1xuICAgIExvZy5pbmZvKCk7XG4gICAgTG9nLmluZm8oYFNraXBwaW5nIGNoZWNrIG9mIHByb3ZpZGVkIGNvbW1pdCByYW5nZWApO1xuICAgIHJldHVybjtcbiAgfVxuICBhd2FpdCB2YWxpZGF0ZUNvbW1pdFJhbmdlKHN0YXJ0aW5nUmVmLCBlbmRpbmdSZWYpO1xufVxuXG4vKiogeWFyZ3MgY29tbWFuZCBtb2R1bGUgZGVzY3JpYmluZyB0aGUgY29tbWFuZC4gKi9cbmV4cG9ydCBjb25zdCBWYWxpZGF0ZVJhbmdlTW9kdWxlOiBDb21tYW5kTW9kdWxlPHt9LCBWYWxpZGF0ZVJhbmdlT3B0aW9ucz4gPSB7XG4gIGhhbmRsZXIsXG4gIGJ1aWxkZXIsXG4gIGNvbW1hbmQ6ICd2YWxpZGF0ZS1yYW5nZSA8c3RhcnRpbmctcmVmPiBbZW5kaW5nLXJlZl0nLFxuICBkZXNjcmliZTogJ1ZhbGlkYXRlIGEgcmFuZ2Ugb2YgY29tbWl0IG1lc3NhZ2VzJyxcbn07XG4iXX0=