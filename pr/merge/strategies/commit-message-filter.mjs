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
    // Add the pull request number to the commit message title. This matches what
    // Github does when PRs are merged on the web through the `Squash and Merge` button.
    lines[0] += ` (#${prNumber})`;
    // Push a new line that instructs Github to close the specified pull request.
    lines.push(`PR Close #${prNumber}`);
    return lines.join('\n');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWl0LW1lc3NhZ2UtZmlsdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL21lcmdlL3N0cmF0ZWdpZXMvY29tbWl0LW1lc3NhZ2UtZmlsdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBRUE7Ozs7OztHQU1HO0FBRUg7Ozs7R0FJRztBQUVILElBQUksRUFBRSxDQUFDO0FBRVAsU0FBUyxJQUFJO0lBQ1gsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3pDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNkLE9BQU8sQ0FBQyxLQUFLLENBQUMsbUNBQW1DLENBQUMsQ0FBQztRQUNuRCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xCLENBQUM7SUFFRCxJQUFJLGFBQWEsR0FBRyxFQUFFLENBQUM7SUFDdkIsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsVUFBVSxFQUFFLEdBQUcsRUFBRTtRQUNoQyxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ25DLElBQUksS0FBSyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ25CLGFBQWEsSUFBSSxLQUFLLENBQUM7UUFDekIsQ0FBQztJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRTtRQUMzQixPQUFPLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGFBQWEsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQzlELENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELFNBQVMsb0JBQW9CLENBQUMsT0FBZSxFQUFFLFFBQWdCO0lBQzdELE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbEMsNkVBQTZFO0lBQzdFLG9GQUFvRjtJQUNwRixLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxRQUFRLEdBQUcsQ0FBQztJQUM5Qiw2RUFBNkU7SUFDN0UsS0FBSyxDQUFDLElBQUksQ0FBQyxhQUFhLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDcEMsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5cbi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vKipcbiAqIFNjcmlwdCB0aGF0IGNhbiBiZSBwYXNzZWQgYXMgY29tbWl0IG1lc3NhZ2UgZmlsdGVyIHRvIGBnaXQgZmlsdGVyLWJyYW5jaCAtLW1zZy1maWx0ZXJgLlxuICogVGhlIHNjcmlwdCByZXdyaXRlcyBjb21taXQgbWVzc2FnZXMgdG8gY29udGFpbiBhIEdpdGh1YiBpbnN0cnVjdGlvbiB0byBjbG9zZSB0aGVcbiAqIGNvcnJlc3BvbmRpbmcgcHVsbCByZXF1ZXN0LiBGb3IgbW9yZSBkZXRhaWxzLiBTZWU6IGh0dHBzOi8vZ2l0LmlvL0p2NjRyLlxuICovXG5cbm1haW4oKTtcblxuZnVuY3Rpb24gbWFpbigpIHtcbiAgY29uc3QgW3ByTnVtYmVyXSA9IHByb2Nlc3MuYXJndi5zbGljZSgyKTtcbiAgaWYgKCFwck51bWJlcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ05vIHB1bGwgcmVxdWVzdCBudW1iZXIgc3BlY2lmaWVkLicpO1xuICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgfVxuXG4gIGxldCBjb21taXRNZXNzYWdlID0gJyc7XG4gIHByb2Nlc3Muc3RkaW4uc2V0RW5jb2RpbmcoJ3V0ZjgnKTtcbiAgcHJvY2Vzcy5zdGRpbi5vbigncmVhZGFibGUnLCAoKSA9PiB7XG4gICAgY29uc3QgY2h1bmsgPSBwcm9jZXNzLnN0ZGluLnJlYWQoKTtcbiAgICBpZiAoY2h1bmsgIT09IG51bGwpIHtcbiAgICAgIGNvbW1pdE1lc3NhZ2UgKz0gY2h1bms7XG4gICAgfVxuICB9KTtcblxuICBwcm9jZXNzLnN0ZGluLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgY29uc29sZS5pbmZvKHJld3JpdGVDb21taXRNZXNzYWdlKGNvbW1pdE1lc3NhZ2UsIHByTnVtYmVyKSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZXdyaXRlQ29tbWl0TWVzc2FnZShtZXNzYWdlOiBzdHJpbmcsIHByTnVtYmVyOiBzdHJpbmcpIHtcbiAgY29uc3QgbGluZXMgPSBtZXNzYWdlLnNwbGl0KC9cXG4vKTtcbiAgLy8gQWRkIHRoZSBwdWxsIHJlcXVlc3QgbnVtYmVyIHRvIHRoZSBjb21taXQgbWVzc2FnZSB0aXRsZS4gVGhpcyBtYXRjaGVzIHdoYXRcbiAgLy8gR2l0aHViIGRvZXMgd2hlbiBQUnMgYXJlIG1lcmdlZCBvbiB0aGUgd2ViIHRocm91Z2ggdGhlIGBTcXVhc2ggYW5kIE1lcmdlYCBidXR0b24uXG4gIGxpbmVzWzBdICs9IGAgKCMke3ByTnVtYmVyfSlgO1xuICAvLyBQdXNoIGEgbmV3IGxpbmUgdGhhdCBpbnN0cnVjdHMgR2l0aHViIHRvIGNsb3NlIHRoZSBzcGVjaWZpZWQgcHVsbCByZXF1ZXN0LlxuICBsaW5lcy5wdXNoKGBQUiBDbG9zZSAjJHtwck51bWJlcn1gKTtcbiAgcmV0dXJuIGxpbmVzLmpvaW4oJ1xcbicpO1xufVxuIl19