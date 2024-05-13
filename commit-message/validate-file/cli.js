/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { getUserConfig } from '../../utils/config.js';
import { validateFile } from './validate-file.js';
/** Builds the command. */
function builder(argv) {
    return argv
        .option('file', {
        type: 'string',
        conflicts: ['file-env-variable'],
        description: 'The path of the commit message file.',
    })
        .option('file-env-variable', {
        type: 'string',
        conflicts: ['file'],
        description: 'The key of the environment variable for the path of the commit message file.',
        coerce: (arg) => {
            if (arg === undefined) {
                return arg;
            }
            const file = process.env[arg];
            if (!file) {
                throw new Error(`Provided environment variable "${arg}" was not found.`);
            }
            return file;
        },
    })
        .option('error', {
        type: 'boolean',
        description: 'Whether invalid commit messages should be treated as failures rather than a warning',
        default: null,
        defaultDescription: '`True` on CI or can be enabled through ng-dev user-config.',
    });
}
/** Handles the command. */
async function handler({ error, file, fileEnvVariable }) {
    const isErrorMode = error === null ? await getIsErrorModeDefault() : error;
    const filePath = file || fileEnvVariable || '.git/COMMIT_EDITMSG';
    await validateFile(filePath, isErrorMode);
}
async function getIsErrorModeDefault() {
    return !!process.env['CI'] || !!(await getUserConfig()).commitMessage?.errorOnInvalidMessage;
}
/** yargs command module describing the command. */
export const ValidateFileModule = {
    handler,
    builder,
    command: 'pre-commit-validate',
    describe: 'Validate the most recent commit message',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L2NvbW1pdC1tZXNzYWdlL3ZhbGlkYXRlLWZpbGUvY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUVwRCxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFRaEQsMEJBQTBCO0FBQzFCLFNBQVMsT0FBTyxDQUFDLElBQVU7SUFDekIsT0FBTyxJQUFJO1NBQ1IsTUFBTSxDQUFDLE1BQU0sRUFBRTtRQUNkLElBQUksRUFBRSxRQUFRO1FBQ2QsU0FBUyxFQUFFLENBQUMsbUJBQW1CLENBQUM7UUFDaEMsV0FBVyxFQUFFLHNDQUFzQztLQUNwRCxDQUFDO1NBQ0QsTUFBTSxDQUFDLG1CQUF3QyxFQUFFO1FBQ2hELElBQUksRUFBRSxRQUFRO1FBQ2QsU0FBUyxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQ25CLFdBQVcsRUFBRSw4RUFBOEU7UUFDM0YsTUFBTSxFQUFFLENBQUMsR0FBdUIsRUFBRSxFQUFFO1lBQ2xDLElBQUksR0FBRyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUN0QixPQUFPLEdBQUcsQ0FBQztZQUNiLENBQUM7WUFDRCxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzlCLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDVixNQUFNLElBQUksS0FBSyxDQUFDLGtDQUFrQyxHQUFHLGtCQUFrQixDQUFDLENBQUM7WUFDM0UsQ0FBQztZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztLQUNGLENBQUM7U0FDRCxNQUFNLENBQUMsT0FBTyxFQUFFO1FBQ2YsSUFBSSxFQUFFLFNBQVM7UUFDZixXQUFXLEVBQ1QscUZBQXFGO1FBQ3ZGLE9BQU8sRUFBRSxJQUFJO1FBQ2Isa0JBQWtCLEVBQUUsNERBQTREO0tBQ2pGLENBQUMsQ0FBQztBQUNQLENBQUM7QUFFRCwyQkFBMkI7QUFDM0IsS0FBSyxVQUFVLE9BQU8sQ0FBQyxFQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFpQztJQUNuRixNQUFNLFdBQVcsR0FBRyxLQUFLLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLHFCQUFxQixFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztJQUMzRSxNQUFNLFFBQVEsR0FBRyxJQUFJLElBQUksZUFBZSxJQUFJLHFCQUFxQixDQUFDO0lBRWxFLE1BQU0sWUFBWSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQztBQUM1QyxDQUFDO0FBRUQsS0FBSyxVQUFVLHFCQUFxQjtJQUNsQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sYUFBYSxFQUFFLENBQUMsQ0FBQyxhQUFhLEVBQUUscUJBQXFCLENBQUM7QUFDL0YsQ0FBQztBQUVELG1EQUFtRDtBQUNuRCxNQUFNLENBQUMsTUFBTSxrQkFBa0IsR0FBMkM7SUFDeEUsT0FBTztJQUNQLE9BQU87SUFDUCxPQUFPLEVBQUUscUJBQXFCO0lBQzlCLFFBQVEsRUFBRSx5Q0FBeUM7Q0FDcEQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0FyZ3YsIEFyZ3VtZW50cywgQ29tbWFuZE1vZHVsZX0gZnJvbSAneWFyZ3MnO1xuXG5pbXBvcnQge2dldFVzZXJDb25maWd9IGZyb20gJy4uLy4uL3V0aWxzL2NvbmZpZy5qcyc7XG5cbmltcG9ydCB7dmFsaWRhdGVGaWxlfSBmcm9tICcuL3ZhbGlkYXRlLWZpbGUuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZhbGlkYXRlRmlsZU9wdGlvbnMge1xuICBmaWxlPzogc3RyaW5nO1xuICBmaWxlRW52VmFyaWFibGU/OiBzdHJpbmc7XG4gIGVycm9yOiBib29sZWFuIHwgbnVsbDtcbn1cblxuLyoqIEJ1aWxkcyB0aGUgY29tbWFuZC4gKi9cbmZ1bmN0aW9uIGJ1aWxkZXIoYXJndjogQXJndikge1xuICByZXR1cm4gYXJndlxuICAgIC5vcHRpb24oJ2ZpbGUnLCB7XG4gICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgIGNvbmZsaWN0czogWydmaWxlLWVudi12YXJpYWJsZSddLFxuICAgICAgZGVzY3JpcHRpb246ICdUaGUgcGF0aCBvZiB0aGUgY29tbWl0IG1lc3NhZ2UgZmlsZS4nLFxuICAgIH0pXG4gICAgLm9wdGlvbignZmlsZS1lbnYtdmFyaWFibGUnIGFzICdmaWxlRW52VmFyaWFibGUnLCB7XG4gICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgIGNvbmZsaWN0czogWydmaWxlJ10sXG4gICAgICBkZXNjcmlwdGlvbjogJ1RoZSBrZXkgb2YgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlIGZvciB0aGUgcGF0aCBvZiB0aGUgY29tbWl0IG1lc3NhZ2UgZmlsZS4nLFxuICAgICAgY29lcmNlOiAoYXJnOiBzdHJpbmcgfCB1bmRlZmluZWQpID0+IHtcbiAgICAgICAgaWYgKGFyZyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcmV0dXJuIGFyZztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBmaWxlID0gcHJvY2Vzcy5lbnZbYXJnXTtcbiAgICAgICAgaWYgKCFmaWxlKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm92aWRlZCBlbnZpcm9ubWVudCB2YXJpYWJsZSBcIiR7YXJnfVwiIHdhcyBub3QgZm91bmQuYCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZpbGU7XG4gICAgICB9LFxuICAgIH0pXG4gICAgLm9wdGlvbignZXJyb3InLCB7XG4gICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICBkZXNjcmlwdGlvbjpcbiAgICAgICAgJ1doZXRoZXIgaW52YWxpZCBjb21taXQgbWVzc2FnZXMgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgZmFpbHVyZXMgcmF0aGVyIHRoYW4gYSB3YXJuaW5nJyxcbiAgICAgIGRlZmF1bHQ6IG51bGwsXG4gICAgICBkZWZhdWx0RGVzY3JpcHRpb246ICdgVHJ1ZWAgb24gQ0kgb3IgY2FuIGJlIGVuYWJsZWQgdGhyb3VnaCBuZy1kZXYgdXNlci1jb25maWcuJyxcbiAgICB9KTtcbn1cblxuLyoqIEhhbmRsZXMgdGhlIGNvbW1hbmQuICovXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVyKHtlcnJvciwgZmlsZSwgZmlsZUVudlZhcmlhYmxlfTogQXJndW1lbnRzPFZhbGlkYXRlRmlsZU9wdGlvbnM+KSB7XG4gIGNvbnN0IGlzRXJyb3JNb2RlID0gZXJyb3IgPT09IG51bGwgPyBhd2FpdCBnZXRJc0Vycm9yTW9kZURlZmF1bHQoKSA6IGVycm9yO1xuICBjb25zdCBmaWxlUGF0aCA9IGZpbGUgfHwgZmlsZUVudlZhcmlhYmxlIHx8ICcuZ2l0L0NPTU1JVF9FRElUTVNHJztcblxuICBhd2FpdCB2YWxpZGF0ZUZpbGUoZmlsZVBhdGgsIGlzRXJyb3JNb2RlKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0SXNFcnJvck1vZGVEZWZhdWx0KCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICByZXR1cm4gISFwcm9jZXNzLmVudlsnQ0knXSB8fCAhIShhd2FpdCBnZXRVc2VyQ29uZmlnKCkpLmNvbW1pdE1lc3NhZ2U/LmVycm9yT25JbnZhbGlkTWVzc2FnZTtcbn1cblxuLyoqIHlhcmdzIGNvbW1hbmQgbW9kdWxlIGRlc2NyaWJpbmcgdGhlIGNvbW1hbmQuICovXG5leHBvcnQgY29uc3QgVmFsaWRhdGVGaWxlTW9kdWxlOiBDb21tYW5kTW9kdWxlPHt9LCBWYWxpZGF0ZUZpbGVPcHRpb25zPiA9IHtcbiAgaGFuZGxlcixcbiAgYnVpbGRlcixcbiAgY29tbWFuZDogJ3ByZS1jb21taXQtdmFsaWRhdGUnLFxuICBkZXNjcmliZTogJ1ZhbGlkYXRlIHRoZSBtb3N0IHJlY2VudCBjb21taXQgbWVzc2FnZScsXG59O1xuIl19