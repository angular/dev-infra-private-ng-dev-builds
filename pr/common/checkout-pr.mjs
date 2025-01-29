/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { types as graphqlTypes } from 'typed-graphqlify';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { addTokenToGitHttpsUrl } from '../../utils/git/github-urls.js';
import { getPr } from '../../utils/github.js';
/* Graphql schema for the response body for a pending PR. */
const PR_SCHEMA = {
    author: {
        login: graphqlTypes.string,
    },
    state: graphqlTypes.string,
    maintainerCanModify: graphqlTypes.boolean,
    viewerDidAuthor: graphqlTypes.boolean,
    headRefOid: graphqlTypes.string,
    headRef: {
        name: graphqlTypes.string,
        repository: {
            url: graphqlTypes.string,
            nameWithOwner: graphqlTypes.string,
        },
    },
    baseRefOid: graphqlTypes.string,
    baseRef: {
        name: graphqlTypes.string,
        repository: {
            url: graphqlTypes.string,
            nameWithOwner: graphqlTypes.string,
        },
    },
};
/** Error being thrown if there are unexpected local changes in the project repo. */
export class UnexpectedLocalChangesError extends Error {
}
/** Error being thrown if a requested pull request could not be found upstream. */
export class PullRequestNotFoundError extends Error {
}
/** Error being thrown if the pull request does not allow for maintainer modifications. */
export class MaintainerModifyAccessError extends Error {
}
/**
 * Rebase the provided PR onto its merge target branch, and push up the resulting
 * commit to the PRs repository.
 *
 * @throws {UnexpectedLocalChangesError} If the pull request cannot be checked out
 *   due to uncommitted local changes.
 * @throws {PullRequestNotFoundError} If the pull request cannot be checked out
 *   because it is unavailable on Github.
 * @throws {MaintainerModifyAccessError} If the pull request does not allow maintainers
 *   to modify a pull request. Skipped if `allowIfMaintainerCannotModify` is set.
 */
export async function checkOutPullRequestLocally(prNumber, opts = {}) {
    /** The singleton instance of the authenticated git client. */
    const git = await AuthenticatedGitClient.get();
    // In order to preserve local changes, checkouts cannot occur if local changes are present in the
    // git environment. Checked before retrieving the PR to fail fast.
    if (git.hasUncommittedChanges()) {
        throw new UnexpectedLocalChangesError('Unable to checkout PR due to uncommitted changes.');
    }
    /**
     * The branch or revision originally checked out before this method performed
     * any Git operations that may change the working branch.
     */
    const previousBranchOrRevision = git.getCurrentBranchOrRevision();
    /** The PR information from Github. */
    const pr = await getPr(PR_SCHEMA, prNumber, git);
    if (pr === null) {
        throw new PullRequestNotFoundError(`Pull request #${prNumber} could not be found.`);
    }
    /** The branch name of the PR from the repository the PR came from. */
    const headRefName = pr.headRef.name;
    /** The full URL path of the repository the PR came from with github token as authentication. */
    const headRefUrl = addTokenToGitHttpsUrl(pr.headRef.repository.url, git.githubToken);
    // Note: Since we use a detached head for rebasing the PR and therefore do not have
    // remote-tracking branches configured, we need to set our expected ref and SHA. This
    // allows us to use `--force-with-lease` for the detached head while ensuring that we
    // never accidentally override upstream changes that have been pushed in the meanwhile.
    // See:
    // https://git-scm.com/docs/git-push#Documentation/git-push.txt---force-with-leaseltrefnamegtltexpectgt
    /** Flag for a force push with lease back to upstream. */
    const forceWithLeaseFlag = `--force-with-lease=${headRefName}:${pr.headRefOid}`;
    // If the PR does not allow maintainers to modify it, exit as the rebased PR cannot
    // be pushed up.
    if (!pr.maintainerCanModify && !pr.viewerDidAuthor && !opts.allowIfMaintainerCannotModify) {
        throw new MaintainerModifyAccessError('PR is not set to allow maintainers to modify the PR');
    }
    try {
        // Fetch the branch at the commit of the PR, and check it out in a detached state.
        git.run(['fetch', '-q', headRefUrl, headRefName]);
        git.run(['checkout', '--detach', 'FETCH_HEAD']);
    }
    catch (e) {
        git.checkout(previousBranchOrRevision, true);
        throw e;
    }
    return {
        /**
         * Pushes the current local branch to the PR on the upstream repository.
         *
         * @returns true If the command did not fail causing a GitCommandError to be thrown.
         * @throws {GitCommandError} Thrown when the push back to upstream fails.
         */
        pushToUpstream: () => {
            git.run(['push', headRefUrl, `HEAD:${headRefName}`, forceWithLeaseFlag]);
            return true;
        },
        /** Restores the state of the local repository to before the PR checkout occured. */
        resetGitState: () => {
            return git.checkout(previousBranchOrRevision, true);
        },
        pushToUpstreamCommand: `git push ${pr.headRef.repository.url} HEAD:${headRefName} ${forceWithLeaseFlag}`,
        resetGitStateCommand: `git rebase --abort && git reset --hard && git checkout ${previousBranchOrRevision}`,
        pullRequest: pr,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hlY2tvdXQtcHIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvY29tbW9uL2NoZWNrb3V0LXByLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxLQUFLLElBQUksWUFBWSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFFdkQsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFDbkYsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFDckUsT0FBTyxFQUFDLEtBQUssRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBRTVDLDREQUE0RDtBQUM1RCxNQUFNLFNBQVMsR0FBRztJQUNoQixNQUFNLEVBQUU7UUFDTixLQUFLLEVBQUUsWUFBWSxDQUFDLE1BQU07S0FDM0I7SUFDRCxLQUFLLEVBQUUsWUFBWSxDQUFDLE1BQU07SUFDMUIsbUJBQW1CLEVBQUUsWUFBWSxDQUFDLE9BQU87SUFDekMsZUFBZSxFQUFFLFlBQVksQ0FBQyxPQUFPO0lBQ3JDLFVBQVUsRUFBRSxZQUFZLENBQUMsTUFBTTtJQUMvQixPQUFPLEVBQUU7UUFDUCxJQUFJLEVBQUUsWUFBWSxDQUFDLE1BQU07UUFDekIsVUFBVSxFQUFFO1lBQ1YsR0FBRyxFQUFFLFlBQVksQ0FBQyxNQUFNO1lBQ3hCLGFBQWEsRUFBRSxZQUFZLENBQUMsTUFBTTtTQUNuQztLQUNGO0lBQ0QsVUFBVSxFQUFFLFlBQVksQ0FBQyxNQUFNO0lBQy9CLE9BQU8sRUFBRTtRQUNQLElBQUksRUFBRSxZQUFZLENBQUMsTUFBTTtRQUN6QixVQUFVLEVBQUU7WUFDVixHQUFHLEVBQUUsWUFBWSxDQUFDLE1BQU07WUFDeEIsYUFBYSxFQUFFLFlBQVksQ0FBQyxNQUFNO1NBQ25DO0tBQ0Y7Q0FDRixDQUFDO0FBRUYsb0ZBQW9GO0FBQ3BGLE1BQU0sT0FBTywyQkFBNEIsU0FBUSxL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Q3hHLG9CQUFvQixFQUFFLDBEQUEwRCx3QkFBd0IsRUFBRTtRQUMxRyxXQUFXLEVBQUUsRUFBRTtLQUNoQixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge3R5cGVzIGFzIGdyYXBocWxUeXBlc30gZnJvbSAndHlwZWQtZ3JhcGhxbGlmeSc7XG5cbmltcG9ydCB7QXV0aGVudGljYXRlZEdpdENsaWVudH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2F1dGhlbnRpY2F0ZWQtZ2l0LWNsaWVudC5qcyc7XG5pbXBvcnQge2FkZFRva2VuVG9HaXRIdHRwc1VybH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi11cmxzLmpzJztcbmltcG9ydCB7Z2V0UHJ9IGZyb20gJy4uLy4uL3V0aWxzL2dpdGh1Yi5qcyc7XG5cbi8qIEdyYXBocWwgc2NoZW1hIGZvciB0aGUgcmVzcG9uc2UgYm9keSBmb3IgYSBwZW5kaW5nIFBSLiAqL1xuY29uc3QgUFJfU0NIRU1BID0ge1xuICBhdXRob3I6IHtcbiAgICBsb2dpbjogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgfSxcbiAgc3RhdGU6IGdyYXBocWxUeXBlcy5zdHJpbmcsXG4gIG1haW50YWluZXJDYW5Nb2RpZnk6IGdyYXBocWxUeXBlcy5ib29sZWFuLFxuICB2aWV3ZXJEaWRBdXRob3I6IGdyYXBocWxUeXBlcy5ib29sZWFuLFxuICBoZWFkUmVmT2lkOiBncmFwaHFsVHlwZXMuc3RyaW5nLFxuICBoZWFkUmVmOiB7XG4gICAgbmFtZTogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgICByZXBvc2l0b3J5OiB7XG4gICAgICB1cmw6IGdyYXBocWxUeXBlcy5zdHJpbmcsXG4gICAgICBuYW1lV2l0aE93bmVyOiBncmFwaHFsVHlwZXMuc3RyaW5nLFxuICAgIH0sXG4gIH0sXG4gIGJhc2VSZWZPaWQ6IGdyYXBocWxUeXBlcy5zdHJpbmcsXG4gIGJhc2VSZWY6IHtcbiAgICBuYW1lOiBncmFwaHFsVHlwZXMuc3RyaW5nLFxuICAgIHJlcG9zaXRvcnk6IHtcbiAgICAgIHVybDogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgICAgIG5hbWVXaXRoT3duZXI6IGdyYXBocWxUeXBlcy5zdHJpbmcsXG4gICAgfSxcbiAgfSxcbn07XG5cbi8qKiBFcnJvciBiZWluZyB0aHJvd24gaWYgdGhlcmUgYXJlIHVuZXhwZWN0ZWQgbG9jYWwgY2hhbmdlcyBpbiB0aGUgcHJvamVjdCByZXBvLiAqL1xuZXhwb3J0IGNsYXNzIFVuZXhwZWN0ZWRMb2NhbENoYW5nZXNFcnJvciBleHRlbmRzIEVycm9yIHt9XG4vKiogRXJyb3IgYmVpbmcgdGhyb3duIGlmIGEgcmVxdWVzdGVkIHB1bGwgcmVxdWVzdCBjb3VsZCBub3QgYmUgZm91bmQgdXBzdHJlYW0uICovXG5leHBvcnQgY2xhc3MgUHVsbFJlcXVlc3ROb3RGb3VuZEVycm9yIGV4dGVuZHMgRXJyb3Ige31cbi8qKiBFcnJvciBiZWluZyB0aHJvd24gaWYgdGhlIHB1bGwgcmVxdWVzdCBkb2VzIG5vdCBhbGxvdyBmb3IgbWFpbnRhaW5lciBtb2RpZmljYXRpb25zLiAqL1xuZXhwb3J0IGNsYXNzIE1haW50YWluZXJNb2RpZnlBY2Nlc3NFcnJvciBleHRlbmRzIEVycm9yIHt9XG5cbi8qKiBPcHRpb25zIGZvciBjaGVja2luZyBvdXQgYSBQUiAqL1xuZXhwb3J0IGludGVyZmFjZSBQdWxsUmVxdWVzdENoZWNrb3V0T3B0aW9ucyB7XG4gIC8qKiBXaGV0aGVyIHRoZSBQUiBzaG91bGQgYmUgY2hlY2tlZCBvdXQgaWYgdGhlIG1haW50YWluZXIgY2Fubm90IG1vZGlmeS4gKi9cbiAgYWxsb3dJZk1haW50YWluZXJDYW5ub3RNb2RpZnk/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIFJlYmFzZSB0aGUgcHJvdmlkZWQgUFIgb250byBpdHMgbWVyZ2UgdGFyZ2V0IGJyYW5jaCwgYW5kIHB1c2ggdXAgdGhlIHJlc3VsdGluZ1xuICogY29tbWl0IHRvIHRoZSBQUnMgcmVwb3NpdG9yeS5cbiAqXG4gKiBAdGhyb3dzIHtVbmV4cGVjdGVkTG9jYWxDaGFuZ2VzRXJyb3J9IElmIHRoZSBwdWxsIHJlcXVlc3QgY2Fubm90IGJlIGNoZWNrZWQgb3V0XG4gKiAgIGR1ZSB0byB1bmNvbW1pdHRlZCBsb2NhbCBjaGFuZ2VzLlxuICogQHRocm93cyB7UHVsbFJlcXVlc3ROb3RGb3VuZEVycm9yfSBJZiB0aGUgcHVsbCByZXF1ZXN0IGNhbm5vdCBiZSBjaGVja2VkIG91dFxuICogICBiZWNhdXNlIGl0IGlzIHVuYXZhaWxhYmxlIG9uIEdpdGh1Yi5cbiAqIEB0aHJvd3Mge01haW50YWluZXJNb2RpZnlBY2Nlc3NFcnJvcn0gSWYgdGhlIHB1bGwgcmVxdWVzdCBkb2VzIG5vdCBhbGxvdyBtYWludGFpbmVyc1xuICogICB0byBtb2RpZnkgYSBwdWxsIHJlcXVlc3QuIFNraXBwZWQgaWYgYGFsbG93SWZNYWludGFpbmVyQ2Fubm90TW9kaWZ5YCBpcyBzZXQuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjaGVja091dFB1bGxSZXF1ZXN0TG9jYWxseShcbiAgcHJOdW1iZXI6IG51bWJlcixcbiAgb3B0czogUHVsbFJlcXVlc3RDaGVja291dE9wdGlvbnMgPSB7fSxcbikge1xuICAvKiogVGhlIHNpbmdsZXRvbiBpbnN0YW5jZSBvZiB0aGUgYXV0aGVudGljYXRlZCBnaXQgY2xpZW50LiAqL1xuICBjb25zdCBnaXQgPSBhd2FpdCBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LmdldCgpO1xuXG4gIC8vIEluIG9yZGVyIHRvIHByZXNlcnZlIGxvY2FsIGNoYW5nZXMsIGNoZWNrb3V0cyBjYW5ub3Qgb2NjdXIgaWYgbG9jYWwgY2hhbmdlcyBhcmUgcHJlc2VudCBpbiB0aGVcbiAgLy8gZ2l0IGVudmlyb25tZW50LiBDaGVja2VkIGJlZm9yZSByZXRyaWV2aW5nIHRoZSBQUiB0byBmYWlsIGZhc3QuXG4gIGlmIChnaXQuaGFzVW5jb21taXR0ZWRDaGFuZ2VzKCkpIHtcbiAgICB0aHJvdyBuZXcgVW5leHBlY3RlZExvY2FsQ2hhbmdlc0Vycm9yKCdVbmFibGUgdG8gY2hlY2tvdXQgUFIgZHVlIHRvIHVuY29tbWl0dGVkIGNoYW5nZXMuJyk7XG4gIH1cblxuICAvKipcbiAgICogVGhlIGJyYW5jaCBvciByZXZpc2lvbiBvcmlnaW5hbGx5IGNoZWNrZWQgb3V0IGJlZm9yZSB0aGlzIG1ldGhvZCBwZXJmb3JtZWRcbiAgICogYW55IEdpdCBvcGVyYXRpb25zIHRoYXQgbWF5IGNoYW5nZSB0aGUgd29ya2luZyBicmFuY2guXG4gICAqL1xuICBjb25zdCBwcmV2aW91c0JyYW5jaE9yUmV2aXNpb24gPSBnaXQuZ2V0Q3VycmVudEJyYW5jaE9yUmV2aXNpb24oKTtcbiAgLyoqIFRoZSBQUiBpbmZvcm1hdGlvbiBmcm9tIEdpdGh1Yi4gKi9cbiAgY29uc3QgcHIgPSBhd2FpdCBnZXRQcihQUl9TQ0hFTUEsIHByTnVtYmVyLCBnaXQpO1xuXG4gIGlmIChwciA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBQdWxsUmVxdWVzdE5vdEZvdW5kRXJyb3IoYFB1bGwgcmVxdWVzdCAjJHtwck51bWJlcn0gY291bGQgbm90IGJlIGZvdW5kLmApO1xuICB9XG5cbiAgLyoqIFRoZSBicmFuY2ggbmFtZSBvZiB0aGUgUFIgZnJvbSB0aGUgcmVwb3NpdG9yeSB0aGUgUFIgY2FtZSBmcm9tLiAqL1xuICBjb25zdCBoZWFkUmVmTmFtZSA9IHByLmhlYWRSZWYubmFtZTtcbiAgLyoqIFRoZSBmdWxsIFVSTCBwYXRoIG9mIHRoZSByZXBvc2l0b3J5IHRoZSBQUiBjYW1lIGZyb20gd2l0aCBnaXRodWIgdG9rZW4gYXMgYXV0aGVudGljYXRpb24uICovXG4gIGNvbnN0IGhlYWRSZWZVcmwgPSBhZGRUb2tlblRvR2l0SHR0cHNVcmwocHIuaGVhZFJlZi5yZXBvc2l0b3J5LnVybCwgZ2l0LmdpdGh1YlRva2VuKTtcbiAgLy8gTm90ZTogU2luY2Ugd2UgdXNlIGEgZGV0YWNoZWQgaGVhZCBmb3IgcmViYXNpbmcgdGhlIFBSIGFuZCB0aGVyZWZvcmUgZG8gbm90IGhhdmVcbiAgLy8gcmVtb3RlLXRyYWNraW5nIGJyYW5jaGVzIGNvbmZpZ3VyZWQsIHdlIG5lZWQgdG8gc2V0IG91ciBleHBlY3RlZCByZWYgYW5kIFNIQS4gVGhpc1xuICAvLyBhbGxvd3MgdXMgdG8gdXNlIGAtLWZvcmNlLXdpdGgtbGVhc2VgIGZvciB0aGUgZGV0YWNoZWQgaGVhZCB3aGlsZSBlbnN1cmluZyB0aGF0IHdlXG4gIC8vIG5ldmVyIGFjY2lkZW50YWxseSBvdmVycmlkZSB1cHN0cmVhbSBjaGFuZ2VzIHRoYXQgaGF2ZSBiZWVuIHB1c2hlZCBpbiB0aGUgbWVhbndoaWxlLlxuICAvLyBTZWU6XG4gIC8vIGh0dHBzOi8vZ2l0LXNjbS5jb20vZG9jcy9naXQtcHVzaCNEb2N1bWVudGF0aW9uL2dpdC1wdXNoLnR4dC0tLWZvcmNlLXdpdGgtbGVhc2VsdHJlZm5hbWVndGx0ZXhwZWN0Z3RcbiAgLyoqIEZsYWcgZm9yIGEgZm9yY2UgcHVzaCB3aXRoIGxlYXNlIGJhY2sgdG8gdXBzdHJlYW0uICovXG4gIGNvbnN0IGZvcmNlV2l0aExlYXNlRmxhZyA9IGAtLWZvcmNlLXdpdGgtbGVhc2U9JHtoZWFkUmVmTmFtZX06JHtwci5oZWFkUmVmT2lkfWA7XG5cbiAgLy8gSWYgdGhlIFBSIGRvZXMgbm90IGFsbG93IG1haW50YWluZXJzIHRvIG1vZGlmeSBpdCwgZXhpdCBhcyB0aGUgcmViYXNlZCBQUiBjYW5ub3RcbiAgLy8gYmUgcHVzaGVkIHVwLlxuICBpZiAoIXByLm1haW50YWluZXJDYW5Nb2RpZnkgJiYgIXByLnZpZXdlckRpZEF1dGhvciAmJiAhb3B0cy5hbGxvd0lmTWFpbnRhaW5lckNhbm5vdE1vZGlmeSkge1xuICAgIHRocm93IG5ldyBNYWludGFpbmVyTW9kaWZ5QWNjZXNzRXJyb3IoJ1BSIGlzIG5vdCBzZXQgdG8gYWxsb3cgbWFpbnRhaW5lcnMgdG8gbW9kaWZ5IHRoZSBQUicpO1xuICB9XG5cbiAgdHJ5IHtcbiAgICAvLyBGZXRjaCB0aGUgYnJhbmNoIGF0IHRoZSBjb21taXQgb2YgdGhlIFBSLCBhbmQgY2hlY2sgaXQgb3V0IGluIGEgZGV0YWNoZWQgc3RhdGUuXG4gICAgZ2l0LnJ1bihbJ2ZldGNoJywgJy1xJywgaGVhZFJlZlVybCwgaGVhZFJlZk5hbWVdKTtcbiAgICBnaXQucnVuKFsnY2hlY2tvdXQnLCAnLS1kZXRhY2gnLCAnRkVUQ0hfSEVBRCddKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGdpdC5jaGVja291dChwcmV2aW91c0JyYW5jaE9yUmV2aXNpb24sIHRydWUpO1xuICAgIHRocm93IGU7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIFB1c2hlcyB0aGUgY3VycmVudCBsb2NhbCBicmFuY2ggdG8gdGhlIFBSIG9uIHRoZSB1cHN0cmVhbSByZXBvc2l0b3J5LlxuICAgICAqXG4gICAgICogQHJldHVybnMgdHJ1ZSBJZiB0aGUgY29tbWFuZCBkaWQgbm90IGZhaWwgY2F1c2luZyBhIEdpdENvbW1hbmRFcnJvciB0byBiZSB0aHJvd24uXG4gICAgICogQHRocm93cyB7R2l0Q29tbWFuZEVycm9yfSBUaHJvd24gd2hlbiB0aGUgcHVzaCBiYWNrIHRvIHVwc3RyZWFtIGZhaWxzLlxuICAgICAqL1xuICAgIHB1c2hUb1Vwc3RyZWFtOiAoKTogdHJ1ZSA9PiB7XG4gICAgICBnaXQucnVuKFsncHVzaCcsIGhlYWRSZWZVcmwsIGBIRUFEOiR7aGVhZFJlZk5hbWV9YCwgZm9yY2VXaXRoTGVhc2VGbGFnXSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuICAgIC8qKiBSZXN0b3JlcyB0aGUgc3RhdGUgb2YgdGhlIGxvY2FsIHJlcG9zaXRvcnkgdG8gYmVmb3JlIHRoZSBQUiBjaGVja291dCBvY2N1cmVkLiAqL1xuICAgIHJlc2V0R2l0U3RhdGU6ICgpOiBib29sZWFuID0+IHtcbiAgICAgIHJldHVybiBnaXQuY2hlY2tvdXQocHJldmlvdXNCcmFuY2hPclJldmlzaW9uLCB0cnVlKTtcbiAgICB9LFxuICAgIHB1c2hUb1Vwc3RyZWFtQ29tbWFuZDogYGdpdCBwdXNoICR7cHIuaGVhZFJlZi5yZXBvc2l0b3J5LnVybH0gSEVBRDoke2hlYWRSZWZOYW1lfSAke2ZvcmNlV2l0aExlYXNlRmxhZ31gLFxuICAgIHJlc2V0R2l0U3RhdGVDb21tYW5kOiBgZ2l0IHJlYmFzZSAtLWFib3J0ICYmIGdpdCByZXNldCAtLWhhcmQgJiYgZ2l0IGNoZWNrb3V0ICR7cHJldmlvdXNCcmFuY2hPclJldmlzaW9ufWAsXG4gICAgcHVsbFJlcXVlc3Q6IHByLFxuICB9O1xufVxuIl19