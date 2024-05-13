/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Log, green, red } from '../../utils/logging.js';
import { determineRepoBaseDirFromCwd } from '../../utils/repo-directory.js';
import { checkAllLicenses } from './validate.js';
/** Yargs command builder for the command. */
function builder(argv) {
    return argv;
}
/** Yargs command handler for the command. */
async function handler({}) {
    try {
        const { valid, maxPkgNameLength, packages } = await checkAllLicenses(determineRepoBaseDirFromCwd());
        if (valid) {
            Log.info(`  ${green('✓')}  All discovered licenses comply with our restrictions (${packages.length} packages)`);
            return;
        }
        Log.info(red(' ✘ The following packages were found to have disallowed licenses:\n'));
        Log.info(`${'     Package Name'.padEnd(maxPkgNameLength)}     |      LICENSE`);
        packages
            .filter((pkg) => !pkg.allowed)
            .forEach((pkg) => {
            Log.info(`  - ${pkg.name.padEnd(maxPkgNameLength)} | ${pkg.licenses}`);
        });
        process.exitCode = 1;
    }
    catch (err) {
        Log.info(red(' ✘ An error occured while processing package licenses:'));
        Log.error(err);
        process.exitCode = 1;
    }
}
/** CLI command module. */
export const ValidateLicensesModule = {
    builder,
    handler,
    command: 'validate-licenses',
    describe: 'Validate the licenses for all dependencies in the project',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L21pc2MvdmFsaWRhdGUtbGljZW5zZXMvY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQ3ZELE9BQU8sRUFBQywyQkFBMkIsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBRTFFLE9BQU8sRUFBQyxnQkFBZ0IsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUsvQyw2Q0FBNkM7QUFDN0MsU0FBUyxPQUFPLENBQUMsSUFBVTtJQUN6QixPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCw2Q0FBNkM7QUFDN0MsS0FBSyxVQUFVLE9BQU8sQ0FBQyxFQUFzQjtJQUMzQyxJQUFJLENBQUM7UUFDSCxNQUFNLEVBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLFFBQVEsRUFBQyxHQUFHLE1BQU0sZ0JBQWdCLENBQ2hFLDJCQUEyQixFQUFFLENBQzlCLENBQUM7UUFDRixJQUFJLEtBQUssRUFBRSxDQUFDO1lBQ1YsR0FBRyxDQUFDLElBQUksQ0FDTixLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUMsMkRBQ2IsUUFBUSxDQUFDLE1BQ1gsWUFBWSxDQUNiLENBQUM7WUFDRixPQUFPO1FBQ1QsQ0FBQztRQUVELEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHFFQUFxRSxDQUFDLENBQUMsQ0FBQztRQUNyRixHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsbUJBQW1CLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDL0UsUUFBUTthQUNMLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDO2FBQzdCLE9BQU8sQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQ2YsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDekUsQ0FBQyxDQUFDLENBQUM7UUFDTCxPQUFPLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQztJQUN2QixDQUFDO0lBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUNiLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHdEQUF3RCxDQUFDLENBQUMsQ0FBQztRQUN4RSxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2YsT0FBTyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7SUFDdkIsQ0FBQztBQUNILENBQUM7QUFFRCwwQkFBMEI7QUFDMUIsTUFBTSxDQUFDLE1BQU0sc0JBQXNCLEdBQStCO0lBQ2hFLE9BQU87SUFDUCxPQUFPO0lBQ1AsT0FBTyxFQUFFLG1CQUFtQjtJQUM1QixRQUFRLEVBQUUsMkRBQTJEO0NBQ3RFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtBcmd2LCBBcmd1bWVudHMsIENvbW1hbmRNb2R1bGV9IGZyb20gJ3lhcmdzJztcbmltcG9ydCB7TG9nLCBncmVlbiwgcmVkfSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7ZGV0ZXJtaW5lUmVwb0Jhc2VEaXJGcm9tQ3dkfSBmcm9tICcuLi8uLi91dGlscy9yZXBvLWRpcmVjdG9yeS5qcyc7XG5cbmltcG9ydCB7Y2hlY2tBbGxMaWNlbnNlc30gZnJvbSAnLi92YWxpZGF0ZS5qcyc7XG5cbi8qKiBDb21tYW5kIGxpbmUgb3B0aW9ucy4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgT3B0aW9ucyB7fVxuXG4vKiogWWFyZ3MgY29tbWFuZCBidWlsZGVyIGZvciB0aGUgY29tbWFuZC4gKi9cbmZ1bmN0aW9uIGJ1aWxkZXIoYXJndjogQXJndik6IEFyZ3Y8T3B0aW9ucz4ge1xuICByZXR1cm4gYXJndjtcbn1cblxuLyoqIFlhcmdzIGNvbW1hbmQgaGFuZGxlciBmb3IgdGhlIGNvbW1hbmQuICovXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVyKHt9OiBBcmd1bWVudHM8T3B0aW9ucz4pIHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7dmFsaWQsIG1heFBrZ05hbWVMZW5ndGgsIHBhY2thZ2VzfSA9IGF3YWl0IGNoZWNrQWxsTGljZW5zZXMoXG4gICAgICBkZXRlcm1pbmVSZXBvQmFzZURpckZyb21Dd2QoKSxcbiAgICApO1xuICAgIGlmICh2YWxpZCkge1xuICAgICAgTG9nLmluZm8oXG4gICAgICAgIGAgICR7Z3JlZW4oJ+KckycpfSAgQWxsIGRpc2NvdmVyZWQgbGljZW5zZXMgY29tcGx5IHdpdGggb3VyIHJlc3RyaWN0aW9ucyAoJHtcbiAgICAgICAgICBwYWNrYWdlcy5sZW5ndGhcbiAgICAgICAgfSBwYWNrYWdlcylgLFxuICAgICAgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBMb2cuaW5mbyhyZWQoJyDinJggVGhlIGZvbGxvd2luZyBwYWNrYWdlcyB3ZXJlIGZvdW5kIHRvIGhhdmUgZGlzYWxsb3dlZCBsaWNlbnNlczpcXG4nKSk7XG4gICAgTG9nLmluZm8oYCR7JyAgICAgUGFja2FnZSBOYW1lJy5wYWRFbmQobWF4UGtnTmFtZUxlbmd0aCl9ICAgICB8ICAgICAgTElDRU5TRWApO1xuICAgIHBhY2thZ2VzXG4gICAgICAuZmlsdGVyKChwa2cpID0+ICFwa2cuYWxsb3dlZClcbiAgICAgIC5mb3JFYWNoKChwa2cpID0+IHtcbiAgICAgICAgTG9nLmluZm8oYCAgLSAke3BrZy5uYW1lLnBhZEVuZChtYXhQa2dOYW1lTGVuZ3RoKX0gfCAke3BrZy5saWNlbnNlc31gKTtcbiAgICAgIH0pO1xuICAgIHByb2Nlc3MuZXhpdENvZGUgPSAxO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBMb2cuaW5mbyhyZWQoJyDinJggQW4gZXJyb3Igb2NjdXJlZCB3aGlsZSBwcm9jZXNzaW5nIHBhY2thZ2UgbGljZW5zZXM6JykpO1xuICAgIExvZy5lcnJvcihlcnIpO1xuICAgIHByb2Nlc3MuZXhpdENvZGUgPSAxO1xuICB9XG59XG5cbi8qKiBDTEkgY29tbWFuZCBtb2R1bGUuICovXG5leHBvcnQgY29uc3QgVmFsaWRhdGVMaWNlbnNlc01vZHVsZTogQ29tbWFuZE1vZHVsZTx7fSwgT3B0aW9ucz4gPSB7XG4gIGJ1aWxkZXIsXG4gIGhhbmRsZXIsXG4gIGNvbW1hbmQ6ICd2YWxpZGF0ZS1saWNlbnNlcycsXG4gIGRlc2NyaWJlOiAnVmFsaWRhdGUgdGhlIGxpY2Vuc2VzIGZvciBhbGwgZGVwZW5kZW5jaWVzIGluIHRoZSBwcm9qZWN0Jyxcbn07XG4iXX0=