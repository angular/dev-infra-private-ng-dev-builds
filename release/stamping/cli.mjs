/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import path from 'path';
import url from 'url';
import { printEnvStamp } from './env-stamp.js';
function builder(args) {
    return args
        .option('mode', {
        demandOption: true,
        description: 'Whether the env-stamp should be built for a snapshot or release',
        choices: ['snapshot', 'release'],
    })
        .option('includeVersion', {
        type: 'boolean',
        description: 'Whether the version should be included in the stamp.',
        default: true,
    })
        .option('additionalStampingScript', {
        type: 'string',
        description: 'Working-dir relative or absolute path to an ESM script which can ' +
            'print additional stamping variables',
    });
}
async function handler({ mode, includeVersion, additionalStampingScript }) {
    await printEnvStamp(mode, includeVersion);
    // Support for additional stamping. We import the script and call the default
    // function while providing the stamping mode.
    if (additionalStampingScript !== undefined) {
        const scriptURL = url.pathToFileURL(path.resolve(additionalStampingScript));
        const stampingExports = (await import(scriptURL.toString()));
        await stampingExports.default(mode);
    }
}
/** CLI command module for building the environment stamp. */
export const BuildEnvStampCommand = {
    builder,
    handler,
    command: 'build-env-stamp',
    describe: 'Build the environment stamping information',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3JlbGVhc2Uvc3RhbXBpbmcvY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sSUFBSSxNQUFNLE1BQU0sQ0FBQztBQUN4QixPQUFPLEdBQUcsTUFBTSxLQUFLLENBQUM7QUFHdEIsT0FBTyxFQUFDLGFBQWEsRUFBZSxNQUFNLGdCQUFnQixDQUFDO0FBYzNELFNBQVMsT0FBTyxDQUFDLElBQVU7SUFDekIsT0FBTyxJQUFJO1NBQ1IsTUFBTSxDQUFDLE1BQU0sRUFBRTtRQUNkLFlBQVksRUFBRSxJQUFJO1FBQ2xCLFdBQVcsRUFBRSxpRUFBaUU7UUFDOUUsT0FBTyxFQUFFLENBQUMsVUFBbUIsRUFBRSxTQUFrQixDQUFDO0tBQ25ELENBQUM7U0FDRCxNQUFNLENBQUMsZ0JBQWdCLEVBQUU7UUFDeEIsSUFBSSxFQUFFLFNBQVM7UUFDZixXQUFXLEVBQUUsc0RBQXNEO1FBQ25FLE9BQU8sRUFBRSxJQUFJO0tBQ2QsQ0FBQztTQUNELE1BQU0sQ0FBQywwQkFBMEIsRUFBRTtRQUNsQyxJQUFJLEVBQUUsUUFBUTtRQUNkLFdBQVcsRUFDVCxtRUFBbUU7WUFDbkUscUNBQXFDO0tBQ3hDLENBQUMsQ0FBQztBQUNQLENBQUM7QUFFRCxLQUFLLFVBQVUsT0FBTyxDQUFDLEVBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRSx3QkFBd0IsRUFBcUI7SUFDekYsTUFBTSxhQUFhLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBRTFDLDZFQUE2RTtJQUM3RSw4Q0FBOEM7SUFDOUMsSUFBSSx3QkFBd0IsS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUMzQyxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDO1FBQzVFLE1BQU0sZUFBZSxHQUFHLENBQUMsTUFBTSxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBRTFELENBQUM7UUFDRixNQUFNLGVBQWUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdEMsQ0FBQztBQUNILENBQUM7QUFFRCw2REFBNkQ7QUFDN0QsTUFBTSxDQUFDLE1BQU0sb0JBQW9CLEdBQStCO0lBQzlELE9BQU87SUFDUCxPQUFPO0lBQ1AsT0FBTyxFQUFFLGlCQUFpQjtJQUMxQixRQUFRLEVBQUUsNENBQTRDO0NBQ3ZELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdXJsIGZyb20gJ3VybCc7XG5pbXBvcnQge0FyZ3YsIEFyZ3VtZW50cywgQ29tbWFuZE1vZHVsZX0gZnJvbSAneWFyZ3MnO1xuXG5pbXBvcnQge3ByaW50RW52U3RhbXAsIEVudlN0YW1wTW9kZX0gZnJvbSAnLi9lbnYtc3RhbXAuanMnO1xuXG4vKipcbiAqIFR5cGUgZGVzY3JpYmluZyBhIGN1c3RvbSBzdGFtcGluZyBmdW5jdGlvbiB0aGF0XG4gKiBjYW4gYmUgZXhwb3NlZCB0aHJvdWdoIHRoZSBgLS1hZGRpdGlvbmFsLXN0YW1waW5nLXNjcmlwdGAuXG4gKi9cbmV4cG9ydCB0eXBlIEVudlN0YW1wQ3VzdG9tUHJpbnRGbiA9IChtb2RlOiBFbnZTdGFtcE1vZGUpID0+IFByb21pc2U8dm9pZD47XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3B0aW9ucyB7XG4gIG1vZGU6IEVudlN0YW1wTW9kZTtcbiAgaW5jbHVkZVZlcnNpb246IGJvb2xlYW47XG4gIGFkZGl0aW9uYWxTdGFtcGluZ1NjcmlwdDogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBidWlsZGVyKGFyZ3M6IEFyZ3YpOiBBcmd2PE9wdGlvbnM+IHtcbiAgcmV0dXJuIGFyZ3NcbiAgICAub3B0aW9uKCdtb2RlJywge1xuICAgICAgZGVtYW5kT3B0aW9uOiB0cnVlLFxuICAgICAgZGVzY3JpcHRpb246ICdXaGV0aGVyIHRoZSBlbnYtc3RhbXAgc2hvdWxkIGJlIGJ1aWx0IGZvciBhIHNuYXBzaG90IG9yIHJlbGVhc2UnLFxuICAgICAgY2hvaWNlczogWydzbmFwc2hvdCcgYXMgY29uc3QsICdyZWxlYXNlJyBhcyBjb25zdF0sXG4gICAgfSlcbiAgICAub3B0aW9uKCdpbmNsdWRlVmVyc2lvbicsIHtcbiAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2hldGhlciB0aGUgdmVyc2lvbiBzaG91bGQgYmUgaW5jbHVkZWQgaW4gdGhlIHN0YW1wLicsXG4gICAgICBkZWZhdWx0OiB0cnVlLFxuICAgIH0pXG4gICAgLm9wdGlvbignYWRkaXRpb25hbFN0YW1waW5nU2NyaXB0Jywge1xuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgJ1dvcmtpbmctZGlyIHJlbGF0aXZlIG9yIGFic29sdXRlIHBhdGggdG8gYW4gRVNNIHNjcmlwdCB3aGljaCBjYW4gJyArXG4gICAgICAgICdwcmludCBhZGRpdGlvbmFsIHN0YW1waW5nIHZhcmlhYmxlcycsXG4gICAgfSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIoe21vZGUsIGluY2x1ZGVWZXJzaW9uLCBhZGRpdGlvbmFsU3RhbXBpbmdTY3JpcHR9OiBBcmd1bWVudHM8T3B0aW9ucz4pIHtcbiAgYXdhaXQgcHJpbnRFbnZTdGFtcChtb2RlLCBpbmNsdWRlVmVyc2lvbik7XG5cbiAgLy8gU3VwcG9ydCBmb3IgYWRkaXRpb25hbCBzdGFtcGluZy4gV2UgaW1wb3J0IHRoZSBzY3JpcHQgYW5kIGNhbGwgdGhlIGRlZmF1bHRcbiAgLy8gZnVuY3Rpb24gd2hpbGUgcHJvdmlkaW5nIHRoZSBzdGFtcGluZyBtb2RlLlxuICBpZiAoYWRkaXRpb25hbFN0YW1waW5nU2NyaXB0ICE9PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBzY3JpcHRVUkwgPSB1cmwucGF0aFRvRmlsZVVSTChwYXRoLnJlc29sdmUoYWRkaXRpb25hbFN0YW1waW5nU2NyaXB0KSk7XG4gICAgY29uc3Qgc3RhbXBpbmdFeHBvcnRzID0gKGF3YWl0IGltcG9ydChzY3JpcHRVUkwudG9TdHJpbmcoKSkpIGFzIHtcbiAgICAgIGRlZmF1bHQ6IEVudlN0YW1wQ3VzdG9tUHJpbnRGbjtcbiAgICB9O1xuICAgIGF3YWl0IHN0YW1waW5nRXhwb3J0cy5kZWZhdWx0KG1vZGUpO1xuICB9XG59XG5cbi8qKiBDTEkgY29tbWFuZCBtb2R1bGUgZm9yIGJ1aWxkaW5nIHRoZSBlbnZpcm9ubWVudCBzdGFtcC4gKi9cbmV4cG9ydCBjb25zdCBCdWlsZEVudlN0YW1wQ29tbWFuZDogQ29tbWFuZE1vZHVsZTx7fSwgT3B0aW9ucz4gPSB7XG4gIGJ1aWxkZXIsXG4gIGhhbmRsZXIsXG4gIGNvbW1hbmQ6ICdidWlsZC1lbnYtc3RhbXAnLFxuICBkZXNjcmliZTogJ0J1aWxkIHRoZSBlbnZpcm9ubWVudCBzdGFtcGluZyBpbmZvcm1hdGlvbicsXG59O1xuIl19