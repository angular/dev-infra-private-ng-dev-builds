/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { getConfig } from '../utils/config.js';
import { Log } from '../utils/logging.js';
import { assertValidCommitMessageConfig, COMMIT_TYPES, ScopeRequirement } from './config.js';
import { parseCommitMessage } from './parse.js';
/** Regex matching a URL for an entire commit body line. */
const COMMIT_BODY_URL_LINE_RE = /^https?:\/\/.*$/;
/**
 * Regular expression matching potential misuse of the `BREAKING CHANGE:` marker in a
 * commit message. Commit messages containing one of the following snippets will fail:
 *
 *   - `BREAKING CHANGE <some-content>` | Here we assume the colon is missing by accident.
 *   - `BREAKING-CHANGE: <some-content>` | The wrong keyword is used here.
 *   - `BREAKING CHANGES: <some-content>` | The wrong keyword is used here.
 *   - `BREAKING-CHANGES: <some-content>` | The wrong keyword is used here.
 */
const INCORRECT_BREAKING_CHANGE_BODY_RE = /^(BREAKING CHANGE[^:]|BREAKING-CHANGE|BREAKING[ -]CHANGES)/m;
/**
 * Regular expression matching potential misuse of the `DEPRECATED:` marker in a commit
 * message. Commit messages containing one of the following snippets will fail:
 *
 *   - `DEPRECATED <some-content>` | Here we assume the colon is missing by accident.
 *   - `DEPRECATIONS: <some-content>` | The wrong keyword is used here.
 *   - `DEPRECATION: <some-content>` | The wrong keyword is used here.
 *   - `DEPRECATE: <some-content>` | The wrong keyword is used here.
 *   - `DEPRECATES: <some-content>` | The wrong keyword is used here.
 */
const INCORRECT_DEPRECATION_BODY_RE = /^(DEPRECATED[^:]|DEPRECATIONS?|DEPRECATE:|DEPRECATES)/m;
/** Validate a commit message against using the local repo's config. */
export async function validateCommitMessage(commitMsg, options = {}) {
    const _config = await getConfig();
    assertValidCommitMessageConfig(_config);
    const config = _config.commitMessage;
    const commit = typeof commitMsg === 'string' ? parseCommitMessage(commitMsg) : commitMsg;
    const errors = [];
    /** Perform the validation checks against the parsed commit. */
    function validateCommitAndCollectErrors() {
        ////////////////////////////////////
        // Checking revert, squash, fixup //
        ////////////////////////////////////
        // All revert commits are considered valid.
        if (commit.isRevert) {
            return true;
        }
        // All squashes are considered valid, as the commit will be squashed into another in
        // the git history anyway, unless the options provided to not allow squash commits.
        if (commit.isSquash) {
            if (options.disallowSquash) {
                errors.push('The commit must be manually squashed into the target commit');
                return false;
            }
            return true;
        }
        // Fixups commits are considered valid, unless nonFixupCommitHeaders are provided to check
        // against. If `nonFixupCommitHeaders` is not empty, we check whether there is a corresponding
        // non-fixup commit (i.e. a commit whose header is identical to this commit's header after
        // stripping the `fixup! ` prefix), otherwise we assume this verification will happen in another
        // check.
        if (commit.isFixup) {
            if (options.disallowFixup) {
                errors.push('The commit must be manually fixed-up into the target commit as fixup commits are disallowed');
                return false;
            }
            if (options.nonFixupCommitHeaders && !options.nonFixupCommitHeaders.includes(commit.header)) {
                errors.push('Unable to find match for fixup commit among prior commits: ' +
                    (options.nonFixupCommitHeaders.map((x) => `\n      ${x}`).join('') || '-'));
                return false;
            }
            return true;
        }
        ////////////////////////////
        // Checking commit header //
        ////////////////////////////
        if (commit.header.length > config.maxLineLength) {
            errors.push(`The commit message header is longer than ${config.maxLineLength} characters`);
            return false;
        }
        if (!commit.type) {
            errors.push(`The commit message header does not match the expected format.`);
            return false;
        }
        if (COMMIT_TYPES[commit.type] === undefined) {
            errors.push(`'${commit.type}' is not an allowed type.\n => TYPES: ${Object.keys(COMMIT_TYPES).join(', ')}`);
            return false;
        }
        /** The scope requirement level for the provided type of the commit message. */
        const scopeRequirementForType = COMMIT_TYPES[commit.type].scope;
        if (scopeRequirementForType === ScopeRequirement.Forbidden && commit.scope) {
            errors.push(`Scopes are forbidden for commits with type '${commit.type}', but a scope of '${commit.scope}' was provided.`);
            return false;
        }
        if (scopeRequirementForType === ScopeRequirement.Required && !commit.scope) {
            errors.push(`Scopes are required for commits with type '${commit.type}', but no scope was provided.`);
            return false;
        }
        if (commit.scope && !config.scopes.includes(commit.scope)) {
            errors.push(`'${commit.scope}' is not an allowed scope.\n => SCOPES: ${config.scopes.join(', ')}`);
            return false;
        }
        // Commits with the type of `release` do not require a commit body.
        if (commit.type === 'release') {
            return true;
        }
        //////////////////////////
        // Checking commit body //
        //////////////////////////
        // Due to an issue in which conventional-commits-parser considers all parts of a commit after
        // a `#` reference to be the footer, we check the length of all of the commit content after the
        // header. In the future, we expect to be able to check only the body once the parser properly
        // handles this case.
        const allNonHeaderContent = `${commit.body.trim()}\n${commit.footer.trim()}`;
        if (!config.minBodyLengthTypeExcludes?.includes(commit.type) &&
            allNonHeaderContent.length < config.minBodyLength) {
            errors.push(`The commit message body does not meet the minimum length of ${config.minBodyLength} characters`);
            return false;
        }
        const bodyByLine = commit.body.split('\n');
        const lineExceedsMaxLength = bodyByLine.some((line) => {
            // Check if any line exceeds the max line length limit. The limit is ignored for
            // lines that just contain an URL (as these usually cannot be wrapped or shortened).
            return line.length > config.maxLineLength && !COMMIT_BODY_URL_LINE_RE.test(line);
        });
        if (lineExceedsMaxLength) {
            errors.push(`The commit message body contains lines greater than ${config.maxLineLength} characters.`);
            return false;
        }
        // Breaking change
        // Check if the commit message contains a valid break change description.
        // https://github.com/angular/angular/blob/88fbc066775ab1a2f6a8c75f933375b46d8fa9a4/CONTRIBUTING.md#commit-message-footer
        if (INCORRECT_BREAKING_CHANGE_BODY_RE.test(commit.fullText)) {
            errors.push(`The commit message body contains an invalid breaking change note.`);
            return false;
        }
        if (INCORRECT_DEPRECATION_BODY_RE.test(commit.fullText)) {
            errors.push(`The commit message body contains an invalid deprecation note.`);
            return false;
        }
        return true;
    }
    return { valid: validateCommitAndCollectErrors(), errors, commit };
}
/** Print the error messages from the commit message validation to the console. */
export function printValidationErrors(errors, print = Log.error) {
    print.group(`Error${errors.length === 1 ? '' : 's'}:`);
    errors.forEach((line) => print(line));
    print.groupEnd();
    print();
    print('The expected format for a commit is: ');
    print('<type>(<scope>): <summary>');
    print();
    print('<body>');
    print();
    print(`BREAKING CHANGE: <breaking change summary>`);
    print();
    print(`<breaking change description>`);
    print();
    print();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9uZy1kZXYvY29tbWl0LW1lc3NhZ2UvdmFsaWRhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQzdDLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUV4QyxPQUFPLEVBQUMsOEJBQThCLEVBQUUsWUFBWSxFQUFFLGdCQUFnQixFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQzNGLE9BQU8sRUFBUyxrQkFBa0IsRUFBQyxNQUFNLFlBQVksQ0FBQztBQWdCdEQsMkRBQTJEO0FBQzNELE1BQU0sdUJBQXVCLEdBQUcsaUJBQWlCLENBQUM7QUFFbEQ7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFNLGlDQUFpQyxHQUNyQyw2REFBNkQsQ0FBQztBQUVoRTs7Ozs7Ozs7O0dBU0c7QUFDSCxNQUFNLDZCQUE2QixHQUFHLHdEQUF3RCxDQUFDO0FBRS9GLHVFQUF1RTtBQUN2RSxNQUFNLENBQUMsS0FBSyxVQUFVLHFCQUFxQixDQUN6QyxTQUEwQixFQUMxQixVQUF3QyxFQUFFO0lBRTFDLE1BQU0sT0FBTyxHQUFHLE1BQU0sU0FBUyxFQUFFLENBQUM7SUFDbEMsOEJBQThCLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDeEMsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUNyQyxNQUFNLE1BQU0sR0FBRyxPQUFPLFNBQVMsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDekYsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO0lBRTVCLCtEQUErRDtJQUMvRCxTQUFTLDhCQUE4QjtRQUNyQyxvQ0FBb0M7UUFDcEMsb0NBQW9DO1FBQ3BDLG9DQUFvQztRQUVwQywy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LENBQUMsUUFBUSxFQUFFLENBQUM7SUFDakIsS0FBSyxFQUFFLENBQUM7SUFDUixLQUFLLENBQUMsdUNBQXVDLENBQUMsQ0FBQztJQUMvQyxLQUFLLENBQUMsNEJBQTRCLENBQUMsQ0FBQztJQUNwQyxLQUFLLEVBQUUsQ0FBQztJQUNSLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNoQixLQUFLLEVBQUUsQ0FBQztJQUNSLEtBQUssQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO0lBQ3BELEtBQUssRUFBRSxDQUFDO0lBQ1IsS0FBSyxDQUFDLCtCQUErQixDQUFDLENBQUM7SUFDdkMsS0FBSyxFQUFFLENBQUM7SUFDUixLQUFLLEVBQUUsQ0FBQztBQUNWLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtnZXRDb25maWd9IGZyb20gJy4uL3V0aWxzL2NvbmZpZy5qcyc7XG5pbXBvcnQge0xvZ30gZnJvbSAnLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5cbmltcG9ydCB7YXNzZXJ0VmFsaWRDb21taXRNZXNzYWdlQ29uZmlnLCBDT01NSVRfVFlQRVMsIFNjb3BlUmVxdWlyZW1lbnR9IGZyb20gJy4vY29uZmlnLmpzJztcbmltcG9ydCB7Q29tbWl0LCBwYXJzZUNvbW1pdE1lc3NhZ2V9IGZyb20gJy4vcGFyc2UuanMnO1xuXG4vKiogT3B0aW9ucyBmb3IgY29tbWl0IG1lc3NhZ2UgdmFsaWRhdGlvbi4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVmFsaWRhdGVDb21taXRNZXNzYWdlT3B0aW9ucyB7XG4gIGRpc2FsbG93U3F1YXNoPzogYm9vbGVhbjtcbiAgZGlzYWxsb3dGaXh1cD86IGJvb2xlYW47XG4gIG5vbkZpeHVwQ29tbWl0SGVhZGVycz86IHN0cmluZ1tdO1xufVxuXG4vKiogVGhlIHJlc3VsdCBvZiBhIGNvbW1pdCBtZXNzYWdlIHZhbGlkYXRpb24gY2hlY2suICovXG5leHBvcnQgaW50ZXJmYWNlIFZhbGlkYXRlQ29tbWl0TWVzc2FnZVJlc3VsdCB7XG4gIHZhbGlkOiBib29sZWFuO1xuICBlcnJvcnM6IHN0cmluZ1tdO1xuICBjb21taXQ6IENvbW1pdDtcbn1cblxuLyoqIFJlZ2V4IG1hdGNoaW5nIGEgVVJMIGZvciBhbiBlbnRpcmUgY29tbWl0IGJvZHkgbGluZS4gKi9cbmNvbnN0IENPTU1JVF9CT0RZX1VSTF9MSU5FX1JFID0gL15odHRwcz86XFwvXFwvLiokLztcblxuLyoqXG4gKiBSZWd1bGFyIGV4cHJlc3Npb24gbWF0Y2hpbmcgcG90ZW50aWFsIG1pc3VzZSBvZiB0aGUgYEJSRUFLSU5HIENIQU5HRTpgIG1hcmtlciBpbiBhXG4gKiBjb21taXQgbWVzc2FnZS4gQ29tbWl0IG1lc3NhZ2VzIGNvbnRhaW5pbmcgb25lIG9mIHRoZSBmb2xsb3dpbmcgc25pcHBldHMgd2lsbCBmYWlsOlxuICpcbiAqICAgLSBgQlJFQUtJTkcgQ0hBTkdFIDxzb21lLWNvbnRlbnQ+YCB8IEhlcmUgd2UgYXNzdW1lIHRoZSBjb2xvbiBpcyBtaXNzaW5nIGJ5IGFjY2lkZW50LlxuICogICAtIGBCUkVBS0lORy1DSEFOR0U6IDxzb21lLWNvbnRlbnQ+YCB8IFRoZSB3cm9uZyBrZXl3b3JkIGlzIHVzZWQgaGVyZS5cbiAqICAgLSBgQlJFQUtJTkcgQ0hBTkdFUzogPHNvbWUtY29udGVudD5gIHwgVGhlIHdyb25nIGtleXdvcmQgaXMgdXNlZCBoZXJlLlxuICogICAtIGBCUkVBS0lORy1DSEFOR0VTOiA8c29tZS1jb250ZW50PmAgfCBUaGUgd3Jvbmcga2V5d29yZCBpcyB1c2VkIGhlcmUuXG4gKi9cbmNvbnN0IElOQ09SUkVDVF9CUkVBS0lOR19DSEFOR0VfQk9EWV9SRSA9XG4gIC9eKEJSRUFLSU5HIENIQU5HRVteOl18QlJFQUtJTkctQ0hBTkdFfEJSRUFLSU5HWyAtXUNIQU5HRVMpL207XG5cbi8qKlxuICogUmVndWxhciBleHByZXNzaW9uIG1hdGNoaW5nIHBvdGVudGlhbCBtaXN1c2Ugb2YgdGhlIGBERVBSRUNBVEVEOmAgbWFya2VyIGluIGEgY29tbWl0XG4gKiBtZXNzYWdlLiBDb21taXQgbWVzc2FnZXMgY29udGFpbmluZyBvbmUgb2YgdGhlIGZvbGxvd2luZyBzbmlwcGV0cyB3aWxsIGZhaWw6XG4gKlxuICogICAtIGBERVBSRUNBVEVEIDxzb21lLWNvbnRlbnQ+YCB8IEhlcmUgd2UgYXNzdW1lIHRoZSBjb2xvbiBpcyBtaXNzaW5nIGJ5IGFjY2lkZW50LlxuICogICAtIGBERVBSRUNBVElPTlM6IDxzb21lLWNvbnRlbnQ+YCB8IFRoZSB3cm9uZyBrZXl3b3JkIGlzIHVzZWQgaGVyZS5cbiAqICAgLSBgREVQUkVDQVRJT046IDxzb21lLWNvbnRlbnQ+YCB8IFRoZSB3cm9uZyBrZXl3b3JkIGlzIHVzZWQgaGVyZS5cbiAqICAgLSBgREVQUkVDQVRFOiA8c29tZS1jb250ZW50PmAgfCBUaGUgd3Jvbmcga2V5d29yZCBpcyB1c2VkIGhlcmUuXG4gKiAgIC0gYERFUFJFQ0FURVM6IDxzb21lLWNvbnRlbnQ+YCB8IFRoZSB3cm9uZyBrZXl3b3JkIGlzIHVzZWQgaGVyZS5cbiAqL1xuY29uc3QgSU5DT1JSRUNUX0RFUFJFQ0FUSU9OX0JPRFlfUkUgPSAvXihERVBSRUNBVEVEW146XXxERVBSRUNBVElPTlM/fERFUFJFQ0FURTp8REVQUkVDQVRFUykvbTtcblxuLyoqIFZhbGlkYXRlIGEgY29tbWl0IG1lc3NhZ2UgYWdhaW5zdCB1c2luZyB0aGUgbG9jYWwgcmVwbydzIGNvbmZpZy4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB2YWxpZGF0ZUNvbW1pdE1lc3NhZ2UoXG4gIGNvbW1pdE1zZzogc3RyaW5nIHwgQ29tbWl0LFxuICBvcHRpb25zOiBWYWxpZGF0ZUNvbW1pdE1lc3NhZ2VPcHRpb25zID0ge30sXG4pOiBQcm9taXNlPFZhbGlkYXRlQ29tbWl0TWVzc2FnZVJlc3VsdD4ge1xuICBjb25zdCBfY29uZmlnID0gYXdhaXQgZ2V0Q29uZmlnKCk7XG4gIGFzc2VydFZhbGlkQ29tbWl0TWVzc2FnZUNvbmZpZyhfY29uZmlnKTtcbiAgY29uc3QgY29uZmlnID0gX2NvbmZpZy5jb21taXRNZXNzYWdlO1xuICBjb25zdCBjb21taXQgPSB0eXBlb2YgY29tbWl0TXNnID09PSAnc3RyaW5nJyA/IHBhcnNlQ29tbWl0TWVzc2FnZShjb21taXRNc2cpIDogY29tbWl0TXNnO1xuICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgLyoqIFBlcmZvcm0gdGhlIHZhbGlkYXRpb24gY2hlY2tzIGFnYWluc3QgdGhlIHBhcnNlZCBjb21taXQuICovXG4gIGZ1bmN0aW9uIHZhbGlkYXRlQ29tbWl0QW5kQ29sbGVjdEVycm9ycygpIHtcbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAvLyBDaGVja2luZyByZXZlcnQsIHNxdWFzaCwgZml4dXAgLy9cbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuICAgIC8vIEFsbCByZXZlcnQgY29tbWl0cyBhcmUgY29uc2lkZXJlZCB2YWxpZC5cbiAgICBpZiAoY29tbWl0LmlzUmV2ZXJ0KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBBbGwgc3F1YXNoZXMgYXJlIGNvbnNpZGVyZWQgdmFsaWQsIGFzIHRoZSBjb21taXQgd2lsbCBiZSBzcXVhc2hlZCBpbnRvIGFub3RoZXIgaW5cbiAgICAvLyB0aGUgZ2l0IGhpc3RvcnkgYW55d2F5LCB1bmxlc3MgdGhlIG9wdGlvbnMgcHJvdmlkZWQgdG8gbm90IGFsbG93IHNxdWFzaCBjb21taXRzLlxuICAgIGlmIChjb21taXQuaXNTcXVhc2gpIHtcbiAgICAgIGlmIChvcHRpb25zLmRpc2FsbG93U3F1YXNoKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCdUaGUgY29tbWl0IG11c3QgYmUgbWFudWFsbHkgc3F1YXNoZWQgaW50byB0aGUgdGFyZ2V0IGNvbW1pdCcpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBGaXh1cHMgY29tbWl0cyBhcmUgY29uc2lkZXJlZCB2YWxpZCwgdW5sZXNzIG5vbkZpeHVwQ29tbWl0SGVhZGVycyBhcmUgcHJvdmlkZWQgdG8gY2hlY2tcbiAgICAvLyBhZ2FpbnN0LiBJZiBgbm9uRml4dXBDb21taXRIZWFkZXJzYCBpcyBub3QgZW1wdHksIHdlIGNoZWNrIHdoZXRoZXIgdGhlcmUgaXMgYSBjb3JyZXNwb25kaW5nXG4gICAgLy8gbm9uLWZpeHVwIGNvbW1pdCAoaS5lLiBhIGNvbW1pdCB3aG9zZSBoZWFkZXIgaXMgaWRlbnRpY2FsIHRvIHRoaXMgY29tbWl0J3MgaGVhZGVyIGFmdGVyXG4gICAgLy8gc3RyaXBwaW5nIHRoZSBgZml4dXAhIGAgcHJlZml4KSwgb3RoZXJ3aXNlIHdlIGFzc3VtZSB0aGlzIHZlcmlmaWNhdGlvbiB3aWxsIGhhcHBlbiBpbiBhbm90aGVyXG4gICAgLy8gY2hlY2suXG4gICAgaWYgKGNvbW1pdC5pc0ZpeHVwKSB7XG4gICAgICBpZiAob3B0aW9ucy5kaXNhbGxvd0ZpeHVwKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICAgICdUaGUgY29tbWl0IG11c3QgYmUgbWFudWFsbHkgZml4ZWQtdXAgaW50byB0aGUgdGFyZ2V0IGNvbW1pdCBhcyBmaXh1cCBjb21taXRzIGFyZSBkaXNhbGxvd2VkJyxcbiAgICAgICAgKTtcblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLm5vbkZpeHVwQ29tbWl0SGVhZGVycyAmJiAhb3B0aW9ucy5ub25GaXh1cENvbW1pdEhlYWRlcnMuaW5jbHVkZXMoY29tbWl0LmhlYWRlcikpIHtcbiAgICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgICAgJ1VuYWJsZSB0byBmaW5kIG1hdGNoIGZvciBmaXh1cCBjb21taXQgYW1vbmcgcHJpb3IgY29tbWl0czogJyArXG4gICAgICAgICAgICAob3B0aW9ucy5ub25GaXh1cENvbW1pdEhlYWRlcnMubWFwKCh4KSA9PiBgXFxuICAgICAgJHt4fWApLmpvaW4oJycpIHx8ICctJyksXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgIC8vIENoZWNraW5nIGNvbW1pdCBoZWFkZXIgLy9cbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgaWYgKGNvbW1pdC5oZWFkZXIubGVuZ3RoID4gY29uZmlnLm1heExpbmVMZW5ndGgpIHtcbiAgICAgIGVycm9ycy5wdXNoKGBUaGUgY29tbWl0IG1lc3NhZ2UgaGVhZGVyIGlzIGxvbmdlciB0aGFuICR7Y29uZmlnLm1heExpbmVMZW5ndGh9IGNoYXJhY3RlcnNgKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoIWNvbW1pdC50eXBlKSB7XG4gICAgICBlcnJvcnMucHVzaChgVGhlIGNvbW1pdCBtZXNzYWdlIGhlYWRlciBkb2VzIG5vdCBtYXRjaCB0aGUgZXhwZWN0ZWQgZm9ybWF0LmApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChDT01NSVRfVFlQRVNbY29tbWl0LnR5cGVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICBgJyR7Y29tbWl0LnR5cGV9JyBpcyBub3QgYW4gYWxsb3dlZCB0eXBlLlxcbiA9PiBUWVBFUzogJHtPYmplY3Qua2V5cyhDT01NSVRfVFlQRVMpLmpvaW4oXG4gICAgICAgICAgJywgJyxcbiAgICAgICAgKX1gLFxuICAgICAgKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKiogVGhlIHNjb3BlIHJlcXVpcmVtZW50IGxldmVsIGZvciB0aGUgcHJvdmlkZWQgdHlwZSBvZiB0aGUgY29tbWl0IG1lc3NhZ2UuICovXG4gICAgY29uc3Qgc2NvcGVSZXF1aXJlbWVudEZvclR5cGUgPSBDT01NSVRfVFlQRVNbY29tbWl0LnR5cGVdLnNjb3BlO1xuXG4gICAgaWYgKHNjb3BlUmVxdWlyZW1lbnRGb3JUeXBlID09PSBTY29wZVJlcXVpcmVtZW50LkZvcmJpZGRlbiAmJiBjb21taXQuc2NvcGUpIHtcbiAgICAgIGVycm9ycy5wdXNoKFxuICAgICAgICBgU2NvcGVzIGFyZSBmb3JiaWRkZW4gZm9yIGNvbW1pdHMgd2l0aCB0eXBlICcke2NvbW1pdC50eXBlfScsIGJ1dCBhIHNjb3BlIG9mICcke2NvbW1pdC5zY29wZX0nIHdhcyBwcm92aWRlZC5gLFxuICAgICAgKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoc2NvcGVSZXF1aXJlbWVudEZvclR5cGUgPT09IFNjb3BlUmVxdWlyZW1lbnQuUmVxdWlyZWQgJiYgIWNvbW1pdC5zY29wZSkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgIGBTY29wZXMgYXJlIHJlcXVpcmVkIGZvciBjb21taXRzIHdpdGggdHlwZSAnJHtjb21taXQudHlwZX0nLCBidXQgbm8gc2NvcGUgd2FzIHByb3ZpZGVkLmAsXG4gICAgICApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChjb21taXQuc2NvcGUgJiYgIWNvbmZpZy5zY29wZXMuaW5jbHVkZXMoY29tbWl0LnNjb3BlKSkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgIGAnJHtjb21taXQuc2NvcGV9JyBpcyBub3QgYW4gYWxsb3dlZCBzY29wZS5cXG4gPT4gU0NPUEVTOiAke2NvbmZpZy5zY29wZXMuam9pbignLCAnKX1gLFxuICAgICAgKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBDb21taXRzIHdpdGggdGhlIHR5cGUgb2YgYHJlbGVhc2VgIGRvIG5vdCByZXF1aXJlIGEgY29tbWl0IGJvZHkuXG4gICAgaWYgKGNvbW1pdC50eXBlID09PSAncmVsZWFzZScpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgLy8gQ2hlY2tpbmcgY29tbWl0IGJvZHkgLy9cbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4gICAgLy8gRHVlIHRvIGFuIGlzc3VlIGluIHdoaWNoIGNvbnZlbnRpb25hbC1jb21taXRzLXBhcnNlciBjb25zaWRlcnMgYWxsIHBhcnRzIG9mIGEgY29tbWl0IGFmdGVyXG4gICAgLy8gYSBgI2AgcmVmZXJlbmNlIHRvIGJlIHRoZSBmb290ZXIsIHdlIGNoZWNrIHRoZSBsZW5ndGggb2YgYWxsIG9mIHRoZSBjb21taXQgY29udGVudCBhZnRlciB0aGVcbiAgICAvLyBoZWFkZXIuIEluIHRoZSBmdXR1cmUsIHdlIGV4cGVjdCB0byBiZSBhYmxlIHRvIGNoZWNrIG9ubHkgdGhlIGJvZHkgb25jZSB0aGUgcGFyc2VyIHByb3Blcmx5XG4gICAgLy8gaGFuZGxlcyB0aGlzIGNhc2UuXG4gICAgY29uc3QgYWxsTm9uSGVhZGVyQ29udGVudCA9IGAke2NvbW1pdC5ib2R5LnRyaW0oKX1cXG4ke2NvbW1pdC5mb290ZXIudHJpbSgpfWA7XG5cbiAgICBpZiAoXG4gICAgICAhY29uZmlnLm1pbkJvZHlMZW5ndGhUeXBlRXhjbHVkZXM/LmluY2x1ZGVzKGNvbW1pdC50eXBlKSAmJlxuICAgICAgYWxsTm9uSGVhZGVyQ29udGVudC5sZW5ndGggPCBjb25maWcubWluQm9keUxlbmd0aFxuICAgICkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgIGBUaGUgY29tbWl0IG1lc3NhZ2UgYm9keSBkb2VzIG5vdCBtZWV0IHRoZSBtaW5pbXVtIGxlbmd0aCBvZiAke2NvbmZpZy5taW5Cb2R5TGVuZ3RofSBjaGFyYWN0ZXJzYCxcbiAgICAgICk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgYm9keUJ5TGluZSA9IGNvbW1pdC5ib2R5LnNwbGl0KCdcXG4nKTtcbiAgICBjb25zdCBsaW5lRXhjZWVkc01heExlbmd0aCA9IGJvZHlCeUxpbmUuc29tZSgobGluZTogc3RyaW5nKSA9PiB7XG4gICAgICAvLyBDaGVjayBpZiBhbnkgbGluZSBleGNlZWRzIHRoZSBtYXggbGluZSBsZW5ndGggbGltaXQuIFRoZSBsaW1pdCBpcyBpZ25vcmVkIGZvclxuICAgICAgLy8gbGluZXMgdGhhdCBqdXN0IGNvbnRhaW4gYW4gVVJMIChhcyB0aGVzZSB1c3VhbGx5IGNhbm5vdCBiZSB3cmFwcGVkIG9yIHNob3J0ZW5lZCkuXG4gICAgICByZXR1cm4gbGluZS5sZW5ndGggPiBjb25maWcubWF4TGluZUxlbmd0aCAmJiAhQ09NTUlUX0JPRFlfVVJMX0xJTkVfUkUudGVzdChsaW5lKTtcbiAgICB9KTtcblxuICAgIGlmIChsaW5lRXhjZWVkc01heExlbmd0aCkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgIGBUaGUgY29tbWl0IG1lc3NhZ2UgYm9keSBjb250YWlucyBsaW5lcyBncmVhdGVyIHRoYW4gJHtjb25maWcubWF4TGluZUxlbmd0aH0gY2hhcmFjdGVycy5gLFxuICAgICAgKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBCcmVha2luZyBjaGFuZ2VcbiAgICAvLyBDaGVjayBpZiB0aGUgY29tbWl0IG1lc3NhZ2UgY29udGFpbnMgYSB2YWxpZCBicmVhayBjaGFuZ2UgZGVzY3JpcHRpb24uXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9ibG9iLzg4ZmJjMDY2Nzc1YWIxYTJmNmE4Yzc1ZjkzMzM3NWI0NmQ4ZmE5YTQvQ09OVFJJQlVUSU5HLm1kI2NvbW1pdC1tZXNzYWdlLWZvb3RlclxuICAgIGlmIChJTkNPUlJFQ1RfQlJFQUtJTkdfQ0hBTkdFX0JPRFlfUkUudGVzdChjb21taXQuZnVsbFRleHQpKSB7XG4gICAgICBlcnJvcnMucHVzaChgVGhlIGNvbW1pdCBtZXNzYWdlIGJvZHkgY29udGFpbnMgYW4gaW52YWxpZCBicmVha2luZyBjaGFuZ2Ugbm90ZS5gKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoSU5DT1JSRUNUX0RFUFJFQ0FUSU9OX0JPRFlfUkUudGVzdChjb21taXQuZnVsbFRleHQpKSB7XG4gICAgICBlcnJvcnMucHVzaChgVGhlIGNvbW1pdCBtZXNzYWdlIGJvZHkgY29udGFpbnMgYW4gaW52YWxpZCBkZXByZWNhdGlvbiBub3RlLmApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIHt2YWxpZDogdmFsaWRhdGVDb21taXRBbmRDb2xsZWN0RXJyb3JzKCksIGVycm9ycywgY29tbWl0fTtcbn1cblxuLyoqIFByaW50IHRoZSBlcnJvciBtZXNzYWdlcyBmcm9tIHRoZSBjb21taXQgbWVzc2FnZSB2YWxpZGF0aW9uIHRvIHRoZSBjb25zb2xlLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByaW50VmFsaWRhdGlvbkVycm9ycyhlcnJvcnM6IHN0cmluZ1tdLCBwcmludCA9IExvZy5lcnJvcikge1xuICBwcmludC5ncm91cChgRXJyb3Ike2Vycm9ycy5sZW5ndGggPT09IDEgPyAnJyA6ICdzJ306YCk7XG4gIGVycm9ycy5mb3JFYWNoKChsaW5lKSA9PiBwcmludChsaW5lKSk7XG4gIHByaW50Lmdyb3VwRW5kKCk7XG4gIHByaW50KCk7XG4gIHByaW50KCdUaGUgZXhwZWN0ZWQgZm9ybWF0IGZvciBhIGNvbW1pdCBpczogJyk7XG4gIHByaW50KCc8dHlwZT4oPHNjb3BlPik6IDxzdW1tYXJ5PicpO1xuICBwcmludCgpO1xuICBwcmludCgnPGJvZHk+Jyk7XG4gIHByaW50KCk7XG4gIHByaW50KGBCUkVBS0lORyBDSEFOR0U6IDxicmVha2luZyBjaGFuZ2Ugc3VtbWFyeT5gKTtcbiAgcHJpbnQoKTtcbiAgcHJpbnQoYDxicmVha2luZyBjaGFuZ2UgZGVzY3JpcHRpb24+YCk7XG4gIHByaW50KCk7XG4gIHByaW50KCk7XG59XG4iXX0=