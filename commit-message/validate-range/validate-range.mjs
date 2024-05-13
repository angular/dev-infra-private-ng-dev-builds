/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { green, Log } from '../../utils/logging.js';
import { getCommitsInRange } from '../utils.js';
import { printValidationErrors, validateCommitMessage, } from '../validate.js';
// Whether the provided commit is a fixup commit.
const isNonFixup = (commit) => !commit.isFixup;
// Extracts commit header (first line of commit message).
const extractCommitHeader = (commit) => commit.header;
/** Validate all commits in a provided git commit range. */
export async function validateCommitRange(from, to) {
    /** A list of tuples of the commit header string and a list of error messages for the commit. */
    const errors = [];
    /** A list of parsed commit messages from the range. */
    const commits = await getCommitsInRange(from, to);
    Log.info(`Examining ${commits.length} commit(s) in the provided range: ${from}..${to}`);
    /**
     * Whether all commits in the range are valid, commits are allowed to be fixup commits for other
     * commits in the provided commit range.
     */
    let allCommitsInRangeValid = true;
    for (let i = 0; i < commits.length; i++) {
        const commit = commits[i];
        const options = {
            disallowSquash: true,
            nonFixupCommitHeaders: isNonFixup(commit)
                ? undefined
                : commits
                    .slice(i + 1)
                    .filter(isNonFixup)
                    .map(extractCommitHeader),
        };
        const { valid, errors: localErrors } = await validateCommitMessage(commit, options);
        if (localErrors.length) {
            errors.push([commit.header, localErrors]);
        }
        allCommitsInRangeValid = allCommitsInRangeValid && valid;
    }
    if (allCommitsInRangeValid) {
        Log.info(green('√  All commit messages in range valid.'));
    }
    else {
        Log.error('✘  Invalid commit message');
        errors.forEach(([header, validationErrors]) => {
            Log.error.group(header);
            printValidationErrors(validationErrors);
            Log.error.groupEnd();
        });
        // Exit with a non-zero exit code if invalid commit messages have
        // been discovered.
        process.exit(1);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdGUtcmFuZ2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvY29tbWl0LW1lc3NhZ2UvdmFsaWRhdGUtcmFuZ2UvdmFsaWRhdGUtcmFuZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxFQUFDLEtBQUssRUFBRSxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUVsRCxPQUFPLEVBQUMsaUJBQWlCLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDOUMsT0FBTyxFQUNMLHFCQUFxQixFQUNyQixxQkFBcUIsR0FFdEIsTUFBTSxnQkFBZ0IsQ0FBQztBQUV4QixpREFBaUQ7QUFDakQsTUFBTSxVQUFVLEdBQUcsQ0FBQyxNQUFjLEVBQUUsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztBQUV2RCx5REFBeUQ7QUFDekQsTUFBTSxtQkFBbUIsR0FBRyxDQUFDLE1BQWMsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztBQUU5RCwyREFBMkQ7QUFDM0QsTUFBTSxDQUFDLEtBQUssVUFBVSxtQkFBbUIsQ0FBQyxJQUFZLEVBQUUsRUFBVTtJQUNoRSxnR0FBZ0c7SUFDaEcsTUFBTSxNQUFNLEdBQStDLEVBQUUsQ0FBQztJQUU5RCx1REFBdUQ7SUFDdkQsTUFBTSxPQUFPLEdBQUcsTUFBTSxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDbEQsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLE9BQU8sQ0FBQyxNQUFNLHFDQUFxQyxJQUFJLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUV4Rjs7O09BR0c7SUFDSCxJQUFJLHNCQUFzQixHQUFHLElBQUksQ0FBQztJQUVsQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ3hDLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMxQixNQUFNLE9BQU8sR0FBaUM7WUFDNUMsY0FBYyxFQUFFLElBQUk7WUFDcEIscUJBQXFCLEVBQUUsVUFBVSxDQUFDLE1BQU0sQ0FBQztnQkFDdkMsQ0FBQyxDQUFDLFNBQVM7Z0JBQ1gsQ0FBQyxDQUFDLE9BQU87cUJBQ0osS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7cUJBQ1osTUFBTSxDQUFDLFVBQVUsQ0FBQztxQkFDbEIsR0FBRyxDQUFDLG1CQUFtQixDQUFDO1NBQ2hDLENBQUM7UUFFRixNQUFNLEVBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUMsR0FBRyxNQUFNLHFCQUFxQixDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNsRixJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN2QixNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFFRCxzQkFBc0IsR0FBRyxzQkFBc0IsSUFBSSxLQUFLLENBQUM7SUFDM0QsQ0FBQztJQUVELElBQUksc0JBQXNCLEVBQUUsQ0FBQztRQUMzQixHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDLENBQUM7SUFDNUQsQ0FBQztTQUFNLENBQUM7UUFDTixHQUFHLENBQUMsS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFDdkMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLGdCQUFnQixDQUFDLEVBQUUsRUFBRTtZQUM1QyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN4QixxQkFBcUIsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ3hDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDdkIsQ0FBQyxDQUFDLENBQUM7UUFDSCxpRUFBaUU7UUFDakUsbUJBQW1CO1FBQ25CLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEIsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7Z3JlZW4sIExvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge0NvbW1pdH0gZnJvbSAnLi4vcGFyc2UuanMnO1xuaW1wb3J0IHtnZXRDb21taXRzSW5SYW5nZX0gZnJvbSAnLi4vdXRpbHMuanMnO1xuaW1wb3J0IHtcbiAgcHJpbnRWYWxpZGF0aW9uRXJyb3JzLFxuICB2YWxpZGF0ZUNvbW1pdE1lc3NhZ2UsXG4gIFZhbGlkYXRlQ29tbWl0TWVzc2FnZU9wdGlvbnMsXG59IGZyb20gJy4uL3ZhbGlkYXRlLmpzJztcblxuLy8gV2hldGhlciB0aGUgcHJvdmlkZWQgY29tbWl0IGlzIGEgZml4dXAgY29tbWl0LlxuY29uc3QgaXNOb25GaXh1cCA9IChjb21taXQ6IENvbW1pdCkgPT4gIWNvbW1pdC5pc0ZpeHVwO1xuXG4vLyBFeHRyYWN0cyBjb21taXQgaGVhZGVyIChmaXJzdCBsaW5lIG9mIGNvbW1pdCBtZXNzYWdlKS5cbmNvbnN0IGV4dHJhY3RDb21taXRIZWFkZXIgPSAoY29tbWl0OiBDb21taXQpID0+IGNvbW1pdC5oZWFkZXI7XG5cbi8qKiBWYWxpZGF0ZSBhbGwgY29tbWl0cyBpbiBhIHByb3ZpZGVkIGdpdCBjb21taXQgcmFuZ2UuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdmFsaWRhdGVDb21taXRSYW5nZShmcm9tOiBzdHJpbmcsIHRvOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgLyoqIEEgbGlzdCBvZiB0dXBsZXMgb2YgdGhlIGNvbW1pdCBoZWFkZXIgc3RyaW5nIGFuZCBhIGxpc3Qgb2YgZXJyb3IgbWVzc2FnZXMgZm9yIHRoZSBjb21taXQuICovXG4gIGNvbnN0IGVycm9yczogW2NvbW1pdEhlYWRlcjogc3RyaW5nLCBlcnJvcnM6IHN0cmluZ1tdXVtdID0gW107XG5cbiAgLyoqIEEgbGlzdCBvZiBwYXJzZWQgY29tbWl0IG1lc3NhZ2VzIGZyb20gdGhlIHJhbmdlLiAqL1xuICBjb25zdCBjb21taXRzID0gYXdhaXQgZ2V0Q29tbWl0c0luUmFuZ2UoZnJvbSwgdG8pO1xuICBMb2cuaW5mbyhgRXhhbWluaW5nICR7Y29tbWl0cy5sZW5ndGh9IGNvbW1pdChzKSBpbiB0aGUgcHJvdmlkZWQgcmFuZ2U6ICR7ZnJvbX0uLiR7dG99YCk7XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgYWxsIGNvbW1pdHMgaW4gdGhlIHJhbmdlIGFyZSB2YWxpZCwgY29tbWl0cyBhcmUgYWxsb3dlZCB0byBiZSBmaXh1cCBjb21taXRzIGZvciBvdGhlclxuICAgKiBjb21taXRzIGluIHRoZSBwcm92aWRlZCBjb21taXQgcmFuZ2UuXG4gICAqL1xuICBsZXQgYWxsQ29tbWl0c0luUmFuZ2VWYWxpZCA9IHRydWU7XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb21taXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY29tbWl0ID0gY29tbWl0c1tpXTtcbiAgICBjb25zdCBvcHRpb25zOiBWYWxpZGF0ZUNvbW1pdE1lc3NhZ2VPcHRpb25zID0ge1xuICAgICAgZGlzYWxsb3dTcXVhc2g6IHRydWUsXG4gICAgICBub25GaXh1cENvbW1pdEhlYWRlcnM6IGlzTm9uRml4dXAoY29tbWl0KVxuICAgICAgICA/IHVuZGVmaW5lZFxuICAgICAgICA6IGNvbW1pdHNcbiAgICAgICAgICAgIC5zbGljZShpICsgMSlcbiAgICAgICAgICAgIC5maWx0ZXIoaXNOb25GaXh1cClcbiAgICAgICAgICAgIC5tYXAoZXh0cmFjdENvbW1pdEhlYWRlciksXG4gICAgfTtcblxuICAgIGNvbnN0IHt2YWxpZCwgZXJyb3JzOiBsb2NhbEVycm9yc30gPSBhd2FpdCB2YWxpZGF0ZUNvbW1pdE1lc3NhZ2UoY29tbWl0LCBvcHRpb25zKTtcbiAgICBpZiAobG9jYWxFcnJvcnMubGVuZ3RoKSB7XG4gICAgICBlcnJvcnMucHVzaChbY29tbWl0LmhlYWRlciwgbG9jYWxFcnJvcnNdKTtcbiAgICB9XG5cbiAgICBhbGxDb21taXRzSW5SYW5nZVZhbGlkID0gYWxsQ29tbWl0c0luUmFuZ2VWYWxpZCAmJiB2YWxpZDtcbiAgfVxuXG4gIGlmIChhbGxDb21taXRzSW5SYW5nZVZhbGlkKSB7XG4gICAgTG9nLmluZm8oZ3JlZW4oJ+KImiAgQWxsIGNvbW1pdCBtZXNzYWdlcyBpbiByYW5nZSB2YWxpZC4nKSk7XG4gIH0gZWxzZSB7XG4gICAgTG9nLmVycm9yKCfinJggIEludmFsaWQgY29tbWl0IG1lc3NhZ2UnKTtcbiAgICBlcnJvcnMuZm9yRWFjaCgoW2hlYWRlciwgdmFsaWRhdGlvbkVycm9yc10pID0+IHtcbiAgICAgIExvZy5lcnJvci5ncm91cChoZWFkZXIpO1xuICAgICAgcHJpbnRWYWxpZGF0aW9uRXJyb3JzKHZhbGlkYXRpb25FcnJvcnMpO1xuICAgICAgTG9nLmVycm9yLmdyb3VwRW5kKCk7XG4gICAgfSk7XG4gICAgLy8gRXhpdCB3aXRoIGEgbm9uLXplcm8gZXhpdCBjb2RlIGlmIGludmFsaWQgY29tbWl0IG1lc3NhZ2VzIGhhdmVcbiAgICAvLyBiZWVuIGRpc2NvdmVyZWQuXG4gICAgcHJvY2Vzcy5leGl0KDEpO1xuICB9XG59XG4iXX0=