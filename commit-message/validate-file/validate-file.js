/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { green, Log, yellow } from '../../utils/logging.js';
import { GitClient } from '../../utils/git/git-client.js';
import { deleteCommitMessageDraft, saveCommitMessageDraft, } from '../restore-commit-message/commit-message-draft.js';
import { printValidationErrors, validateCommitMessage } from '../validate.js';
/** Validate commit message at the provided file path. */
export async function validateFile(filePath, isErrorMode) {
    const git = await GitClient.get();
    const commitMessage = readFileSync(resolve(git.baseDir, filePath), 'utf8');
    const { valid, errors } = await validateCommitMessage(commitMessage);
    if (valid) {
        Log.info(`${green('√')}  Valid commit message`);
        deleteCommitMessageDraft(filePath);
        process.exitCode = 0;
        return;
    }
    /** Function used to print to the console log. */
    let printFn = isErrorMode ? Log.error : Log.log;
    printFn(isErrorMode ? '✘ Invalid commit message.' : yellow('! Invalid commit message.'));
    printValidationErrors(errors, printFn);
    if (isErrorMode) {
        printFn('Aborting commit attempt due to invalid commit message.');
        printFn('Commit message aborted as failure rather than warning due to local configuration.');
    }
    else {
        printFn(yellow('Before this commit can be merged into the upstream repository, it must be'));
        printFn(yellow('amended to follow commit message guidelines.'));
    }
    // On all invalid commit messages, the commit message should be saved as a draft to be
    // restored on the next commit attempt.
    saveCommitMessageDraft(filePath, commitMessage);
    // Set the correct exit code based on if invalid commit message is an error.
    process.exitCode = isErrorMode ? 1 : 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdGUtZmlsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9jb21taXQtbWVzc2FnZS92YWxpZGF0ZS1maWxlL3ZhbGlkYXRlLWZpbGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLElBQUksQ0FBQztBQUNoQyxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sTUFBTSxDQUFDO0FBRTdCLE9BQU8sRUFBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzFELE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSwrQkFBK0IsQ0FBQztBQUV4RCxPQUFPLEVBQ0wsd0JBQXdCLEVBQ3hCLHNCQUFzQixHQUN2QixNQUFNLG1EQUFtRCxDQUFDO0FBQzNELE9BQU8sRUFBQyxxQkFBcUIsRUFBRSxxQkFBcUIsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBRTVFLHlEQUF5RDtBQUN6RCxNQUFNLENBQUMsS0FBSyxVQUFVLFlBQVksQ0FBQyxRQUFnQixFQUFFLFdBQW9CO0lBQ3ZFLE1BQU0sR0FBRyxHQUFHLE1BQU0sU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ2xDLE1BQU0sYUFBYSxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUMzRSxNQUFNLEVBQUMsS0FBSyxFQUFFLE1BQU0sRUFBQyxHQUFHLE1BQU0scUJBQXFCLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDbkUsSUFBSSxLQUFLLEVBQUUsQ0FBQztRQUNWLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFDaEQsd0JBQXdCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbkMsT0FBTyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7UUFDckIsT0FBTztJQUNULENBQUM7SUFFRCxpREFBaUQ7SUFDakQsSUFBSSxPQUFPLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO0lBRWhELE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxDQUFDO0lBQ3pGLHFCQUFxQixDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN2QyxJQUFJLFdBQVcsRUFBRSxDQUFDO1FBQ2hCLE9BQU8sQ0FBQyx3REFBd0QsQ0FBQyxDQUFDO1FBQ2xFLE9BQU8sQ0FBQyxtRkFBbUYsQ0FBQyxDQUFDO0lBQy9GLENBQUM7U0FBTSxDQUFDO1FBQ04sT0FBTyxDQUFDLE1BQU0sQ0FBQywyRUFBMkUsQ0FBQyxDQUFDLENBQUM7UUFDN0YsT0FBTyxDQUFDLE1BQU0sQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDLENBQUM7SUFDbEUsQ0FBQztJQUVELHNGQUFzRjtJQUN0Rix1Q0FBdUM7SUFDdkMsc0JBQXNCLENBQUMsUUFBUSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQ2hELDRFQUE0RTtJQUM1RSxPQUFPLENBQUMsUUFBUSxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDekMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtyZWFkRmlsZVN5bmN9IGZyb20gJ2ZzJztcbmltcG9ydCB7cmVzb2x2ZX0gZnJvbSAncGF0aCc7XG5cbmltcG9ydCB7Z3JlZW4sIExvZywgeWVsbG93fSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7R2l0Q2xpZW50fSBmcm9tICcuLi8uLi91dGlscy9naXQvZ2l0LWNsaWVudC5qcyc7XG5cbmltcG9ydCB7XG4gIGRlbGV0ZUNvbW1pdE1lc3NhZ2VEcmFmdCxcbiAgc2F2ZUNvbW1pdE1lc3NhZ2VEcmFmdCxcbn0gZnJvbSAnLi4vcmVzdG9yZS1jb21taXQtbWVzc2FnZS9jb21taXQtbWVzc2FnZS1kcmFmdC5qcyc7XG5pbXBvcnQge3ByaW50VmFsaWRhdGlvbkVycm9ycywgdmFsaWRhdGVDb21taXRNZXNzYWdlfSBmcm9tICcuLi92YWxpZGF0ZS5qcyc7XG5cbi8qKiBWYWxpZGF0ZSBjb21taXQgbWVzc2FnZSBhdCB0aGUgcHJvdmlkZWQgZmlsZSBwYXRoLiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHZhbGlkYXRlRmlsZShmaWxlUGF0aDogc3RyaW5nLCBpc0Vycm9yTW9kZTogYm9vbGVhbikge1xuICBjb25zdCBnaXQgPSBhd2FpdCBHaXRDbGllbnQuZ2V0KCk7XG4gIGNvbnN0IGNvbW1pdE1lc3NhZ2UgPSByZWFkRmlsZVN5bmMocmVzb2x2ZShnaXQuYmFzZURpciwgZmlsZVBhdGgpLCAndXRmOCcpO1xuICBjb25zdCB7dmFsaWQsIGVycm9yc30gPSBhd2FpdCB2YWxpZGF0ZUNvbW1pdE1lc3NhZ2UoY29tbWl0TWVzc2FnZSk7XG4gIGlmICh2YWxpZCkge1xuICAgIExvZy5pbmZvKGAke2dyZWVuKCfiiJonKX0gIFZhbGlkIGNvbW1pdCBtZXNzYWdlYCk7XG4gICAgZGVsZXRlQ29tbWl0TWVzc2FnZURyYWZ0KGZpbGVQYXRoKTtcbiAgICBwcm9jZXNzLmV4aXRDb2RlID0gMDtcbiAgICByZXR1cm47XG4gIH1cblxuICAvKiogRnVuY3Rpb24gdXNlZCB0byBwcmludCB0byB0aGUgY29uc29sZSBsb2cuICovXG4gIGxldCBwcmludEZuID0gaXNFcnJvck1vZGUgPyBMb2cuZXJyb3IgOiBMb2cubG9nO1xuXG4gIHByaW50Rm4oaXNFcnJvck1vZGUgPyAn4pyYIEludmFsaWQgY29tbWl0IG1lc3NhZ2UuJyA6IHllbGxvdygnISBJbnZhbGlkIGNvbW1pdCBtZXNzYWdlLicpKTtcbiAgcHJpbnRWYWxpZGF0aW9uRXJyb3JzKGVycm9ycywgcHJpbnRGbik7XG4gIGlmIChpc0Vycm9yTW9kZSkge1xuICAgIHByaW50Rm4oJ0Fib3J0aW5nIGNvbW1pdCBhdHRlbXB0IGR1ZSB0byBpbnZhbGlkIGNvbW1pdCBtZXNzYWdlLicpO1xuICAgIHByaW50Rm4oJ0NvbW1pdCBtZXNzYWdlIGFib3J0ZWQgYXMgZmFpbHVyZSByYXRoZXIgdGhhbiB3YXJuaW5nIGR1ZSB0byBsb2NhbCBjb25maWd1cmF0aW9uLicpO1xuICB9IGVsc2Uge1xuICAgIHByaW50Rm4oeWVsbG93KCdCZWZvcmUgdGhpcyBjb21taXQgY2FuIGJlIG1lcmdlZCBpbnRvIHRoZSB1cHN0cmVhbSByZXBvc2l0b3J5LCBpdCBtdXN0IGJlJykpO1xuICAgIHByaW50Rm4oeWVsbG93KCdhbWVuZGVkIHRvIGZvbGxvdyBjb21taXQgbWVzc2FnZSBndWlkZWxpbmVzLicpKTtcbiAgfVxuXG4gIC8vIE9uIGFsbCBpbnZhbGlkIGNvbW1pdCBtZXNzYWdlcywgdGhlIGNvbW1pdCBtZXNzYWdlIHNob3VsZCBiZSBzYXZlZCBhcyBhIGRyYWZ0IHRvIGJlXG4gIC8vIHJlc3RvcmVkIG9uIHRoZSBuZXh0IGNvbW1pdCBhdHRlbXB0LlxuICBzYXZlQ29tbWl0TWVzc2FnZURyYWZ0KGZpbGVQYXRoLCBjb21taXRNZXNzYWdlKTtcbiAgLy8gU2V0IHRoZSBjb3JyZWN0IGV4aXQgY29kZSBiYXNlZCBvbiBpZiBpbnZhbGlkIGNvbW1pdCBtZXNzYWdlIGlzIGFuIGVycm9yLlxuICBwcm9jZXNzLmV4aXRDb2RlID0gaXNFcnJvck1vZGUgPyAxIDogMDtcbn1cbiJdfQ==