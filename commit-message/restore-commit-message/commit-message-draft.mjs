/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
/** Load the commit message draft from the file system if it exists. */
export function loadCommitMessageDraft(basePath) {
    const commitMessageDraftPath = `${basePath}.ngDevSave`;
    if (existsSync(commitMessageDraftPath)) {
        return readFileSync(commitMessageDraftPath).toString();
    }
    return '';
}
/** Remove the commit message draft from the file system. */
export function deleteCommitMessageDraft(basePath) {
    const commitMessageDraftPath = `${basePath}.ngDevSave`;
    if (existsSync(commitMessageDraftPath)) {
        unlinkSync(commitMessageDraftPath);
    }
}
/** Save the commit message draft to the file system for later retrieval. */
export function saveCommitMessageDraft(basePath, commitMessage) {
    writeFileSync(`${basePath}.ngDevSave`, commitMessage);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWl0LW1lc3NhZ2UtZHJhZnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvY29tbWl0LW1lc3NhZ2UvcmVzdG9yZS1jb21taXQtbWVzc2FnZS9jb21taXQtbWVzc2FnZS1kcmFmdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLEVBQUMsVUFBVSxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFDLE1BQU0sSUFBSSxDQUFDO0FBRXZFLHVFQUF1RTtBQUN2RSxNQUFNLFVBQVUsc0JBQXNCLENBQUMsUUFBZ0I7SUFDckQsTUFBTSxzQkFBc0IsR0FBRyxHQUFHLFFBQVEsWUFBWSxDQUFDO0lBQ3ZELElBQUksVUFBVSxDQUFDLHNCQUFzQixDQUFDLEVBQUUsQ0FBQztRQUN2QyxPQUFPLFlBQVksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ3pELENBQUM7SUFDRCxPQUFPLEVBQUUsQ0FBQztBQUNaLENBQUM7QUFFRCw0REFBNEQ7QUFDNUQsTUFBTSxVQUFVLHdCQUF3QixDQUFDLFFBQWdCO0lBQ3ZELE1BQU0sc0JBQXNCLEdBQUcsR0FBRyxRQUFRLFlBQVksQ0FBQztJQUN2RCxJQUFJLFVBQVUsQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFLENBQUM7UUFDdkMsVUFBVSxDQUFDLHNCQUFzQixDQUFDLENBQUM7SUFDckMsQ0FBQztBQUNILENBQUM7QUFFRCw0RUFBNEU7QUFDNUUsTUFBTSxVQUFVLHNCQUFzQixDQUFDLFFBQWdCLEVBQUUsYUFBcUI7SUFDNUUsYUFBYSxDQUFDLEdBQUcsUUFBUSxZQUFZLEVBQUUsYUFBYSxDQUFDLENBQUM7QUFDeEQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtleGlzdHNTeW5jLCByZWFkRmlsZVN5bmMsIHVubGlua1N5bmMsIHdyaXRlRmlsZVN5bmN9IGZyb20gJ2ZzJztcblxuLyoqIExvYWQgdGhlIGNvbW1pdCBtZXNzYWdlIGRyYWZ0IGZyb20gdGhlIGZpbGUgc3lzdGVtIGlmIGl0IGV4aXN0cy4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsb2FkQ29tbWl0TWVzc2FnZURyYWZ0KGJhc2VQYXRoOiBzdHJpbmcpIHtcbiAgY29uc3QgY29tbWl0TWVzc2FnZURyYWZ0UGF0aCA9IGAke2Jhc2VQYXRofS5uZ0RldlNhdmVgO1xuICBpZiAoZXhpc3RzU3luYyhjb21taXRNZXNzYWdlRHJhZnRQYXRoKSkge1xuICAgIHJldHVybiByZWFkRmlsZVN5bmMoY29tbWl0TWVzc2FnZURyYWZ0UGF0aCkudG9TdHJpbmcoKTtcbiAgfVxuICByZXR1cm4gJyc7XG59XG5cbi8qKiBSZW1vdmUgdGhlIGNvbW1pdCBtZXNzYWdlIGRyYWZ0IGZyb20gdGhlIGZpbGUgc3lzdGVtLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlbGV0ZUNvbW1pdE1lc3NhZ2VEcmFmdChiYXNlUGF0aDogc3RyaW5nKSB7XG4gIGNvbnN0IGNvbW1pdE1lc3NhZ2VEcmFmdFBhdGggPSBgJHtiYXNlUGF0aH0ubmdEZXZTYXZlYDtcbiAgaWYgKGV4aXN0c1N5bmMoY29tbWl0TWVzc2FnZURyYWZ0UGF0aCkpIHtcbiAgICB1bmxpbmtTeW5jKGNvbW1pdE1lc3NhZ2VEcmFmdFBhdGgpO1xuICB9XG59XG5cbi8qKiBTYXZlIHRoZSBjb21taXQgbWVzc2FnZSBkcmFmdCB0byB0aGUgZmlsZSBzeXN0ZW0gZm9yIGxhdGVyIHJldHJpZXZhbC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzYXZlQ29tbWl0TWVzc2FnZURyYWZ0KGJhc2VQYXRoOiBzdHJpbmcsIGNvbW1pdE1lc3NhZ2U6IHN0cmluZykge1xuICB3cml0ZUZpbGVTeW5jKGAke2Jhc2VQYXRofS5uZ0RldlNhdmVgLCBjb21taXRNZXNzYWdlKTtcbn1cbiJdfQ==