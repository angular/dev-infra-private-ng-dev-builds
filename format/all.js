/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { GitClient } from '../utils/git/git-client.js';
import { checkFiles, formatFiles } from './format.js';
/** Yargs command builder for the command. */
function builder(argv) {
    return argv.option('check', {
        type: 'boolean',
        default: process.env['CI'] ? true : false,
        description: 'Run the formatter to check formatting rather than updating code format',
    });
}
/** Yargs command handler for the command. */
async function handler({ check }) {
    const git = await GitClient.get();
    const executionCmd = check ? checkFiles : formatFiles;
    const allFiles = git.allFiles();
    process.exitCode = await executionCmd(allFiles);
}
/** CLI command module. */
export const AllFilesModule = {
    builder,
    handler,
    command: 'all',
    describe: 'Run the formatter on all files in the repository',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbmctZGV2L2Zvcm1hdC9hbGwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBSUgsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLDRCQUE0QixDQUFDO0FBQ3JELE9BQU8sRUFBQyxVQUFVLEVBQUUsV0FBVyxFQUFDLE1BQU0sYUFBYSxDQUFDO0FBT3BELDZDQUE2QztBQUM3QyxTQUFTLE9BQU8sQ0FBQyxJQUFVO0lBQ3pCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7UUFDMUIsSUFBSSxFQUFFLFNBQVM7UUFDZixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLO1FBQ3pDLFdBQVcsRUFBRSx3RUFBd0U7S0FDdEYsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELDZDQUE2QztBQUM3QyxLQUFLLFVBQVUsT0FBTyxDQUFDLEVBQUMsS0FBSyxFQUFxQjtJQUNoRCxNQUFNLEdBQUcsR0FBRyxNQUFNLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUNsQyxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDO0lBQ3RELE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNoQyxPQUFPLENBQUMsUUFBUSxHQUFHLE1BQU0sWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ2xELENBQUM7QUFFRCwwQkFBMEI7QUFDMUIsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUErQjtJQUN4RCxPQUFPO0lBQ1AsT0FBTztJQUNQLE9BQU8sRUFBRSxLQUFLO0lBQ2QsUUFBUSxFQUFFLGtEQUFrRDtDQUM3RCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QXJndiwgQXJndW1lbnRzLCBDb21tYW5kTW9kdWxlfSBmcm9tICd5YXJncyc7XG5cbmltcG9ydCB7R2l0Q2xpZW50fSBmcm9tICcuLi91dGlscy9naXQvZ2l0LWNsaWVudC5qcyc7XG5pbXBvcnQge2NoZWNrRmlsZXMsIGZvcm1hdEZpbGVzfSBmcm9tICcuL2Zvcm1hdC5qcyc7XG5cbi8qKiBDb21tYW5kIGxpbmUgb3B0aW9ucy4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgT3B0aW9ucyB7XG4gIGNoZWNrOiBib29sZWFuO1xufVxuXG4vKiogWWFyZ3MgY29tbWFuZCBidWlsZGVyIGZvciB0aGUgY29tbWFuZC4gKi9cbmZ1bmN0aW9uIGJ1aWxkZXIoYXJndjogQXJndik6IEFyZ3Y8T3B0aW9ucz4ge1xuICByZXR1cm4gYXJndi5vcHRpb24oJ2NoZWNrJywge1xuICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICBkZWZhdWx0OiBwcm9jZXNzLmVudlsnQ0knXSA/IHRydWUgOiBmYWxzZSxcbiAgICBkZXNjcmlwdGlvbjogJ1J1biB0aGUgZm9ybWF0dGVyIHRvIGNoZWNrIGZvcm1hdHRpbmcgcmF0aGVyIHRoYW4gdXBkYXRpbmcgY29kZSBmb3JtYXQnLFxuICB9KTtcbn1cblxuLyoqIFlhcmdzIGNvbW1hbmQgaGFuZGxlciBmb3IgdGhlIGNvbW1hbmQuICovXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVyKHtjaGVja306IEFyZ3VtZW50czxPcHRpb25zPikge1xuICBjb25zdCBnaXQgPSBhd2FpdCBHaXRDbGllbnQuZ2V0KCk7XG4gIGNvbnN0IGV4ZWN1dGlvbkNtZCA9IGNoZWNrID8gY2hlY2tGaWxlcyA6IGZvcm1hdEZpbGVzO1xuICBjb25zdCBhbGxGaWxlcyA9IGdpdC5hbGxGaWxlcygpO1xuICBwcm9jZXNzLmV4aXRDb2RlID0gYXdhaXQgZXhlY3V0aW9uQ21kKGFsbEZpbGVzKTtcbn1cblxuLyoqIENMSSBjb21tYW5kIG1vZHVsZS4gKi9cbmV4cG9ydCBjb25zdCBBbGxGaWxlc01vZHVsZTogQ29tbWFuZE1vZHVsZTx7fSwgT3B0aW9ucz4gPSB7XG4gIGJ1aWxkZXIsXG4gIGhhbmRsZXIsXG4gIGNvbW1hbmQ6ICdhbGwnLFxuICBkZXNjcmliZTogJ1J1biB0aGUgZm9ybWF0dGVyIG9uIGFsbCBmaWxlcyBpbiB0aGUgcmVwb3NpdG9yeScsXG59O1xuIl19