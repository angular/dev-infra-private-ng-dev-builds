/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { writeFileSync } from 'fs';
import { Log } from '../../utils/logging.js';
import { loadCommitMessageDraft } from './commit-message-draft.js';
/**
 * Restore the commit message draft to the git to be used as the default commit message.
 *
 * The source provided may be one of the sources described in
 *   https://git-scm.com/docs/githooks#_prepare_commit_msg
 */
export function restoreCommitMessage(filePath, source) {
    if (!!source) {
        if (source === 'message') {
            Log.debug('A commit message was already provided via the command with a -m or -F flag');
        }
        if (source === 'template') {
            Log.debug('A commit message was already provided via the -t flag or config.template setting');
        }
        if (source === 'squash') {
            Log.debug('A commit message was already provided as a merge action or via .git/MERGE_MSG');
        }
        if (source === 'commit') {
            Log.debug('A commit message was already provided through a revision specified via --fixup, -c,');
            Log.debug('-C or --amend flag');
        }
        process.exit(0);
    }
    /** A draft of a commit message. */
    const commitMessage = loadCommitMessageDraft(filePath);
    // If the commit message draft has content, restore it into the provided filepath.
    if (commitMessage) {
        writeFileSync(filePath, commitMessage);
    }
    // Exit the process
    process.exit(0);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzdG9yZS1jb21taXQtbWVzc2FnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9jb21taXQtbWVzc2FnZS9yZXN0b3JlLWNvbW1pdC1tZXNzYWdlL3Jlc3RvcmUtY29tbWl0LW1lc3NhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLElBQUksQ0FBQztBQUVqQyxPQUFPLEVBQUMsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFM0MsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sMkJBQTJCLENBQUM7QUFHakU7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUsb0JBQW9CLENBQUMsUUFBZ0IsRUFBRSxNQUF3QjtJQUM3RSxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNiLElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ3pCLEdBQUcsQ0FBQyxLQUFLLENBQUMsNEVBQTRFLENBQUMsQ0FBQztRQUMxRixDQUFDO1FBQ0QsSUFBSSxNQUFNLEtBQUssVUFBVSxFQUFFLENBQUM7WUFDMUIsR0FBRyxDQUFDLEtBQUssQ0FBQyxrRkFBa0YsQ0FBQyxDQUFDO1FBQ2hHLENBQUM7UUFDRCxJQUFJLE1BQU0sS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUN4QixHQUFHLENBQUMsS0FBSyxDQUFDLCtFQUErRSxDQUFDLENBQUM7UUFDN0YsQ0FBQztRQUNELElBQUksTUFBTSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ3hCLEdBQUcsQ0FBQyxLQUFLLENBQ1AscUZBQXFGLENBQ3RGLENBQUM7WUFDRixHQUFHLENBQUMsS0FBSyxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDbEMsQ0FBQztRQUNELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEIsQ0FBQztJQUNELG1DQUFtQztJQUNuQyxNQUFNLGFBQWEsR0FBRyxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUV2RCxrRkFBa0Y7SUFDbEYsSUFBSSxhQUFhLEVBQUUsQ0FBQztRQUNsQixhQUFhLENBQUMsUUFBUSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFDRCxtQkFBbUI7SUFDbkIsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7d3JpdGVGaWxlU3luY30gZnJvbSAnZnMnO1xuXG5pbXBvcnQge0xvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5cbmltcG9ydCB7bG9hZENvbW1pdE1lc3NhZ2VEcmFmdH0gZnJvbSAnLi9jb21taXQtbWVzc2FnZS1kcmFmdC5qcyc7XG5pbXBvcnQge0NvbW1pdE1zZ1NvdXJjZX0gZnJvbSAnLi9jb21taXQtbWVzc2FnZS1zb3VyY2UuanMnO1xuXG4vKipcbiAqIFJlc3RvcmUgdGhlIGNvbW1pdCBtZXNzYWdlIGRyYWZ0IHRvIHRoZSBnaXQgdG8gYmUgdXNlZCBhcyB0aGUgZGVmYXVsdCBjb21taXQgbWVzc2FnZS5cbiAqXG4gKiBUaGUgc291cmNlIHByb3ZpZGVkIG1heSBiZSBvbmUgb2YgdGhlIHNvdXJjZXMgZGVzY3JpYmVkIGluXG4gKiAgIGh0dHBzOi8vZ2l0LXNjbS5jb20vZG9jcy9naXRob29rcyNfcHJlcGFyZV9jb21taXRfbXNnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXN0b3JlQ29tbWl0TWVzc2FnZShmaWxlUGF0aDogc3RyaW5nLCBzb3VyY2U/OiBDb21taXRNc2dTb3VyY2UpIHtcbiAgaWYgKCEhc291cmNlKSB7XG4gICAgaWYgKHNvdXJjZSA9PT0gJ21lc3NhZ2UnKSB7XG4gICAgICBMb2cuZGVidWcoJ0EgY29tbWl0IG1lc3NhZ2Ugd2FzIGFscmVhZHkgcHJvdmlkZWQgdmlhIHRoZSBjb21tYW5kIHdpdGggYSAtbSBvciAtRiBmbGFnJyk7XG4gICAgfVxuICAgIGlmIChzb3VyY2UgPT09ICd0ZW1wbGF0ZScpIHtcbiAgICAgIExvZy5kZWJ1ZygnQSBjb21taXQgbWVzc2FnZSB3YXMgYWxyZWFkeSBwcm92aWRlZCB2aWEgdGhlIC10IGZsYWcgb3IgY29uZmlnLnRlbXBsYXRlIHNldHRpbmcnKTtcbiAgICB9XG4gICAgaWYgKHNvdXJjZSA9PT0gJ3NxdWFzaCcpIHtcbiAgICAgIExvZy5kZWJ1ZygnQSBjb21taXQgbWVzc2FnZSB3YXMgYWxyZWFkeSBwcm92aWRlZCBhcyBhIG1lcmdlIGFjdGlvbiBvciB2aWEgLmdpdC9NRVJHRV9NU0cnKTtcbiAgICB9XG4gICAgaWYgKHNvdXJjZSA9PT0gJ2NvbW1pdCcpIHtcbiAgICAgIExvZy5kZWJ1ZyhcbiAgICAgICAgJ0EgY29tbWl0IG1lc3NhZ2Ugd2FzIGFscmVhZHkgcHJvdmlkZWQgdGhyb3VnaCBhIHJldmlzaW9uIHNwZWNpZmllZCB2aWEgLS1maXh1cCwgLWMsJyxcbiAgICAgICk7XG4gICAgICBMb2cuZGVidWcoJy1DIG9yIC0tYW1lbmQgZmxhZycpO1xuICAgIH1cbiAgICBwcm9jZXNzLmV4aXQoMCk7XG4gIH1cbiAgLyoqIEEgZHJhZnQgb2YgYSBjb21taXQgbWVzc2FnZS4gKi9cbiAgY29uc3QgY29tbWl0TWVzc2FnZSA9IGxvYWRDb21taXRNZXNzYWdlRHJhZnQoZmlsZVBhdGgpO1xuXG4gIC8vIElmIHRoZSBjb21taXQgbWVzc2FnZSBkcmFmdCBoYXMgY29udGVudCwgcmVzdG9yZSBpdCBpbnRvIHRoZSBwcm92aWRlZCBmaWxlcGF0aC5cbiAgaWYgKGNvbW1pdE1lc3NhZ2UpIHtcbiAgICB3cml0ZUZpbGVTeW5jKGZpbGVQYXRoLCBjb21taXRNZXNzYWdlKTtcbiAgfVxuICAvLyBFeGl0IHRoZSBwcm9jZXNzXG4gIHByb2Nlc3MuZXhpdCgwKTtcbn1cbiJdfQ==