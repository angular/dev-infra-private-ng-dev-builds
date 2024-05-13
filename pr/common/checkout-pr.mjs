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
    /** The full ref for the repository and branch the PR came from. */
    const fullHeadRef = `${pr.headRef.repository.nameWithOwner}:${headRefName}`;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hlY2tvdXQtcHIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHIvY29tbW9uL2NoZWNrb3V0LXByLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxLQUFLLElBQUksWUFBWSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFFdkQsT0FBTyxFQUFDLHNCQUFzQixFQUFDLE1BQU0sNkNBQTZDLENBQUM7QUFDbkYsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sZ0NBQWdDLENBQUM7QUFDckUsT0FBTyxFQUFDLEtBQUssRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBRTVDLDREQUE0RDtBQUM1RCxNQUFNLFNBQVMsR0FBRztJQUNoQixNQUFNLEVBQUU7UUFDTixLQUFLLEVBQUUsWUFBWSxDQUFDLE1BQU07S0FDM0I7SUFDRCxLQUFLLEVBQUUsWUFBWSxDQUFDLE1BQU07SUFDMUIsbUJBQW1CLEVBQUUsWUFBWSxDQUFDLE9BQU87SUFDekMsZUFBZSxFQUFFLFlBQVksQ0FBQyxPQUFPO0lBQ3JDLFVBQVUsRUFBRSxZQUFZLENBQUMsTUFBTTtJQUMvQixPQUFPLEVBQUU7UUFDUCxJQUFJLEVBQUUsWUFBWSxDQUFDLE1BQU07UUFDekIsVUFBVSxFQUFFO1lBQ1YsR0FBRyxFQUFFLFlBQVksQ0FBQyxNQUFNO1lBQ3hCLGFBQWEsRUFBRSxZQUFZLENBQUMsTUFBTTtTQUNuQztLQUNGO0lBQ0QsVUFBVSxFQUFFLFlBQVksQ0FBQyxNQUFNO0lBQy9CLE9BQU8sRUFBRTtRQUNQLElBQUksRUFBRSxZQUFZLENBQUMsTUFBTTtRQUN6QixVQUFVLEVBQUU7WUFDVixHQUFHLEVBQUUsWUFBWSxDQUFDLE1BQU07WUFDeEIsYUFBYSxFQUFFLFlBQVksQ0FBQyxNQUFNO1NBQ25DO0tBQ0Y7Q0FDRixDQUFDO0FBRUYsb0ZBQW9GO0FBQ3BGLE1BQU0sT0FBTywyQkFBNEIsU0FBUSxL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dEQsQ0FBQztRQUNELHFCQUFxQixFQUFFLFlBQVksRUFBRSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxTQUFTLFdBQVcsSUFBSSxrQkFBa0IsRUFBRTtRQUN4RyxvQkFBb0IsRUFBRSwwREFBMEQsd0JBQXdCLEVBQUU7UUFDMUcsV0FBVyxFQUFFLEVBQUU7S0FDaEIsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHt0eXBlcyBhcyBncmFwaHFsVHlwZXN9IGZyb20gJ3R5cGVkLWdyYXBocWxpZnknO1xuXG5pbXBvcnQge0F1dGhlbnRpY2F0ZWRHaXRDbGllbnR9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQuanMnO1xuaW1wb3J0IHthZGRUb2tlblRvR2l0SHR0cHNVcmx9IGZyb20gJy4uLy4uL3V0aWxzL2dpdC9naXRodWItdXJscy5qcyc7XG5pbXBvcnQge2dldFByfSBmcm9tICcuLi8uLi91dGlscy9naXRodWIuanMnO1xuXG4vKiBHcmFwaHFsIHNjaGVtYSBmb3IgdGhlIHJlc3BvbnNlIGJvZHkgZm9yIGEgcGVuZGluZyBQUi4gKi9cbmNvbnN0IFBSX1NDSEVNQSA9IHtcbiAgYXV0aG9yOiB7XG4gICAgbG9naW46IGdyYXBocWxUeXBlcy5zdHJpbmcsXG4gIH0sXG4gIHN0YXRlOiBncmFwaHFsVHlwZXMuc3RyaW5nLFxuICBtYWludGFpbmVyQ2FuTW9kaWZ5OiBncmFwaHFsVHlwZXMuYm9vbGVhbixcbiAgdmlld2VyRGlkQXV0aG9yOiBncmFwaHFsVHlwZXMuYm9vbGVhbixcbiAgaGVhZFJlZk9pZDogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgaGVhZFJlZjoge1xuICAgIG5hbWU6IGdyYXBocWxUeXBlcy5zdHJpbmcsXG4gICAgcmVwb3NpdG9yeToge1xuICAgICAgdXJsOiBncmFwaHFsVHlwZXMuc3RyaW5nLFxuICAgICAgbmFtZVdpdGhPd25lcjogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgICB9LFxuICB9LFxuICBiYXNlUmVmT2lkOiBncmFwaHFsVHlwZXMuc3RyaW5nLFxuICBiYXNlUmVmOiB7XG4gICAgbmFtZTogZ3JhcGhxbFR5cGVzLnN0cmluZyxcbiAgICByZXBvc2l0b3J5OiB7XG4gICAgICB1cmw6IGdyYXBocWxUeXBlcy5zdHJpbmcsXG4gICAgICBuYW1lV2l0aE93bmVyOiBncmFwaHFsVHlwZXMuc3RyaW5nLFxuICAgIH0sXG4gIH0sXG59O1xuXG4vKiogRXJyb3IgYmVpbmcgdGhyb3duIGlmIHRoZXJlIGFyZSB1bmV4cGVjdGVkIGxvY2FsIGNoYW5nZXMgaW4gdGhlIHByb2plY3QgcmVwby4gKi9cbmV4cG9ydCBjbGFzcyBVbmV4cGVjdGVkTG9jYWxDaGFuZ2VzRXJyb3IgZXh0ZW5kcyBFcnJvciB7fVxuLyoqIEVycm9yIGJlaW5nIHRocm93biBpZiBhIHJlcXVlc3RlZCBwdWxsIHJlcXVlc3QgY291bGQgbm90IGJlIGZvdW5kIHVwc3RyZWFtLiAqL1xuZXhwb3J0IGNsYXNzIFB1bGxSZXF1ZXN0Tm90Rm91bmRFcnJvciBleHRlbmRzIEVycm9yIHt9XG4vKiogRXJyb3IgYmVpbmcgdGhyb3duIGlmIHRoZSBwdWxsIHJlcXVlc3QgZG9lcyBub3QgYWxsb3cgZm9yIG1haW50YWluZXIgbW9kaWZpY2F0aW9ucy4gKi9cbmV4cG9ydCBjbGFzcyBNYWludGFpbmVyTW9kaWZ5QWNjZXNzRXJyb3IgZXh0ZW5kcyBFcnJvciB7fVxuXG4vKiogT3B0aW9ucyBmb3IgY2hlY2tpbmcgb3V0IGEgUFIgKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHVsbFJlcXVlc3RDaGVja291dE9wdGlvbnMge1xuICAvKiogV2hldGhlciB0aGUgUFIgc2hvdWxkIGJlIGNoZWNrZWQgb3V0IGlmIHRoZSBtYWludGFpbmVyIGNhbm5vdCBtb2RpZnkuICovXG4gIGFsbG93SWZNYWludGFpbmVyQ2Fubm90TW9kaWZ5PzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBSZWJhc2UgdGhlIHByb3ZpZGVkIFBSIG9udG8gaXRzIG1lcmdlIHRhcmdldCBicmFuY2gsIGFuZCBwdXNoIHVwIHRoZSByZXN1bHRpbmdcbiAqIGNvbW1pdCB0byB0aGUgUFJzIHJlcG9zaXRvcnkuXG4gKlxuICogQHRocm93cyB7VW5leHBlY3RlZExvY2FsQ2hhbmdlc0Vycm9yfSBJZiB0aGUgcHVsbCByZXF1ZXN0IGNhbm5vdCBiZSBjaGVja2VkIG91dFxuICogICBkdWUgdG8gdW5jb21taXR0ZWQgbG9jYWwgY2hhbmdlcy5cbiAqIEB0aHJvd3Mge1B1bGxSZXF1ZXN0Tm90Rm91bmRFcnJvcn0gSWYgdGhlIHB1bGwgcmVxdWVzdCBjYW5ub3QgYmUgY2hlY2tlZCBvdXRcbiAqICAgYmVjYXVzZSBpdCBpcyB1bmF2YWlsYWJsZSBvbiBHaXRodWIuXG4gKiBAdGhyb3dzIHtNYWludGFpbmVyTW9kaWZ5QWNjZXNzRXJyb3J9IElmIHRoZSBwdWxsIHJlcXVlc3QgZG9lcyBub3QgYWxsb3cgbWFpbnRhaW5lcnNcbiAqICAgdG8gbW9kaWZ5IGEgcHVsbCByZXF1ZXN0LiBTa2lwcGVkIGlmIGBhbGxvd0lmTWFpbnRhaW5lckNhbm5vdE1vZGlmeWAgaXMgc2V0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2hlY2tPdXRQdWxsUmVxdWVzdExvY2FsbHkoXG4gIHByTnVtYmVyOiBudW1iZXIsXG4gIG9wdHM6IFB1bGxSZXF1ZXN0Q2hlY2tvdXRPcHRpb25zID0ge30sXG4pIHtcbiAgLyoqIFRoZSBzaW5nbGV0b24gaW5zdGFuY2Ugb2YgdGhlIGF1dGhlbnRpY2F0ZWQgZ2l0IGNsaWVudC4gKi9cbiAgY29uc3QgZ2l0ID0gYXdhaXQgQXV0aGVudGljYXRlZEdpdENsaWVudC5nZXQoKTtcblxuICAvLyBJbiBvcmRlciB0byBwcmVzZXJ2ZSBsb2NhbCBjaGFuZ2VzLCBjaGVja291dHMgY2Fubm90IG9jY3VyIGlmIGxvY2FsIGNoYW5nZXMgYXJlIHByZXNlbnQgaW4gdGhlXG4gIC8vIGdpdCBlbnZpcm9ubWVudC4gQ2hlY2tlZCBiZWZvcmUgcmV0cmlldmluZyB0aGUgUFIgdG8gZmFpbCBmYXN0LlxuICBpZiAoZ2l0Lmhhc1VuY29tbWl0dGVkQ2hhbmdlcygpKSB7XG4gICAgdGhyb3cgbmV3IFVuZXhwZWN0ZWRMb2NhbENoYW5nZXNFcnJvcignVW5hYmxlIHRvIGNoZWNrb3V0IFBSIGR1ZSB0byB1bmNvbW1pdHRlZCBjaGFuZ2VzLicpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBicmFuY2ggb3IgcmV2aXNpb24gb3JpZ2luYWxseSBjaGVja2VkIG91dCBiZWZvcmUgdGhpcyBtZXRob2QgcGVyZm9ybWVkXG4gICAqIGFueSBHaXQgb3BlcmF0aW9ucyB0aGF0IG1heSBjaGFuZ2UgdGhlIHdvcmtpbmcgYnJhbmNoLlxuICAgKi9cbiAgY29uc3QgcHJldmlvdXNCcmFuY2hPclJldmlzaW9uID0gZ2l0LmdldEN1cnJlbnRCcmFuY2hPclJldmlzaW9uKCk7XG4gIC8qKiBUaGUgUFIgaW5mb3JtYXRpb24gZnJvbSBHaXRodWIuICovXG4gIGNvbnN0IHByID0gYXdhaXQgZ2V0UHIoUFJfU0NIRU1BLCBwck51bWJlciwgZ2l0KTtcblxuICBpZiAocHIgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgUHVsbFJlcXVlc3ROb3RGb3VuZEVycm9yKGBQdWxsIHJlcXVlc3QgIyR7cHJOdW1iZXJ9IGNvdWxkIG5vdCBiZSBmb3VuZC5gKTtcbiAgfVxuXG4gIC8qKiBUaGUgYnJhbmNoIG5hbWUgb2YgdGhlIFBSIGZyb20gdGhlIHJlcG9zaXRvcnkgdGhlIFBSIGNhbWUgZnJvbS4gKi9cbiAgY29uc3QgaGVhZFJlZk5hbWUgPSBwci5oZWFkUmVmLm5hbWU7XG4gIC8qKiBUaGUgZnVsbCByZWYgZm9yIHRoZSByZXBvc2l0b3J5IGFuZCBicmFuY2ggdGhlIFBSIGNhbWUgZnJvbS4gKi9cbiAgY29uc3QgZnVsbEhlYWRSZWYgPSBgJHtwci5oZWFkUmVmLnJlcG9zaXRvcnkubmFtZVdpdGhPd25lcn06JHtoZWFkUmVmTmFtZX1gO1xuICAvKiogVGhlIGZ1bGwgVVJMIHBhdGggb2YgdGhlIHJlcG9zaXRvcnkgdGhlIFBSIGNhbWUgZnJvbSB3aXRoIGdpdGh1YiB0b2tlbiBhcyBhdXRoZW50aWNhdGlvbi4gKi9cbiAgY29uc3QgaGVhZFJlZlVybCA9IGFkZFRva2VuVG9HaXRIdHRwc1VybChwci5oZWFkUmVmLnJlcG9zaXRvcnkudXJsLCBnaXQuZ2l0aHViVG9rZW4pO1xuICAvLyBOb3RlOiBTaW5jZSB3ZSB1c2UgYSBkZXRhY2hlZCBoZWFkIGZvciByZWJhc2luZyB0aGUgUFIgYW5kIHRoZXJlZm9yZSBkbyBub3QgaGF2ZVxuICAvLyByZW1vdGUtdHJhY2tpbmcgYnJhbmNoZXMgY29uZmlndXJlZCwgd2UgbmVlZCB0byBzZXQgb3VyIGV4cGVjdGVkIHJlZiBhbmQgU0hBLiBUaGlzXG4gIC8vIGFsbG93cyB1cyB0byB1c2UgYC0tZm9yY2Utd2l0aC1sZWFzZWAgZm9yIHRoZSBkZXRhY2hlZCBoZWFkIHdoaWxlIGVuc3VyaW5nIHRoYXQgd2VcbiAgLy8gbmV2ZXIgYWNjaWRlbnRhbGx5IG92ZXJyaWRlIHVwc3RyZWFtIGNoYW5nZXMgdGhhdCBoYXZlIGJlZW4gcHVzaGVkIGluIHRoZSBtZWFud2hpbGUuXG4gIC8vIFNlZTpcbiAgLy8gaHR0cHM6Ly9naXQtc2NtLmNvbS9kb2NzL2dpdC1wdXNoI0RvY3VtZW50YXRpb24vZ2l0LXB1c2gudHh0LS0tZm9yY2Utd2l0aC1sZWFzZWx0cmVmbmFtZWd0bHRleHBlY3RndFxuICAvKiogRmxhZyBmb3IgYSBmb3JjZSBwdXNoIHdpdGggbGVhc2UgYmFjayB0byB1cHN0cmVhbS4gKi9cbiAgY29uc3QgZm9yY2VXaXRoTGVhc2VGbGFnID0gYC0tZm9yY2Utd2l0aC1sZWFzZT0ke2hlYWRSZWZOYW1lfToke3ByLmhlYWRSZWZPaWR9YDtcblxuICAvLyBJZiB0aGUgUFIgZG9lcyBub3QgYWxsb3cgbWFpbnRhaW5lcnMgdG8gbW9kaWZ5IGl0LCBleGl0IGFzIHRoZSByZWJhc2VkIFBSIGNhbm5vdFxuICAvLyBiZSBwdXNoZWQgdXAuXG4gIGlmICghcHIubWFpbnRhaW5lckNhbk1vZGlmeSAmJiAhcHIudmlld2VyRGlkQXV0aG9yICYmICFvcHRzLmFsbG93SWZNYWludGFpbmVyQ2Fubm90TW9kaWZ5KSB7XG4gICAgdGhyb3cgbmV3IE1haW50YWluZXJNb2RpZnlBY2Nlc3NFcnJvcignUFIgaXMgbm90IHNldCB0byBhbGxvdyBtYWludGFpbmVycyB0byBtb2RpZnkgdGhlIFBSJyk7XG4gIH1cblxuICB0cnkge1xuICAgIC8vIEZldGNoIHRoZSBicmFuY2ggYXQgdGhlIGNvbW1pdCBvZiB0aGUgUFIsIGFuZCBjaGVjayBpdCBvdXQgaW4gYSBkZXRhY2hlZCBzdGF0ZS5cbiAgICBnaXQucnVuKFsnZmV0Y2gnLCAnLXEnLCBoZWFkUmVmVXJsLCBoZWFkUmVmTmFtZV0pO1xuICAgIGdpdC5ydW4oWydjaGVja291dCcsICctLWRldGFjaCcsICdGRVRDSF9IRUFEJ10pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgZ2l0LmNoZWNrb3V0KHByZXZpb3VzQnJhbmNoT3JSZXZpc2lvbiwgdHJ1ZSk7XG4gICAgdGhyb3cgZTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogUHVzaGVzIHRoZSBjdXJyZW50IGxvY2FsIGJyYW5jaCB0byB0aGUgUFIgb24gdGhlIHVwc3RyZWFtIHJlcG9zaXRvcnkuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB0cnVlIElmIHRoZSBjb21tYW5kIGRpZCBub3QgZmFpbCBjYXVzaW5nIGEgR2l0Q29tbWFuZEVycm9yIHRvIGJlIHRocm93bi5cbiAgICAgKiBAdGhyb3dzIHtHaXRDb21tYW5kRXJyb3J9IFRocm93biB3aGVuIHRoZSBwdXNoIGJhY2sgdG8gdXBzdHJlYW0gZmFpbHMuXG4gICAgICovXG4gICAgcHVzaFRvVXBzdHJlYW06ICgpOiB0cnVlID0+IHtcbiAgICAgIGdpdC5ydW4oWydwdXNoJywgaGVhZFJlZlVybCwgYEhFQUQ6JHtoZWFkUmVmTmFtZX1gLCBmb3JjZVdpdGhMZWFzZUZsYWddKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG4gICAgLyoqIFJlc3RvcmVzIHRoZSBzdGF0ZSBvZiB0aGUgbG9jYWwgcmVwb3NpdG9yeSB0byBiZWZvcmUgdGhlIFBSIGNoZWNrb3V0IG9jY3VyZWQuICovXG4gICAgcmVzZXRHaXRTdGF0ZTogKCk6IGJvb2xlYW4gPT4ge1xuICAgICAgcmV0dXJuIGdpdC5jaGVja291dChwcmV2aW91c0JyYW5jaE9yUmV2aXNpb24sIHRydWUpO1xuICAgIH0sXG4gICAgcHVzaFRvVXBzdHJlYW1Db21tYW5kOiBgZ2l0IHB1c2ggJHtwci5oZWFkUmVmLnJlcG9zaXRvcnkudXJsfSBIRUFEOiR7aGVhZFJlZk5hbWV9ICR7Zm9yY2VXaXRoTGVhc2VGbGFnfWAsXG4gICAgcmVzZXRHaXRTdGF0ZUNvbW1hbmQ6IGBnaXQgcmViYXNlIC0tYWJvcnQgJiYgZ2l0IHJlc2V0IC0taGFyZCAmJiBnaXQgY2hlY2tvdXQgJHtwcmV2aW91c0JyYW5jaE9yUmV2aXNpb259YCxcbiAgICBwdWxsUmVxdWVzdDogcHIsXG4gIH07XG59XG4iXX0=