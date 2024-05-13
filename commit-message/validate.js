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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9uZy1kZXYvY29tbWl0LW1lc3NhZ2UvdmFsaWRhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBQzdDLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUV4QyxPQUFPLEVBQUMsOEJBQThCLEVBQUUsWUFBWSxFQUFFLGdCQUFnQixFQUFDLE1BQU0sYUFBYSxDQUFDO0FBQzNGLE9BQU8sRUFBUyxrQkFBa0IsRUFBQyxNQUFNLFlBQVksQ0FBQztBQWV0RCwyREFBMkQ7QUFDM0QsTUFBTSx1QkFBdUIsR0FBRyxpQkFBaUIsQ0FBQztBQUVsRDs7Ozs7Ozs7R0FRRztBQUNILE1BQU0saUNBQWlDLEdBQ3JDLDZEQUE2RCxDQUFDO0FBRWhFOzs7Ozs7Ozs7R0FTRztBQUNILE1BQU0sNkJBQTZCLEdBQUcsd0RBQXdELENBQUM7QUFFL0YsdUVBQXVFO0FBQ3ZFLE1BQU0sQ0FBQyxLQUFLLFVBQVUscUJBQXFCLENBQ3pDLFNBQTBCLEVBQzFCLFVBQXdDLEVBQUU7SUFFMUMsTUFBTSxPQUFPLEdBQUcsTUFBTSxTQUFTLEVBQUUsQ0FBQztJQUNsQyw4QkFBOEIsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN4QyxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDO0lBQ3JDLE1BQU0sTUFBTSxHQUFHLE9BQU8sU0FBUyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUN6RixNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7SUFFNUIsK0RBQStEO0lBQy9ELFNBQVMsOEJBQThCO1FBQ3JDLG9DQUFvQztRQUNwQyxvQ0FBb0M7UUFDcEMsb0NBQW9DO1FBRXBDLDJD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LEtBQUssRUFBRSxDQUFDO0lBQ1IsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ2hCLEtBQUssRUFBRSxDQUFDO0lBQ1IsS0FBSyxDQUFDLDRDQUE0QyxDQUFDLENBQUM7SUFDcEQsS0FBSyxFQUFFLENBQUM7SUFDUixLQUFLLENBQUMsK0JBQStCLENBQUMsQ0FBQztJQUN2QyxLQUFLLEVBQUUsQ0FBQztJQUNSLEtBQUssRUFBRSxDQUFDO0FBQ1YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2dldENvbmZpZ30gZnJvbSAnLi4vdXRpbHMvY29uZmlnLmpzJztcbmltcG9ydCB7TG9nfSBmcm9tICcuLi91dGlscy9sb2dnaW5nLmpzJztcblxuaW1wb3J0IHthc3NlcnRWYWxpZENvbW1pdE1lc3NhZ2VDb25maWcsIENPTU1JVF9UWVBFUywgU2NvcGVSZXF1aXJlbWVudH0gZnJvbSAnLi9jb25maWcuanMnO1xuaW1wb3J0IHtDb21taXQsIHBhcnNlQ29tbWl0TWVzc2FnZX0gZnJvbSAnLi9wYXJzZS5qcyc7XG5cbi8qKiBPcHRpb25zIGZvciBjb21taXQgbWVzc2FnZSB2YWxpZGF0aW9uLiAqL1xuZXhwb3J0IGludGVyZmFjZSBWYWxpZGF0ZUNvbW1pdE1lc3NhZ2VPcHRpb25zIHtcbiAgZGlzYWxsb3dTcXVhc2g/OiBib29sZWFuO1xuICBub25GaXh1cENvbW1pdEhlYWRlcnM/OiBzdHJpbmdbXTtcbn1cblxuLyoqIFRoZSByZXN1bHQgb2YgYSBjb21taXQgbWVzc2FnZSB2YWxpZGF0aW9uIGNoZWNrLiAqL1xuZXhwb3J0IGludGVyZmFjZSBWYWxpZGF0ZUNvbW1pdE1lc3NhZ2VSZXN1bHQge1xuICB2YWxpZDogYm9vbGVhbjtcbiAgZXJyb3JzOiBzdHJpbmdbXTtcbiAgY29tbWl0OiBDb21taXQ7XG59XG5cbi8qKiBSZWdleCBtYXRjaGluZyBhIFVSTCBmb3IgYW4gZW50aXJlIGNvbW1pdCBib2R5IGxpbmUuICovXG5jb25zdCBDT01NSVRfQk9EWV9VUkxfTElORV9SRSA9IC9eaHR0cHM/OlxcL1xcLy4qJC87XG5cbi8qKlxuICogUmVndWxhciBleHByZXNzaW9uIG1hdGNoaW5nIHBvdGVudGlhbCBtaXN1c2Ugb2YgdGhlIGBCUkVBS0lORyBDSEFOR0U6YCBtYXJrZXIgaW4gYVxuICogY29tbWl0IG1lc3NhZ2UuIENvbW1pdCBtZXNzYWdlcyBjb250YWluaW5nIG9uZSBvZiB0aGUgZm9sbG93aW5nIHNuaXBwZXRzIHdpbGwgZmFpbDpcbiAqXG4gKiAgIC0gYEJSRUFLSU5HIENIQU5HRSA8c29tZS1jb250ZW50PmAgfCBIZXJlIHdlIGFzc3VtZSB0aGUgY29sb24gaXMgbWlzc2luZyBieSBhY2NpZGVudC5cbiAqICAgLSBgQlJFQUtJTkctQ0hBTkdFOiA8c29tZS1jb250ZW50PmAgfCBUaGUgd3Jvbmcga2V5d29yZCBpcyB1c2VkIGhlcmUuXG4gKiAgIC0gYEJSRUFLSU5HIENIQU5HRVM6IDxzb21lLWNvbnRlbnQ+YCB8IFRoZSB3cm9uZyBrZXl3b3JkIGlzIHVzZWQgaGVyZS5cbiAqICAgLSBgQlJFQUtJTkctQ0hBTkdFUzogPHNvbWUtY29udGVudD5gIHwgVGhlIHdyb25nIGtleXdvcmQgaXMgdXNlZCBoZXJlLlxuICovXG5jb25zdCBJTkNPUlJFQ1RfQlJFQUtJTkdfQ0hBTkdFX0JPRFlfUkUgPVxuICAvXihCUkVBS0lORyBDSEFOR0VbXjpdfEJSRUFLSU5HLUNIQU5HRXxCUkVBS0lOR1sgLV1DSEFOR0VTKS9tO1xuXG4vKipcbiAqIFJlZ3VsYXIgZXhwcmVzc2lvbiBtYXRjaGluZyBwb3RlbnRpYWwgbWlzdXNlIG9mIHRoZSBgREVQUkVDQVRFRDpgIG1hcmtlciBpbiBhIGNvbW1pdFxuICogbWVzc2FnZS4gQ29tbWl0IG1lc3NhZ2VzIGNvbnRhaW5pbmcgb25lIG9mIHRoZSBmb2xsb3dpbmcgc25pcHBldHMgd2lsbCBmYWlsOlxuICpcbiAqICAgLSBgREVQUkVDQVRFRCA8c29tZS1jb250ZW50PmAgfCBIZXJlIHdlIGFzc3VtZSB0aGUgY29sb24gaXMgbWlzc2luZyBieSBhY2NpZGVudC5cbiAqICAgLSBgREVQUkVDQVRJT05TOiA8c29tZS1jb250ZW50PmAgfCBUaGUgd3Jvbmcga2V5d29yZCBpcyB1c2VkIGhlcmUuXG4gKiAgIC0gYERFUFJFQ0FUSU9OOiA8c29tZS1jb250ZW50PmAgfCBUaGUgd3Jvbmcga2V5d29yZCBpcyB1c2VkIGhlcmUuXG4gKiAgIC0gYERFUFJFQ0FURTogPHNvbWUtY29udGVudD5gIHwgVGhlIHdyb25nIGtleXdvcmQgaXMgdXNlZCBoZXJlLlxuICogICAtIGBERVBSRUNBVEVTOiA8c29tZS1jb250ZW50PmAgfCBUaGUgd3Jvbmcga2V5d29yZCBpcyB1c2VkIGhlcmUuXG4gKi9cbmNvbnN0IElOQ09SUkVDVF9ERVBSRUNBVElPTl9CT0RZX1JFID0gL14oREVQUkVDQVRFRFteOl18REVQUkVDQVRJT05TP3xERVBSRUNBVEU6fERFUFJFQ0FURVMpL207XG5cbi8qKiBWYWxpZGF0ZSBhIGNvbW1pdCBtZXNzYWdlIGFnYWluc3QgdXNpbmcgdGhlIGxvY2FsIHJlcG8ncyBjb25maWcuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdmFsaWRhdGVDb21taXRNZXNzYWdlKFxuICBjb21taXRNc2c6IHN0cmluZyB8IENvbW1pdCxcbiAgb3B0aW9uczogVmFsaWRhdGVDb21taXRNZXNzYWdlT3B0aW9ucyA9IHt9LFxuKTogUHJvbWlzZTxWYWxpZGF0ZUNvbW1pdE1lc3NhZ2VSZXN1bHQ+IHtcbiAgY29uc3QgX2NvbmZpZyA9IGF3YWl0IGdldENvbmZpZygpO1xuICBhc3NlcnRWYWxpZENvbW1pdE1lc3NhZ2VDb25maWcoX2NvbmZpZyk7XG4gIGNvbnN0IGNvbmZpZyA9IF9jb25maWcuY29tbWl0TWVzc2FnZTtcbiAgY29uc3QgY29tbWl0ID0gdHlwZW9mIGNvbW1pdE1zZyA9PT0gJ3N0cmluZycgPyBwYXJzZUNvbW1pdE1lc3NhZ2UoY29tbWl0TXNnKSA6IGNvbW1pdE1zZztcbiAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIC8qKiBQZXJmb3JtIHRoZSB2YWxpZGF0aW9uIGNoZWNrcyBhZ2FpbnN0IHRoZSBwYXJzZWQgY29tbWl0LiAqL1xuICBmdW5jdGlvbiB2YWxpZGF0ZUNvbW1pdEFuZENvbGxlY3RFcnJvcnMoKSB7XG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgLy8gQ2hlY2tpbmcgcmV2ZXJ0LCBzcXVhc2gsIGZpeHVwIC8vXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbiAgICAvLyBBbGwgcmV2ZXJ0IGNvbW1pdHMgYXJlIGNvbnNpZGVyZWQgdmFsaWQuXG4gICAgaWYgKGNvbW1pdC5pc1JldmVydCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gQWxsIHNxdWFzaGVzIGFyZSBjb25zaWRlcmVkIHZhbGlkLCBhcyB0aGUgY29tbWl0IHdpbGwgYmUgc3F1YXNoZWQgaW50byBhbm90aGVyIGluXG4gICAgLy8gdGhlIGdpdCBoaXN0b3J5IGFueXdheSwgdW5sZXNzIHRoZSBvcHRpb25zIHByb3ZpZGVkIHRvIG5vdCBhbGxvdyBzcXVhc2ggY29tbWl0cy5cbiAgICBpZiAoY29tbWl0LmlzU3F1YXNoKSB7XG4gICAgICBpZiAob3B0aW9ucy5kaXNhbGxvd1NxdWFzaCkge1xuICAgICAgICBlcnJvcnMucHVzaCgnVGhlIGNvbW1pdCBtdXN0IGJlIG1hbnVhbGx5IHNxdWFzaGVkIGludG8gdGhlIHRhcmdldCBjb21taXQnKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gRml4dXBzIGNvbW1pdHMgYXJlIGNvbnNpZGVyZWQgdmFsaWQsIHVubGVzcyBub25GaXh1cENvbW1pdEhlYWRlcnMgYXJlIHByb3ZpZGVkIHRvIGNoZWNrXG4gICAgLy8gYWdhaW5zdC4gSWYgYG5vbkZpeHVwQ29tbWl0SGVhZGVyc2AgaXMgbm90IGVtcHR5LCB3ZSBjaGVjayB3aGV0aGVyIHRoZXJlIGlzIGEgY29ycmVzcG9uZGluZ1xuICAgIC8vIG5vbi1maXh1cCBjb21taXQgKGkuZS4gYSBjb21taXQgd2hvc2UgaGVhZGVyIGlzIGlkZW50aWNhbCB0byB0aGlzIGNvbW1pdCdzIGhlYWRlciBhZnRlclxuICAgIC8vIHN0cmlwcGluZyB0aGUgYGZpeHVwISBgIHByZWZpeCksIG90aGVyd2lzZSB3ZSBhc3N1bWUgdGhpcyB2ZXJpZmljYXRpb24gd2lsbCBoYXBwZW4gaW4gYW5vdGhlclxuICAgIC8vIGNoZWNrLlxuICAgIGlmIChjb21taXQuaXNGaXh1cCkge1xuICAgICAgaWYgKG9wdGlvbnMubm9uRml4dXBDb21taXRIZWFkZXJzICYmICFvcHRpb25zLm5vbkZpeHVwQ29tbWl0SGVhZGVycy5pbmNsdWRlcyhjb21taXQuaGVhZGVyKSkge1xuICAgICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgICAnVW5hYmxlIHRvIGZpbmQgbWF0Y2ggZm9yIGZpeHVwIGNvbW1pdCBhbW9uZyBwcmlvciBjb21taXRzOiAnICtcbiAgICAgICAgICAgIChvcHRpb25zLm5vbkZpeHVwQ29tbWl0SGVhZGVycy5tYXAoKHgpID0+IGBcXG4gICAgICAke3h9YCkuam9pbignJykgfHwgJy0nKSxcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgLy8gQ2hlY2tpbmcgY29tbWl0IGhlYWRlciAvL1xuICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICBpZiAoY29tbWl0LmhlYWRlci5sZW5ndGggPiBjb25maWcubWF4TGluZUxlbmd0aCkge1xuICAgICAgZXJyb3JzLnB1c2goYFRoZSBjb21taXQgbWVzc2FnZSBoZWFkZXIgaXMgbG9uZ2VyIHRoYW4gJHtjb25maWcubWF4TGluZUxlbmd0aH0gY2hhcmFjdGVyc2ApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmICghY29tbWl0LnR5cGUpIHtcbiAgICAgIGVycm9ycy5wdXNoKGBUaGUgY29tbWl0IG1lc3NhZ2UgaGVhZGVyIGRvZXMgbm90IG1hdGNoIHRoZSBleHBlY3RlZCBmb3JtYXQuYCk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKENPTU1JVF9UWVBFU1tjb21taXQudHlwZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgIGAnJHtjb21taXQudHlwZX0nIGlzIG5vdCBhbiBhbGxvd2VkIHR5cGUuXFxuID0+IFRZUEVTOiAke09iamVjdC5rZXlzKENPTU1JVF9UWVBFUykuam9pbihcbiAgICAgICAgICAnLCAnLFxuICAgICAgICApfWAsXG4gICAgICApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8qKiBUaGUgc2NvcGUgcmVxdWlyZW1lbnQgbGV2ZWwgZm9yIHRoZSBwcm92aWRlZCB0eXBlIG9mIHRoZSBjb21taXQgbWVzc2FnZS4gKi9cbiAgICBjb25zdCBzY29wZVJlcXVpcmVtZW50Rm9yVHlwZSA9IENPTU1JVF9UWVBFU1tjb21taXQudHlwZV0uc2NvcGU7XG5cbiAgICBpZiAoc2NvcGVSZXF1aXJlbWVudEZvclR5cGUgPT09IFNjb3BlUmVxdWlyZW1lbnQuRm9yYmlkZGVuICYmIGNvbW1pdC5zY29wZSkge1xuICAgICAgZXJyb3JzLnB1c2goXG4gICAgICAgIGBTY29wZXMgYXJlIGZvcmJpZGRlbiBmb3IgY29tbWl0cyB3aXRoIHR5cGUgJyR7Y29tbWl0LnR5cGV9JywgYnV0IGEgc2NvcGUgb2YgJyR7Y29tbWl0LnNjb3BlfScgd2FzIHByb3ZpZGVkLmAsXG4gICAgICApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChzY29wZVJlcXVpcmVtZW50Rm9yVHlwZSA9PT0gU2NvcGVSZXF1aXJlbWVudC5SZXF1aXJlZCAmJiAhY29tbWl0LnNjb3BlKSB7XG4gICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgYFNjb3BlcyBhcmUgcmVxdWlyZWQgZm9yIGNvbW1pdHMgd2l0aCB0eXBlICcke2NvbW1pdC50eXBlfScsIGJ1dCBubyBzY29wZSB3YXMgcHJvdmlkZWQuYCxcbiAgICAgICk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKGNvbW1pdC5zY29wZSAmJiAhY29uZmlnLnNjb3Blcy5pbmNsdWRlcyhjb21taXQuc2NvcGUpKSB7XG4gICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgYCcke2NvbW1pdC5zY29wZX0nIGlzIG5vdCBhbiBhbGxvd2VkIHNjb3BlLlxcbiA9PiBTQ09QRVM6ICR7Y29uZmlnLnNjb3Blcy5qb2luKCcsICcpfWAsXG4gICAgICApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIENvbW1pdHMgd2l0aCB0aGUgdHlwZSBvZiBgcmVsZWFzZWAgZG8gbm90IHJlcXVpcmUgYSBjb21taXQgYm9keS5cbiAgICBpZiAoY29tbWl0LnR5cGUgPT09ICdyZWxlYXNlJykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAvLyBDaGVja2luZyBjb21taXQgYm9keSAvL1xuICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbiAgICAvLyBEdWUgdG8gYW4gaXNzdWUgaW4gd2hpY2ggY29udmVudGlvbmFsLWNvbW1pdHMtcGFyc2VyIGNvbnNpZGVycyBhbGwgcGFydHMgb2YgYSBjb21taXQgYWZ0ZXJcbiAgICAvLyBhIGAjYCByZWZlcmVuY2UgdG8gYmUgdGhlIGZvb3Rlciwgd2UgY2hlY2sgdGhlIGxlbmd0aCBvZiBhbGwgb2YgdGhlIGNvbW1pdCBjb250ZW50IGFmdGVyIHRoZVxuICAgIC8vIGhlYWRlci4gSW4gdGhlIGZ1dHVyZSwgd2UgZXhwZWN0IHRvIGJlIGFibGUgdG8gY2hlY2sgb25seSB0aGUgYm9keSBvbmNlIHRoZSBwYXJzZXIgcHJvcGVybHlcbiAgICAvLyBoYW5kbGVzIHRoaXMgY2FzZS5cbiAgICBjb25zdCBhbGxOb25IZWFkZXJDb250ZW50ID0gYCR7Y29tbWl0LmJvZHkudHJpbSgpfVxcbiR7Y29tbWl0LmZvb3Rlci50cmltKCl9YDtcblxuICAgIGlmIChcbiAgICAgICFjb25maWcubWluQm9keUxlbmd0aFR5cGVFeGNsdWRlcz8uaW5jbHVkZXMoY29tbWl0LnR5cGUpICYmXG4gICAgICBhbGxOb25IZWFkZXJDb250ZW50Lmxlbmd0aCA8IGNvbmZpZy5taW5Cb2R5TGVuZ3RoXG4gICAgKSB7XG4gICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgYFRoZSBjb21taXQgbWVzc2FnZSBib2R5IGRvZXMgbm90IG1lZXQgdGhlIG1pbmltdW0gbGVuZ3RoIG9mICR7Y29uZmlnLm1pbkJvZHlMZW5ndGh9IGNoYXJhY3RlcnNgLFxuICAgICAgKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBib2R5QnlMaW5lID0gY29tbWl0LmJvZHkuc3BsaXQoJ1xcbicpO1xuICAgIGNvbnN0IGxpbmVFeGNlZWRzTWF4TGVuZ3RoID0gYm9keUJ5TGluZS5zb21lKChsaW5lOiBzdHJpbmcpID0+IHtcbiAgICAgIC8vIENoZWNrIGlmIGFueSBsaW5lIGV4Y2VlZHMgdGhlIG1heCBsaW5lIGxlbmd0aCBsaW1pdC4gVGhlIGxpbWl0IGlzIGlnbm9yZWQgZm9yXG4gICAgICAvLyBsaW5lcyB0aGF0IGp1c3QgY29udGFpbiBhbiBVUkwgKGFzIHRoZXNlIHVzdWFsbHkgY2Fubm90IGJlIHdyYXBwZWQgb3Igc2hvcnRlbmVkKS5cbiAgICAgIHJldHVybiBsaW5lLmxlbmd0aCA+IGNvbmZpZy5tYXhMaW5lTGVuZ3RoICYmICFDT01NSVRfQk9EWV9VUkxfTElORV9SRS50ZXN0KGxpbmUpO1xuICAgIH0pO1xuXG4gICAgaWYgKGxpbmVFeGNlZWRzTWF4TGVuZ3RoKSB7XG4gICAgICBlcnJvcnMucHVzaChcbiAgICAgICAgYFRoZSBjb21taXQgbWVzc2FnZSBib2R5IGNvbnRhaW5zIGxpbmVzIGdyZWF0ZXIgdGhhbiAke2NvbmZpZy5tYXhMaW5lTGVuZ3RofSBjaGFyYWN0ZXJzLmAsXG4gICAgICApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIEJyZWFraW5nIGNoYW5nZVxuICAgIC8vIENoZWNrIGlmIHRoZSBjb21taXQgbWVzc2FnZSBjb250YWlucyBhIHZhbGlkIGJyZWFrIGNoYW5nZSBkZXNjcmlwdGlvbi5cbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL2Jsb2IvODhmYmMwNjY3NzVhYjFhMmY2YThjNzVmOTMzMzc1YjQ2ZDhmYTlhNC9DT05UUklCVVRJTkcubWQjY29tbWl0LW1lc3NhZ2UtZm9vdGVyXG4gICAgaWYgKElOQ09SUkVDVF9CUkVBS0lOR19DSEFOR0VfQk9EWV9SRS50ZXN0KGNvbW1pdC5mdWxsVGV4dCkpIHtcbiAgICAgIGVycm9ycy5wdXNoKGBUaGUgY29tbWl0IG1lc3NhZ2UgYm9keSBjb250YWlucyBhbiBpbnZhbGlkIGJyZWFraW5nIGNoYW5nZSBub3RlLmApO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChJTkNPUlJFQ1RfREVQUkVDQVRJT05fQk9EWV9SRS50ZXN0KGNvbW1pdC5mdWxsVGV4dCkpIHtcbiAgICAgIGVycm9ycy5wdXNoKGBUaGUgY29tbWl0IG1lc3NhZ2UgYm9keSBjb250YWlucyBhbiBpbnZhbGlkIGRlcHJlY2F0aW9uIG5vdGUuYCk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4ge3ZhbGlkOiB2YWxpZGF0ZUNvbW1pdEFuZENvbGxlY3RFcnJvcnMoKSwgZXJyb3JzLCBjb21taXR9O1xufVxuXG4vKiogUHJpbnQgdGhlIGVycm9yIG1lc3NhZ2VzIGZyb20gdGhlIGNvbW1pdCBtZXNzYWdlIHZhbGlkYXRpb24gdG8gdGhlIGNvbnNvbGUuICovXG5leHBvcnQgZnVuY3Rpb24gcHJpbnRWYWxpZGF0aW9uRXJyb3JzKGVycm9yczogc3RyaW5nW10sIHByaW50ID0gTG9nLmVycm9yKSB7XG4gIHByaW50Lmdyb3VwKGBFcnJvciR7ZXJyb3JzLmxlbmd0aCA9PT0gMSA/ICcnIDogJ3MnfTpgKTtcbiAgZXJyb3JzLmZvckVhY2goKGxpbmUpID0+IHByaW50KGxpbmUpKTtcbiAgcHJpbnQuZ3JvdXBFbmQoKTtcbiAgcHJpbnQoKTtcbiAgcHJpbnQoJ1RoZSBleHBlY3RlZCBmb3JtYXQgZm9yIGEgY29tbWl0IGlzOiAnKTtcbiAgcHJpbnQoJzx0eXBlPig8c2NvcGU+KTogPHN1bW1hcnk+Jyk7XG4gIHByaW50KCk7XG4gIHByaW50KCc8Ym9keT4nKTtcbiAgcHJpbnQoKTtcbiAgcHJpbnQoYEJSRUFLSU5HIENIQU5HRTogPGJyZWFraW5nIGNoYW5nZSBzdW1tYXJ5PmApO1xuICBwcmludCgpO1xuICBwcmludChgPGJyZWFraW5nIGNoYW5nZSBkZXNjcmlwdGlvbj5gKTtcbiAgcHJpbnQoKTtcbiAgcHJpbnQoKTtcbn1cbiJdfQ==