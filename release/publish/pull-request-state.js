/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * Gets whether a given pull request has been merged.
 *
 * Note: There are situations where GitHub still processes the merging or
 * closing action and temporarily this function would return `false`. Make
 * sure to account for this when logic relies on this method.
 *
 * More details here: https://github.com/angular/angular/pull/40181.
 *
 * @throws May throw Github API request errors if e.g. a pull request
 *   cannot be found, or the repository is not existing/visible.
 */
export async function isPullRequestMerged(api, id) {
    const { data } = await api.github.pulls.get({ ...api.remoteParams, pull_number: id });
    if (data.merged) {
        return true;
    }
    return await isPullRequestClosedWithAssociatedCommit(api, id);
}
/**
 * Whether the pull request has been closed with an associated commit. This is usually
 * the case if a PR has been merged using the autosquash merge script strategy. Since
 * the merge is not fast-forward, Github does not consider the PR as merged and instead
 * shows the PR as closed. See for example: https://github.com/angular/angular/pull/37918.
 */
async function isPullRequestClosedWithAssociatedCommit(api, id) {
    const events = await api.github.paginate(api.github.issues.listEvents, {
        ...api.remoteParams,
        issue_number: id,
    });
    // Iterate through the events of the pull request in reverse. We want to find the most
    // recent events and check if the PR has been closed with a commit associated with it.
    // If the PR has been closed through a commit, we assume that the PR has been merged
    // using the autosquash merge strategy. For more details. See the `AutosquashMergeStrategy`.
    for (let i = events.length - 1; i >= 0; i--) {
        const { event, commit_id } = events[i];
        // If we come across a "reopened" event, we abort looking for referenced commits. Any
        // commits that closed the PR before, are no longer relevant and did not close the PR.
        if (event === 'reopened') {
            return false;
        }
        // If a `closed` event is captured with a commit assigned, then we assume that
        // this PR has been merged properly.
        if (event === 'closed' && commit_id) {
            return true;
        }
        // If the PR has been referenced by a commit, check if the commit closes this pull
        // request. Note that this is needed besides checking `closed` as PRs could be merged
        // into any non-default branch where the `Closes <..>` keyword does not work and the PR
        // is simply closed without an associated `commit_id`. For more details see:
        // https://docs.github.com/en/enterprise/2.16/user/github/managing-your-work-on-github/closing-issues-using-keywords#:~:text=non-default.
        if (event === 'referenced' &&
            commit_id &&
            (await isCommitClosingPullRequest(api, commit_id, id))) {
            return true;
        }
    }
    return false;
}
/** Checks whether the specified commit is closing the given pull request. */
async function isCommitClosingPullRequest(api, sha, id) {
    const { data } = await api.github.repos.getCommit({ ...api.remoteParams, ref: sha });
    // Matches the closing keyword supported in commit messages. See:
    // https://docs.github.com/en/enterprise/2.16/user/github/managing-your-work-on-github/closing-issues-using-keywords.
    return data.commit.message.match(new RegExp(`(?:close[sd]?|fix(?:e[sd]?)|resolve[sd]?):? #${id}(?!\\d)`, 'i'));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVsbC1yZXF1ZXN0LXN0YXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3JlbGVhc2UvcHVibGlzaC9wdWxsLXJlcXVlc3Qtc3RhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBT0g7Ozs7Ozs7Ozs7O0dBV0c7QUFDSCxNQUFNLENBQUMsS0FBSyxVQUFVLG1CQUFtQixDQUFDLEdBQWMsRUFBRSxFQUFVO0lBQ2xFLE1BQU0sRUFBQyxJQUFJLEVBQUMsR0FBRyxNQUFNLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFDLEdBQUcsR0FBRyxDQUFDLFlBQVksRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFDLENBQUMsQ0FBQztJQUNsRixJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNoQixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFDRCxPQUFPLE1BQU0sdUNBQXVDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ2hFLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILEtBQUssVUFBVSx1Q0FBdUMsQ0FBQyxHQUFjLEVBQUUsRUFBVTtJQUMvRSxNQUFNLE1BQU0sR0FBRyxNQUFNLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRTtRQUNyRSxHQUFHLEdBQUcsQ0FBQyxZQUFZO1FBQ25CLFlBQVksRUFBRSxFQUFFO0tBQ2pCLENBQUMsQ0FBQztJQUNILHNGQUFzRjtJQUN0RixzRkFBc0Y7SUFDdEYsb0ZBQW9GO0lBQ3BGLDRGQUE0RjtJQUM1RixLQUFLLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUM1QyxNQUFNLEVBQUMsS0FBSyxFQUFFLFNBQVMsRUFBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyQyxxRkFBcUY7UUFDckYsc0ZBQXNGO1FBQ3RGLElBQUksS0FBSyxLQUFLLFVBQVUsRUFBRSxDQUFDO1lBQ3pCLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUNELDhFQUE4RTtRQUM5RSxvQ0FBb0M7UUFDcEMsSUFBSSxLQUFLLEtBQUssUUFBUSxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ3BDLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNELGtGQUFrRjtRQUNsRixxRkFBcUY7UUFDckYsdUZBQXVGO1FBQ3ZGLDRFQUE0RTtRQUM1RSx5SUFBeUk7UUFDekksSUFDRSxLQUFLLEtBQUssWUFBWTtZQUN0QixTQUFTO1lBQ1QsQ0FBQyxNQUFNLDBCQUEwQixDQUFDLEdBQUcsRUFBRSxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFDdEQsQ0FBQztZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRCw2RUFBNkU7QUFDN0UsS0FBSyxVQUFVLDBCQUEwQixDQUFDLEdBQWMsRUFBRSxHQUFXLEVBQUUsRUFBVTtJQUMvRSxNQUFNLEVBQUMsSUFBSSxFQUFDLEdBQUcsTUFBTSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBQyxHQUFHLEdBQUcsQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBQyxDQUFDLENBQUM7SUFDakYsaUVBQWlFO0lBQ2pFLHFIQUFxSDtJQUNySCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FDOUIsSUFBSSxNQUFNLENBQUMsZ0RBQWdELEVBQUUsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUM3RSxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0dpdENsaWVudH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdC1jbGllbnQuanMnO1xuXG4vKiogU3RhdGUgb2YgYSBwdWxsIHJlcXVlc3QgaW4gR2l0aHViLiAqL1xuZXhwb3J0IHR5cGUgUHVsbFJlcXVlc3RTdGF0ZSA9ICdtZXJnZWQnIHwgJ3Vua25vd24nO1xuXG4vKipcbiAqIEdldHMgd2hldGhlciBhIGdpdmVuIHB1bGwgcmVxdWVzdCBoYXMgYmVlbiBtZXJnZWQuXG4gKlxuICogTm90ZTogVGhlcmUgYXJlIHNpdHVhdGlvbnMgd2hlcmUgR2l0SHViIHN0aWxsIHByb2Nlc3NlcyB0aGUgbWVyZ2luZyBvclxuICogY2xvc2luZyBhY3Rpb24gYW5kIHRlbXBvcmFyaWx5IHRoaXMgZnVuY3Rpb24gd291bGQgcmV0dXJuIGBmYWxzZWAuIE1ha2VcbiAqIHN1cmUgdG8gYWNjb3VudCBmb3IgdGhpcyB3aGVuIGxvZ2ljIHJlbGllcyBvbiB0aGlzIG1ldGhvZC5cbiAqXG4gKiBNb3JlIGRldGFpbHMgaGVyZTogaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci9wdWxsLzQwMTgxLlxuICpcbiAqIEB0aHJvd3MgTWF5IHRocm93IEdpdGh1YiBBUEkgcmVxdWVzdCBlcnJvcnMgaWYgZS5nLiBhIHB1bGwgcmVxdWVzdFxuICogICBjYW5ub3QgYmUgZm91bmQsIG9yIHRoZSByZXBvc2l0b3J5IGlzIG5vdCBleGlzdGluZy92aXNpYmxlLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaXNQdWxsUmVxdWVzdE1lcmdlZChhcGk6IEdpdENsaWVudCwgaWQ6IG51bWJlcik6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBjb25zdCB7ZGF0YX0gPSBhd2FpdCBhcGkuZ2l0aHViLnB1bGxzLmdldCh7Li4uYXBpLnJlbW90ZVBhcmFtcywgcHVsbF9udW1iZXI6IGlkfSk7XG4gIGlmIChkYXRhLm1lcmdlZCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBhd2FpdCBpc1B1bGxSZXF1ZXN0Q2xvc2VkV2l0aEFzc29jaWF0ZWRDb21taXQoYXBpLCBpZCk7XG59XG5cbi8qKlxuICogV2hldGhlciB0aGUgcHVsbCByZXF1ZXN0IGhhcyBiZWVuIGNsb3NlZCB3aXRoIGFuIGFzc29jaWF0ZWQgY29tbWl0LiBUaGlzIGlzIHVzdWFsbHlcbiAqIHRoZSBjYXNlIGlmIGEgUFIgaGFzIGJlZW4gbWVyZ2VkIHVzaW5nIHRoZSBhdXRvc3F1YXNoIG1lcmdlIHNjcmlwdCBzdHJhdGVneS4gU2luY2VcbiAqIHRoZSBtZXJnZSBpcyBub3QgZmFzdC1mb3J3YXJkLCBHaXRodWIgZG9lcyBub3QgY29uc2lkZXIgdGhlIFBSIGFzIG1lcmdlZCBhbmQgaW5zdGVhZFxuICogc2hvd3MgdGhlIFBSIGFzIGNsb3NlZC4gU2VlIGZvciBleGFtcGxlOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyL3B1bGwvMzc5MTguXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGlzUHVsbFJlcXVlc3RDbG9zZWRXaXRoQXNzb2NpYXRlZENvbW1pdChhcGk6IEdpdENsaWVudCwgaWQ6IG51bWJlcikge1xuICBjb25zdCBldmVudHMgPSBhd2FpdCBhcGkuZ2l0aHViLnBhZ2luYXRlKGFwaS5naXRodWIuaXNzdWVzLmxpc3RFdmVudHMsIHtcbiAgICAuLi5hcGkucmVtb3RlUGFyYW1zLFxuICAgIGlzc3VlX251bWJlcjogaWQsXG4gIH0pO1xuICAvLyBJdGVyYXRlIHRocm91Z2ggdGhlIGV2ZW50cyBvZiB0aGUgcHVsbCByZXF1ZXN0IGluIHJldmVyc2UuIFdlIHdhbnQgdG8gZmluZCB0aGUgbW9zdFxuICAvLyByZWNlbnQgZXZlbnRzIGFuZCBjaGVjayBpZiB0aGUgUFIgaGFzIGJlZW4gY2xvc2VkIHdpdGggYSBjb21taXQgYXNzb2NpYXRlZCB3aXRoIGl0LlxuICAvLyBJZiB0aGUgUFIgaGFzIGJlZW4gY2xvc2VkIHRocm91Z2ggYSBjb21taXQsIHdlIGFzc3VtZSB0aGF0IHRoZSBQUiBoYXMgYmVlbiBtZXJnZWRcbiAgLy8gdXNpbmcgdGhlIGF1dG9zcXVhc2ggbWVyZ2Ugc3RyYXRlZ3kuIEZvciBtb3JlIGRldGFpbHMuIFNlZSB0aGUgYEF1dG9zcXVhc2hNZXJnZVN0cmF0ZWd5YC5cbiAgZm9yIChsZXQgaSA9IGV2ZW50cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGNvbnN0IHtldmVudCwgY29tbWl0X2lkfSA9IGV2ZW50c1tpXTtcbiAgICAvLyBJZiB3ZSBjb21lIGFjcm9zcyBhIFwicmVvcGVuZWRcIiBldmVudCwgd2UgYWJvcnQgbG9va2luZyBmb3IgcmVmZXJlbmNlZCBjb21taXRzLiBBbnlcbiAgICAvLyBjb21taXRzIHRoYXQgY2xvc2VkIHRoZSBQUiBiZWZvcmUsIGFyZSBubyBsb25nZXIgcmVsZXZhbnQgYW5kIGRpZCBub3QgY2xvc2UgdGhlIFBSLlxuICAgIGlmIChldmVudCA9PT0gJ3Jlb3BlbmVkJykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBJZiBhIGBjbG9zZWRgIGV2ZW50IGlzIGNhcHR1cmVkIHdpdGggYSBjb21taXQgYXNzaWduZWQsIHRoZW4gd2UgYXNzdW1lIHRoYXRcbiAgICAvLyB0aGlzIFBSIGhhcyBiZWVuIG1lcmdlZCBwcm9wZXJseS5cbiAgICBpZiAoZXZlbnQgPT09ICdjbG9zZWQnICYmIGNvbW1pdF9pZCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIC8vIElmIHRoZSBQUiBoYXMgYmVlbiByZWZlcmVuY2VkIGJ5IGEgY29tbWl0LCBjaGVjayBpZiB0aGUgY29tbWl0IGNsb3NlcyB0aGlzIHB1bGxcbiAgICAvLyByZXF1ZXN0LiBOb3RlIHRoYXQgdGhpcyBpcyBuZWVkZWQgYmVzaWRlcyBjaGVja2luZyBgY2xvc2VkYCBhcyBQUnMgY291bGQgYmUgbWVyZ2VkXG4gICAgLy8gaW50byBhbnkgbm9uLWRlZmF1bHQgYnJhbmNoIHdoZXJlIHRoZSBgQ2xvc2VzIDwuLj5gIGtleXdvcmQgZG9lcyBub3Qgd29yayBhbmQgdGhlIFBSXG4gICAgLy8gaXMgc2ltcGx5IGNsb3NlZCB3aXRob3V0IGFuIGFzc29jaWF0ZWQgYGNvbW1pdF9pZGAuIEZvciBtb3JlIGRldGFpbHMgc2VlOlxuICAgIC8vIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL2VuL2VudGVycHJpc2UvMi4xNi91c2VyL2dpdGh1Yi9tYW5hZ2luZy15b3VyLXdvcmstb24tZ2l0aHViL2Nsb3NpbmctaXNzdWVzLXVzaW5nLWtleXdvcmRzIzp+OnRleHQ9bm9uLWRlZmF1bHQuXG4gICAgaWYgKFxuICAgICAgZXZlbnQgPT09ICdyZWZlcmVuY2VkJyAmJlxuICAgICAgY29tbWl0X2lkICYmXG4gICAgICAoYXdhaXQgaXNDb21taXRDbG9zaW5nUHVsbFJlcXVlc3QoYXBpLCBjb21taXRfaWQsIGlkKSlcbiAgICApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKiBDaGVja3Mgd2hldGhlciB0aGUgc3BlY2lmaWVkIGNvbW1pdCBpcyBjbG9zaW5nIHRoZSBnaXZlbiBwdWxsIHJlcXVlc3QuICovXG5hc3luYyBmdW5jdGlvbiBpc0NvbW1pdENsb3NpbmdQdWxsUmVxdWVzdChhcGk6IEdpdENsaWVudCwgc2hhOiBzdHJpbmcsIGlkOiBudW1iZXIpIHtcbiAgY29uc3Qge2RhdGF9ID0gYXdhaXQgYXBpLmdpdGh1Yi5yZXBvcy5nZXRDb21taXQoey4uLmFwaS5yZW1vdGVQYXJhbXMsIHJlZjogc2hhfSk7XG4gIC8vIE1hdGNoZXMgdGhlIGNsb3Npbmcga2V5d29yZCBzdXBwb3J0ZWQgaW4gY29tbWl0IG1lc3NhZ2VzLiBTZWU6XG4gIC8vIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL2VuL2VudGVycHJpc2UvMi4xNi91c2VyL2dpdGh1Yi9tYW5hZ2luZy15b3VyLXdvcmstb24tZ2l0aHViL2Nsb3NpbmctaXNzdWVzLXVzaW5nLWtleXdvcmRzLlxuICByZXR1cm4gZGF0YS5jb21taXQubWVzc2FnZS5tYXRjaChcbiAgICBuZXcgUmVnRXhwKGAoPzpjbG9zZVtzZF0/fGZpeCg/OmVbc2RdPyl8cmVzb2x2ZVtzZF0/KTo/ICMke2lkfSg/IVxcXFxkKWAsICdpJyksXG4gICk7XG59XG4iXX0=