/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { debug } from 'console';
import { green, Log } from '../../utils/logging.js';
/**
 * Error class that can be used to report precheck failures. Messaging with
 * respect to the pre-check error is required to be handled manually.
 */
export class ReleasePrecheckError extends Error {
}
/**
 * Runs the release prechecks and checks whether they are passing for the
 * specified release config, intended new version and built release packages.
 *
 * @returns A boolean that indicates whether the prechecks are passing or not.
 */
export async function assertPassingReleasePrechecks(config, newVersion, builtPackagesWithInfo) {
    if (config.prereleaseCheck === undefined) {
        Log.warn('  ⚠   Skipping release pre-checks. No checks configured.');
        return true;
    }
    // The user-defined release precheck function is supposed to throw errors upon unmet
    // checks. We catch this here and print a better message and determine the status.
    try {
        // Note: We do not pass the `SemVer` instance to the user-customizable precheck
        // function. This is because we bundled our version of `semver` and the version
        // used in the precheck logic might be different, causing unexpected issues.
        await config.prereleaseCheck(newVersion.format(), builtPackagesWithInfo);
        Log.info(green('  ✓   Release pre-checks passing.'));
        return true;
    }
    catch (e) {
        if (e instanceof ReleasePrecheckError) {
            // Note: Error messaging is expected to be handled manually.
            debug(e.message);
            Log.error(`  ✘   Release pre-checks failed. Please check the output above.`);
        }
        else {
            Log.error(e, '\n');
            Log.error(`  ✘   Release pre-checks errored with unexpected runtime error.`);
        }
        return false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9wcmVjaGVjay9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsS0FBSyxFQUFDLE1BQU0sU0FBUyxDQUFDO0FBRTlCLE9BQU8sRUFBQyxLQUFLLEVBQUUsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFHbEQ7OztHQUdHO0FBQ0gsTUFBTSxPQUFPLG9CQUFxQixTQUFRLEtBQUs7Q0FBRztBQUVsRDs7Ozs7R0FLRztBQUNILE1BQU0sQ0FBQyxLQUFLLFVBQVUsNkJBQTZCLENBQ2pELE1BQXFCLEVBQ3JCLFVBQXdCLEVBQ3hCLHFCQUE2QztJQUU3QyxJQUFJLE1BQU0sQ0FBQyxlQUFlLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDekMsR0FBRyxDQUFDLElBQUksQ0FBQywwREFBMEQsQ0FBQyxDQUFDO1FBQ3JFLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELG9GQUFvRjtJQUNwRixrRkFBa0Y7SUFDbEYsSUFBSSxDQUFDO1FBQ0gsK0VBQStFO1FBQy9FLCtFQUErRTtRQUMvRSw0RUFBNEU7UUFDNUUsTUFBTSxNQUFNLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO1FBQ3pFLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxDQUFDLENBQUMsQ0FBQztRQUNyRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQ1gsSUFBSSxDQUFDLFlBQVksb0JBQW9CLEVBQUUsQ0FBQztZQUN0Qyw0REFBNEQ7WUFDNUQsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNqQixHQUFHLENBQUMsS0FBSyxDQUFDLGlFQUFpRSxDQUFDLENBQUM7UUFDL0UsQ0FBQzthQUFNLENBQUM7WUFDTixHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNuQixHQUFHLENBQUMsS0FBSyxDQUFDLGlFQUFpRSxDQUFDLENBQUM7UUFDL0UsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtkZWJ1Z30gZnJvbSAnY29uc29sZSc7XG5pbXBvcnQgeWFyZ3MgZnJvbSAnc2VtdmVyJztcbmltcG9ydCB7Z3JlZW4sIExvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge0J1aWx0UGFja2FnZVdpdGhJbmZvLCBSZWxlYXNlQ29uZmlnfSBmcm9tICcuLi9jb25maWcvaW5kZXguanMnO1xuXG4vKipcbiAqIEVycm9yIGNsYXNzIHRoYXQgY2FuIGJlIHVzZWQgdG8gcmVwb3J0IHByZWNoZWNrIGZhaWx1cmVzLiBNZXNzYWdpbmcgd2l0aFxuICogcmVzcGVjdCB0byB0aGUgcHJlLWNoZWNrIGVycm9yIGlzIHJlcXVpcmVkIHRvIGJlIGhhbmRsZWQgbWFudWFsbHkuXG4gKi9cbmV4cG9ydCBjbGFzcyBSZWxlYXNlUHJlY2hlY2tFcnJvciBleHRlbmRzIEVycm9yIHt9XG5cbi8qKlxuICogUnVucyB0aGUgcmVsZWFzZSBwcmVjaGVja3MgYW5kIGNoZWNrcyB3aGV0aGVyIHRoZXkgYXJlIHBhc3NpbmcgZm9yIHRoZVxuICogc3BlY2lmaWVkIHJlbGVhc2UgY29uZmlnLCBpbnRlbmRlZCBuZXcgdmVyc2lvbiBhbmQgYnVpbHQgcmVsZWFzZSBwYWNrYWdlcy5cbiAqXG4gKiBAcmV0dXJucyBBIGJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgd2hldGhlciB0aGUgcHJlY2hlY2tzIGFyZSBwYXNzaW5nIG9yIG5vdC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFzc2VydFBhc3NpbmdSZWxlYXNlUHJlY2hlY2tzKFxuICBjb25maWc6IFJlbGVhc2VDb25maWcsXG4gIG5ld1ZlcnNpb246IHlhcmdzLlNlbVZlcixcbiAgYnVpbHRQYWNrYWdlc1dpdGhJbmZvOiBCdWlsdFBhY2thZ2VXaXRoSW5mb1tdLFxuKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGlmIChjb25maWcucHJlcmVsZWFzZUNoZWNrID09PSB1bmRlZmluZWQpIHtcbiAgICBMb2cud2FybignICDimqAgICBTa2lwcGluZyByZWxlYXNlIHByZS1jaGVja3MuIE5vIGNoZWNrcyBjb25maWd1cmVkLicpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gVGhlIHVzZXItZGVmaW5lZCByZWxlYXNlIHByZWNoZWNrIGZ1bmN0aW9uIGlzIHN1cHBvc2VkIHRvIHRocm93IGVycm9ycyB1cG9uIHVubWV0XG4gIC8vIGNoZWNrcy4gV2UgY2F0Y2ggdGhpcyBoZXJlIGFuZCBwcmludCBhIGJldHRlciBtZXNzYWdlIGFuZCBkZXRlcm1pbmUgdGhlIHN0YXR1cy5cbiAgdHJ5IHtcbiAgICAvLyBOb3RlOiBXZSBkbyBub3QgcGFzcyB0aGUgYFNlbVZlcmAgaW5zdGFuY2UgdG8gdGhlIHVzZXItY3VzdG9taXphYmxlIHByZWNoZWNrXG4gICAgLy8gZnVuY3Rpb24uIFRoaXMgaXMgYmVjYXVzZSB3ZSBidW5kbGVkIG91ciB2ZXJzaW9uIG9mIGBzZW12ZXJgIGFuZCB0aGUgdmVyc2lvblxuICAgIC8vIHVzZWQgaW4gdGhlIHByZWNoZWNrIGxvZ2ljIG1pZ2h0IGJlIGRpZmZlcmVudCwgY2F1c2luZyB1bmV4cGVjdGVkIGlzc3Vlcy5cbiAgICBhd2FpdCBjb25maWcucHJlcmVsZWFzZUNoZWNrKG5ld1ZlcnNpb24uZm9ybWF0KCksIGJ1aWx0UGFja2FnZXNXaXRoSW5mbyk7XG4gICAgTG9nLmluZm8oZ3JlZW4oJyAg4pyTICAgUmVsZWFzZSBwcmUtY2hlY2tzIHBhc3NpbmcuJykpO1xuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKGUgaW5zdGFuY2VvZiBSZWxlYXNlUHJlY2hlY2tFcnJvcikge1xuICAgICAgLy8gTm90ZTogRXJyb3IgbWVzc2FnaW5nIGlzIGV4cGVjdGVkIHRvIGJlIGhhbmRsZWQgbWFudWFsbHkuXG4gICAgICBkZWJ1ZyhlLm1lc3NhZ2UpO1xuICAgICAgTG9nLmVycm9yKGAgIOKcmCAgIFJlbGVhc2UgcHJlLWNoZWNrcyBmYWlsZWQuIFBsZWFzZSBjaGVjayB0aGUgb3V0cHV0IGFib3ZlLmApO1xuICAgIH0gZWxzZSB7XG4gICAgICBMb2cuZXJyb3IoZSwgJ1xcbicpO1xuICAgICAgTG9nLmVycm9yKGAgIOKcmCAgIFJlbGVhc2UgcHJlLWNoZWNrcyBlcnJvcmVkIHdpdGggdW5leHBlY3RlZCBydW50aW1lIGVycm9yLmApO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuIl19