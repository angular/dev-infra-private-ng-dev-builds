#!/usr/bin/env node
"use strict";
/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * Script that can be passed as commit message filter to `git filter-branch --msg-filter`.
 * The script rewrites commit messages to contain a Github instruction to close the
 * corresponding pull request. For more details. See: https://git.io/Jv64r.
 */
main();
function main() {
    const [prNumber] = process.argv.slice(2);
    if (!prNumber) {
        console.error('No pull request number specified.');
        process.exit(1);
    }
    let commitMessage = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
        const chunk = process.stdin.read();
        if (chunk !== null) {
            commitMessage += chunk;
        }
    });
    process.stdin.on('end', () => {
        console.info(rewriteCommitMessage(commitMessage, prNumber));
    });
}
function rewriteCommitMessage(message, prNumber) {
    const lines = message.split(/\n/);
    lines.push(`Closes #${prNumber} as a pr takeover`);
    return lines.join('\n');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWl0LW1lc3NhZ2UtZmlsdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL2NoZWNrb3V0L2NvbW1pdC1tZXNzYWdlLWZpbHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUVBOzs7Ozs7R0FNRztBQUVIOzs7O0dBSUc7QUFFSCxJQUFJLEVBQUUsQ0FBQztBQUVQLFNBQVMsSUFBSTtJQUNYLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN6QyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDZCxPQUFPLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7UUFDbkQsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsQixDQUFDO0lBRUQsSUFBSSxhQUFhLEdBQUcsRUFBRSxDQUFDO0lBQ3ZCLE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2xDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxHQUFHLEVBQUU7UUFDaEMsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNuQyxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUNuQixhQUFhLElBQUksS0FBSyxDQUFDO1FBQ3pCLENBQUM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUU7UUFDM0IsT0FBTyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxhQUFhLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUM5RCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxTQUFTLG9CQUFvQixDQUFDLE9BQWUsRUFBRSxRQUFnQjtJQUM3RCxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2xDLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVyxRQUFRLG1CQUFtQixDQUFDLENBQUM7SUFDbkQsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5cbi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vKipcbiAqIFNjcmlwdCB0aGF0IGNhbiBiZSBwYXNzZWQgYXMgY29tbWl0IG1lc3NhZ2UgZmlsdGVyIHRvIGBnaXQgZmlsdGVyLWJyYW5jaCAtLW1zZy1maWx0ZXJgLlxuICogVGhlIHNjcmlwdCByZXdyaXRlcyBjb21taXQgbWVzc2FnZXMgdG8gY29udGFpbiBhIEdpdGh1YiBpbnN0cnVjdGlvbiB0byBjbG9zZSB0aGVcbiAqIGNvcnJlc3BvbmRpbmcgcHVsbCByZXF1ZXN0LiBGb3IgbW9yZSBkZXRhaWxzLiBTZWU6IGh0dHBzOi8vZ2l0LmlvL0p2NjRyLlxuICovXG5cbm1haW4oKTtcblxuZnVuY3Rpb24gbWFpbigpIHtcbiAgY29uc3QgW3ByTnVtYmVyXSA9IHByb2Nlc3MuYXJndi5zbGljZSgyKTtcbiAgaWYgKCFwck51bWJlcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ05vIHB1bGwgcmVxdWVzdCBudW1iZXIgc3BlY2lmaWVkLicpO1xuICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgfVxuXG4gIGxldCBjb21taXRNZXNzYWdlID0gJyc7XG4gIHByb2Nlc3Muc3RkaW4uc2V0RW5jb2RpbmcoJ3V0ZjgnKTtcbiAgcHJvY2Vzcy5zdGRpbi5vbigncmVhZGFibGUnLCAoKSA9PiB7XG4gICAgY29uc3QgY2h1bmsgPSBwcm9jZXNzLnN0ZGluLnJlYWQoKTtcbiAgICBpZiAoY2h1bmsgIT09IG51bGwpIHtcbiAgICAgIGNvbW1pdE1lc3NhZ2UgKz0gY2h1bms7XG4gICAgfVxuICB9KTtcblxuICBwcm9jZXNzLnN0ZGluLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgY29uc29sZS5pbmZvKHJld3JpdGVDb21taXRNZXNzYWdlKGNvbW1pdE1lc3NhZ2UsIHByTnVtYmVyKSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZXdyaXRlQ29tbWl0TWVzc2FnZShtZXNzYWdlOiBzdHJpbmcsIHByTnVtYmVyOiBzdHJpbmcpIHtcbiAgY29uc3QgbGluZXMgPSBtZXNzYWdlLnNwbGl0KC9cXG4vKTtcbiAgbGluZXMucHVzaChgQ2xvc2VzICMke3ByTnVtYmVyfSBhcyBhIHByIHRha2VvdmVyYCk7XG4gIHJldHVybiBsaW5lcy5qb2luKCdcXG4nKTtcbn1cbiJdfQ==