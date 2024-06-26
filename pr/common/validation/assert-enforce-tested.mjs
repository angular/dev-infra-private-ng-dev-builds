/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import githubMacros from '../../../utils/git/github-macros.js';
import { fetchPullRequestCommentsFromGithub, } from '../fetch-pull-request.js';
import { createPullRequestValidation, PullRequestValidation } from './validation-config.js';
import { requiresLabels } from '../labels/index.js';
/** Assert the pull request has passing enforced statuses. */
// TODO: update typings to make sure portability is properly handled for windows build.
export const enforceTestedValidation = createPullRequestValidation({ name: 'assertEnforceTested', canBeForceIgnored: true }, () => Validation);
class Validation extends PullRequestValidation {
    async assert(pullRequest, gitClient) {
        if (!pullRequestRequiresTGP(pullRequest)) {
            return;
        }
        const comments = await PullRequestComments.create(gitClient, pullRequest.number).loadPullRequestComments();
        if (await pullRequestHasValidTestedComment(comments, gitClient)) {
            return;
        }
        // TODO(jessicajaniuk): Add the actual validation that a TGP has been run.
        throw this._createError(`Pull Request requires a TGP and does not have one. Either run a TGP or specify the PR is fully tested by adding a comment with "TESTED=[reason]".`);
    }
}
/**
 * Checks the list of labels for the `requires: TGP` label
 */
function pullRequestRequiresTGP(pullRequest) {
    return pullRequest.labels.nodes.some(({ name }) => name === requiresLabels.REQUIRES_TGP.name);
}
export class PullRequestComments {
    constructor(git, prNumber) {
        this.git = git;
        this.prNumber = prNumber;
    }
    /**
     * Loads the files from a given pull request.
     */
    async loadPullRequestComments() {
        return (await fetchPullRequestCommentsFromGithub(this.git, this.prNumber)) ?? [];
    }
    static create(git, prNumber) {
        return new PullRequestComments(git, prNumber);
    }
}
/**
 * Checks for `TESTED=[reason]` comment on a current commit sha from a google organization member
 */
export async function pullRequestHasValidTestedComment(comments, gitClient) {
    for (const { bodyText, author } of comments) {
        if (bodyText.startsWith(`TESTED=`) &&
            (await githubMacros.isGooglerOrgMember(gitClient.github, author.login))) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXJ0LWVuZm9yY2UtdGVzdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL2NvbW1vbi92YWxpZGF0aW9uL2Fzc2VydC1lbmZvcmNlLXRlc3RlZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLFlBQVksTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQ0wsa0NBQWtDLEdBR25DLE1BQU0sMEJBQTBCLENBQUM7QUFDbEMsT0FBTyxFQUFDLDJCQUEyQixFQUFFLHFCQUFxQixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDMUYsT0FBTyxFQUFDLGNBQWMsRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBR2xELDZEQUE2RDtBQUM3RCx1RkFBdUY7QUFDdkYsTUFBTSxDQUFDLE1BQU0sdUJBQXVCLEdBQUcsMkJBQTJCLENBQ2hFLEVBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBQyxFQUN0RCxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQ2pCLENBQUM7QUFFRixNQUFNLFVBQVcsU0FBUSxxQkFBcUI7SUFDNUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxXQUFrQyxFQUFFLFNBQWlDO1FBQ2hGLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO1lBQ3pDLE9BQU87UUFDVCxDQUFDO1FBRUQsTUFBTSxRQUFRLEdBQUcsTUFBTSxtQkFBbUIsQ0FBQyxNQUFNLENBQy9DLFNBQVMsRUFDVCxXQUFXLENBQUMsTUFBTSxDQUNuQixDQUFDLHVCQUF1QixFQUFFLENBQUM7UUFFNUIsSUFBSSxNQUFNLGdDQUFnQyxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQ2hFLE9BQU87UUFDVCxDQUFDO1FBRUQsMEVBQTBFO1FBRTFFLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FDckIsbUpBQW1KLENBQ3BKLENBQUM7SUFDSixDQUFDO0NBQ0Y7QUFFRDs7R0FFRztBQUNILFNBQVMsc0JBQXNCLENBQUMsV0FBa0M7SUFDaEUsT0FBTyxXQUFXLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFDLElBQUksRUFBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLEtBQUssY0FBYyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM5RixDQUFDO0FBRUQsTUFBTSxPQUFPLG1CQUFtQjtJQUM5QixZQUNVLEdBQTJCLEVBQzNCLFFBQWdCO1FBRGhCLFFBQUcsR0FBSCxHQUFHLENBQXdCO1FBQzNCLGFBQVEsR0FBUixRQUFRLENBQVE7SUFDdkIsQ0FBQztJQUNKOztPQUVHO0lBQ0gsS0FBSyxDQUFDLHVCQUF1QjtRQUMzQixPQUFPLENBQUMsTUFBTSxrQ0FBa0MsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNuRixDQUFDO0lBRUQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUEyQixFQUFFLFFBQWdCO1FBQ3pELE9BQU8sSUFBSSxtQkFBbUIsQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDaEQsQ0FBQztDQUNGO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLENBQUMsS0FBSyxVQUFVLGdDQUFnQyxDQUNwRCxRQUF5QyxFQUN6QyxTQUFpQztJQUVqQyxLQUFLLE1BQU0sRUFBQyxRQUFRLEVBQUUsTUFBTSxFQUFDLElBQUksUUFBUSxFQUFFLENBQUM7UUFDMUMsSUFDRSxRQUFRLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQztZQUM5QixDQUFDLE1BQU0sWUFBWSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQ3ZFLENBQUM7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBnaXRodWJNYWNyb3MgZnJvbSAnLi4vLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi1tYWNyb3MuanMnO1xuaW1wb3J0IHtcbiAgZmV0Y2hQdWxsUmVxdWVzdENvbW1lbnRzRnJvbUdpdGh1YixcbiAgUHVsbFJlcXVlc3RGcm9tR2l0aHViLFxuICBQdWxsUmVxdWVzdENvbW1lbnRzRnJvbUdpdGh1Yixcbn0gZnJvbSAnLi4vZmV0Y2gtcHVsbC1yZXF1ZXN0LmpzJztcbmltcG9ydCB7Y3JlYXRlUHVsbFJlcXVlc3RWYWxpZGF0aW9uLCBQdWxsUmVxdWVzdFZhbGlkYXRpb259IGZyb20gJy4vdmFsaWRhdGlvbi1jb25maWcuanMnO1xuaW1wb3J0IHtyZXF1aXJlc0xhYmVsc30gZnJvbSAnLi4vbGFiZWxzL2luZGV4LmpzJztcbmltcG9ydCB7QXV0aGVudGljYXRlZEdpdENsaWVudH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvZ2l0L2F1dGhlbnRpY2F0ZWQtZ2l0LWNsaWVudC5qcyc7XG5cbi8qKiBBc3NlcnQgdGhlIHB1bGwgcmVxdWVzdCBoYXMgcGFzc2luZyBlbmZvcmNlZCBzdGF0dXNlcy4gKi9cbi8vIFRPRE86IHVwZGF0ZSB0eXBpbmdzIHRvIG1ha2Ugc3VyZSBwb3J0YWJpbGl0eSBpcyBwcm9wZXJseSBoYW5kbGVkIGZvciB3aW5kb3dzIGJ1aWxkLlxuZXhwb3J0IGNvbnN0IGVuZm9yY2VUZXN0ZWRWYWxpZGF0aW9uID0gY3JlYXRlUHVsbFJlcXVlc3RWYWxpZGF0aW9uKFxuICB7bmFtZTogJ2Fzc2VydEVuZm9yY2VUZXN0ZWQnLCBjYW5CZUZvcmNlSWdub3JlZDogdHJ1ZX0sXG4gICgpID0+IFZhbGlkYXRpb24sXG4pO1xuXG5jbGFzcyBWYWxpZGF0aW9uIGV4dGVuZHMgUHVsbFJlcXVlc3RWYWxpZGF0aW9uIHtcbiAgYXN5bmMgYXNzZXJ0KHB1bGxSZXF1ZXN0OiBQdWxsUmVxdWVzdEZyb21HaXRodWIsIGdpdENsaWVudDogQXV0aGVudGljYXRlZEdpdENsaWVudCkge1xuICAgIGlmICghcHVsbFJlcXVlc3RSZXF1aXJlc1RHUChwdWxsUmVxdWVzdCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjb21tZW50cyA9IGF3YWl0IFB1bGxSZXF1ZXN0Q29tbWVudHMuY3JlYXRlKFxuICAgICAgZ2l0Q2xpZW50LFxuICAgICAgcHVsbFJlcXVlc3QubnVtYmVyLFxuICAgICkubG9hZFB1bGxSZXF1ZXN0Q29tbWVudHMoKTtcblxuICAgIGlmIChhd2FpdCBwdWxsUmVxdWVzdEhhc1ZhbGlkVGVzdGVkQ29tbWVudChjb21tZW50cywgZ2l0Q2xpZW50KSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFRPRE8oamVzc2ljYWphbml1ayk6IEFkZCB0aGUgYWN0dWFsIHZhbGlkYXRpb24gdGhhdCBhIFRHUCBoYXMgYmVlbiBydW4uXG5cbiAgICB0aHJvdyB0aGlzLl9jcmVhdGVFcnJvcihcbiAgICAgIGBQdWxsIFJlcXVlc3QgcmVxdWlyZXMgYSBUR1AgYW5kIGRvZXMgbm90IGhhdmUgb25lLiBFaXRoZXIgcnVuIGEgVEdQIG9yIHNwZWNpZnkgdGhlIFBSIGlzIGZ1bGx5IHRlc3RlZCBieSBhZGRpbmcgYSBjb21tZW50IHdpdGggXCJURVNURUQ9W3JlYXNvbl1cIi5gLFxuICAgICk7XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVja3MgdGhlIGxpc3Qgb2YgbGFiZWxzIGZvciB0aGUgYHJlcXVpcmVzOiBUR1BgIGxhYmVsXG4gKi9cbmZ1bmN0aW9uIHB1bGxSZXF1ZXN0UmVxdWlyZXNUR1AocHVsbFJlcXVlc3Q6IFB1bGxSZXF1ZXN0RnJvbUdpdGh1Yik6IGJvb2xlYW4ge1xuICByZXR1cm4gcHVsbFJlcXVlc3QubGFiZWxzLm5vZGVzLnNvbWUoKHtuYW1lfSkgPT4gbmFtZSA9PT0gcmVxdWlyZXNMYWJlbHMuUkVRVUlSRVNfVEdQLm5hbWUpO1xufVxuXG5leHBvcnQgY2xhc3MgUHVsbFJlcXVlc3RDb21tZW50cyB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgZ2l0OiBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LFxuICAgIHByaXZhdGUgcHJOdW1iZXI6IG51bWJlcixcbiAgKSB7fVxuICAvKipcbiAgICogTG9hZHMgdGhlIGZpbGVzIGZyb20gYSBnaXZlbiBwdWxsIHJlcXVlc3QuXG4gICAqL1xuICBhc3luYyBsb2FkUHVsbFJlcXVlc3RDb21tZW50cygpOiBQcm9taXNlPFB1bGxSZXF1ZXN0Q29tbWVudHNGcm9tR2l0aHViW10+IHtcbiAgICByZXR1cm4gKGF3YWl0IGZldGNoUHVsbFJlcXVlc3RDb21tZW50c0Zyb21HaXRodWIodGhpcy5naXQsIHRoaXMucHJOdW1iZXIpKSA/PyBbXTtcbiAgfVxuXG4gIHN0YXRpYyBjcmVhdGUoZ2l0OiBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LCBwck51bWJlcjogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG5ldyBQdWxsUmVxdWVzdENvbW1lbnRzKGdpdCwgcHJOdW1iZXIpO1xuICB9XG59XG5cbi8qKlxuICogQ2hlY2tzIGZvciBgVEVTVEVEPVtyZWFzb25dYCBjb21tZW50IG9uIGEgY3VycmVudCBjb21taXQgc2hhIGZyb20gYSBnb29nbGUgb3JnYW5pemF0aW9uIG1lbWJlclxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcHVsbFJlcXVlc3RIYXNWYWxpZFRlc3RlZENvbW1lbnQoXG4gIGNvbW1lbnRzOiBQdWxsUmVxdWVzdENvbW1lbnRzRnJvbUdpdGh1YltdLFxuICBnaXRDbGllbnQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgZm9yIChjb25zdCB7Ym9keVRleHQsIGF1dGhvcn0gb2YgY29tbWVudHMpIHtcbiAgICBpZiAoXG4gICAgICBib2R5VGV4dC5zdGFydHNXaXRoKGBURVNURUQ9YCkgJiZcbiAgICAgIChhd2FpdCBnaXRodWJNYWNyb3MuaXNHb29nbGVyT3JnTWVtYmVyKGdpdENsaWVudC5naXRodWIsIGF1dGhvci5sb2dpbikpXG4gICAgKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuIl19