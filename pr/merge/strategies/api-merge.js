/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { parseCommitMessage } from '../../../commit-message/parse.js';
import { MergeStrategy } from './strategy.js';
import { isGithubApiError } from '../../../utils/git/github.js';
import { FatalMergeToolError, MergeConflictsFatalError } from '../failures.js';
import { Prompt } from '../../../utils/prompt.js';
/** Separator between commit message header and body. */
const COMMIT_HEADER_SEPARATOR = '\n\n';
/**
 * Merge strategy that primarily leverages the Github API. The strategy merges a given
 * pull request into a target branch using the API. This ensures that Github displays
 * the pull request as merged. The merged commits are then cherry-picked into the remaining
 * target branches using the local Git instance. The benefit is that the Github merged state
 * is properly set, but a notable downside is that PRs cannot use fixup or squash commits.
 */
export class GithubApiMergeStrategy extends MergeStrategy {
    constructor(git, _config) {
        super(git);
        this._config = _config;
    }
    /**
     * Merges the specified pull request via the Github API, cherry-picks the change into the other
     * target branhces and pushes the branches upstream.
     *
     * @throws {GitCommandError} An unknown Git command error occurred that is not
     *   specific to the pull request merge.
     * @throws {FatalMergeToolError} A fatal error if the merge could not be performed.
     */
    async merge(pullRequest) {
        const { githubTargetBranch, prNumber, needsCommitMessageFixup, targetBranches } = pullRequest;
        const method = this._getMergeActionFromPullRequest(pullRequest);
        const cherryPickTargetBranches = targetBranches.filter((b) => b !== githubTargetBranch);
        const mergeOptions = {
            pull_number: prNumber,
            merge_method: method,
            ...this.git.remoteParams,
        };
        if (needsCommitMessageFixup) {
            // Commit message fixup does not work with other merge methods as the Github API only
            // allows commit message modifications for squash merging.
            if (method !== 'squash') {
                throw new FatalMergeToolError(`Unable to fixup commit message of pull request. Commit message can only be ` +
                    `modified if the PR is merged using squash.`);
            }
            await this._promptCommitMessageEdit(pullRequest, mergeOptions);
        }
        let mergeStatusCode;
        let mergeResponseMessage;
        let targetSha;
        try {
            // Merge the pull request using the Github API into the selected base branch.
            const result = await this.git.github.pulls.merge(mergeOptions);
            mergeStatusCode = result.status;
            mergeResponseMessage = result.data.message;
            targetSha = result.data.sha;
        }
        catch (e) {
            // Note: Github usually returns `404` as status code if the API request uses a
            // token with insufficient permissions. Github does this because it doesn't want
            // to leak whether a repository exists or not. In our case we expect a certain
            // repository to exist, so we always treat this as a permission failure.
            if (isGithubApiError(e) && (e.status === 403 || e.status === 404)) {
                throw new FatalMergeToolError('Insufficient Github API permissions to merge pull request.');
            }
            throw e;
        }
        // https://developer.github.com/v3/pulls/#response-if-merge-cannot-be-performed
        // Pull request cannot be merged due to merge conflicts.
        if (mergeStatusCode === 405) {
            throw new MergeConflictsFatalError([githubTargetBranch]);
        }
        if (mergeStatusCode !== 200) {
            throw new FatalMergeToolError(`Unexpected merge status code: ${mergeStatusCode}: ${mergeResponseMessage}`);
        }
        // If the PR does not need to be merged into any other target branches,
        // we exit here as we already completed the merge.
        if (!cherryPickTargetBranches.length) {
            return;
        }
        // Refresh the target branch the PR has been merged into through the API. We need
        // to re-fetch as otherwise we cannot cherry-pick the new commits into the remaining
        // target branches.
        this.fetchTargetBranches([githubTargetBranch]);
        // Number of commits that have landed in the target branch. This could vary from
        // the count of commits in the PR due to squashing.
        const targetCommitsCount = method === 'squash' ? 1 : pullRequest.commitCount;
        // Cherry pick the merged commits into the remaining target branches.
        const failedBranches = await this.cherryPickIntoTargetBranches(`${targetSha}~${targetCommitsCount}..${targetSha}`, cherryPickTargetBranches, {
            // Commits that have been created by the Github API do not necessarily contain
            // a reference to the source pull request (unless the squash strategy is used).
            // To ensure that original commits can be found when a commit is viewed in a
            // target branch, we add a link to the original commits when cherry-picking.
            linkToOriginalCommits: true,
        });
        // We already checked whether the PR can be cherry-picked into the target branches,
        // but in case the cherry-pick somehow fails, we still handle the conflicts here. The
        // commits created through the Github API could be different (i.e. through squash).
        if (failedBranches.length) {
            throw new MergeConflictsFatalError(failedBranches);
        }
        this.pushTargetBranchesUpstream(cherryPickTargetBranches);
        // Because our process brings changes into multiple branchces, we include a comment which
        // expresses all of the branches the changes were merged into.
        await this.git.github.issues.createComment({
            ...this.git.remoteParams,
            issue_number: pullRequest.prNumber,
            body: `The changes were merged into the following branches: ${targetBranches.join(', ')}`,
        });
    }
    /**
     * Prompts the user for the commit message changes. Unlike as in the autosquash merge
     * strategy, we cannot start an interactive rebase because we merge using the Github API.
     * The Github API only allows modifications to PR title and body for squash merges.
     */
    async _promptCommitMessageEdit(pullRequest, mergeOptions) {
        const commitMessage = await this._getDefaultSquashCommitMessage(pullRequest);
        const result = await Prompt.editor({
            message: 'Please update the commit message',
            default: commitMessage,
        });
        // Split the new message into title and message. This is necessary because the
        // Github API expects title and message to be passed separately.
        const [newTitle, ...newMessage] = result.split(COMMIT_HEADER_SEPARATOR);
        // Update the merge options so that the changes are reflected in there.
        mergeOptions.commit_title = `${newTitle} (#${pullRequest.prNumber})`;
        mergeOptions.commit_message = newMessage.join(COMMIT_HEADER_SEPARATOR);
    }
    /**
     * Gets a commit message for the given pull request. Github by default concatenates
     * multiple commit messages if a PR is merged in squash mode. We try to replicate this
     * behavior here so that we have a default commit message that can be fixed up.
     */
    async _getDefaultSquashCommitMessage(pullRequest) {
        const commits = (await this._getPullRequestCommitMessages(pullRequest)).map((message) => ({
            message,
            parsed: parseCommitMessage(message),
        }));
        const messageBase = `${pullRequest.title}${COMMIT_HEADER_SEPARATOR}`;
        if (commits.length <= 1) {
            return `${messageBase}${commits[0].parsed.body}`;
        }
        const joinedMessages = commits.map((c) => `* ${c.message}`).join(COMMIT_HEADER_SEPARATOR);
        return `${messageBase}${joinedMessages}`;
    }
    /** Gets all commit messages of commits in the pull request. */
    async _getPullRequestCommitMessages({ prNumber }) {
        const allCommits = await this.git.github.paginate(this.git.github.pulls.listCommits, {
            ...this.git.remoteParams,
            pull_number: prNumber,
        });
        return allCommits.map(({ commit }) => commit.message);
    }
    /** Determines the merge action from the given pull request. */
    _getMergeActionFromPullRequest({ labels }) {
        if (this._config.labels) {
            const matchingLabel = this._config.labels.find(({ pattern }) => labels.includes(pattern));
            if (matchingLabel !== undefined) {
                return matchingLabel.method;
            }
        }
        return this._config.default;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLW1lcmdlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL21lcmdlL3N0cmF0ZWdpZXMvYXBpLW1lcmdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sRUFBQyxrQkFBa0IsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBS3BFLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDNUMsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDOUQsT0FBTyxFQUFDLG1CQUFtQixFQUFFLHdCQUF3QixFQUFDLE1BQU0sZ0JBQWdCLENBQUM7QUFDN0UsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBUWhELHdEQUF3RDtBQUN4RCxNQUFNLHVCQUF1QixHQUFHLE1BQU0sQ0FBQztBQUV2Qzs7Ozs7O0dBTUc7QUFDSCxNQUFNLE9BQU8sc0JBQXVCLFNBQVEsYUFBYTtJQUN2RCxZQUNFLEdBQTJCLEVBQ25CLE9BQXFDO1FBRTdDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUZILFlBQU8sR0FBUCxPQUFPLENBQThCO0lBRy9DLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ00sS0FBSyxDQUFDLEtBQUssQ0FBQyxXQUF3QjtRQUMzQyxNQUFNLEVBQUMsa0JBQWtCLEVBQUUsUUFBUSxFQUFFLHVCQUF1QixFQUFFLGNBQWMsRUFBQyxHQUFHLFdBQVcsQ0FBQztRQUM1RixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsOEJBQThCLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDaEUsTUFBTSx3QkFBd0IsR0FBRyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssa0JBQWtCLENBQUMsQ0FBQztRQUV4RixNQUFNLFlBQVksR0FBdUI7WUFDdkMsV0FBVyxFQUFFLFFB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TSxhQUFhLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBQyxPQUFPLEVBQUMsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ3hGLElBQUksYUFBYSxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUNoQyxPQUFPLGFBQWEsQ0FBQyxNQUFNLENBQUM7WUFDOUIsQ0FBQztRQUNILENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO0lBQzlCLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1Jlc3RFbmRwb2ludE1ldGhvZFR5cGVzfSBmcm9tICdAb2N0b2tpdC9wbHVnaW4tcmVzdC1lbmRwb2ludC1tZXRob2RzJztcblxuaW1wb3J0IHtwYXJzZUNvbW1pdE1lc3NhZ2V9IGZyb20gJy4uLy4uLy4uL2NvbW1pdC1tZXNzYWdlL3BhcnNlLmpzJztcbmltcG9ydCB7QXV0aGVudGljYXRlZEdpdENsaWVudH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvZ2l0L2F1dGhlbnRpY2F0ZWQtZ2l0LWNsaWVudC5qcyc7XG5pbXBvcnQge0dpdGh1YkFwaU1lcmdlTWV0aG9kLCBHaXRodWJBcGlNZXJnZVN0cmF0ZWd5Q29uZmlnfSBmcm9tICcuLi8uLi9jb25maWcvaW5kZXguanMnO1xuaW1wb3J0IHtQdWxsUmVxdWVzdH0gZnJvbSAnLi4vcHVsbC1yZXF1ZXN0LmpzJztcblxuaW1wb3J0IHtNZXJnZVN0cmF0ZWd5fSBmcm9tICcuL3N0cmF0ZWd5LmpzJztcbmltcG9ydCB7aXNHaXRodWJBcGlFcnJvcn0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi5qcyc7XG5pbXBvcnQge0ZhdGFsTWVyZ2VUb29sRXJyb3IsIE1lcmdlQ29uZmxpY3RzRmF0YWxFcnJvcn0gZnJvbSAnLi4vZmFpbHVyZXMuanMnO1xuaW1wb3J0IHtQcm9tcHR9IGZyb20gJy4uLy4uLy4uL3V0aWxzL3Byb21wdC5qcyc7XG5cbi8qKiBUeXBlIGRlc2NyaWJpbmcgdGhlIHBhcmFtZXRlcnMgZm9yIHRoZSBPY3Rva2l0IGBtZXJnZWAgQVBJIGVuZHBvaW50LiAqL1xudHlwZSBPY3Rva2l0TWVyZ2VQYXJhbXMgPSBSZXN0RW5kcG9pbnRNZXRob2RUeXBlc1sncHVsbHMnXVsnbWVyZ2UnXVsncGFyYW1ldGVycyddO1xuXG50eXBlIE9jdG9raXRQdWxsUmVxdWVzdENvbW1pdHNMaXN0ID1cbiAgUmVzdEVuZHBvaW50TWV0aG9kVHlwZXNbJ3B1bGxzJ11bJ2xpc3RDb21taXRzJ11bJ3Jlc3BvbnNlJ11bJ2RhdGEnXTtcblxuLyoqIFNlcGFyYXRvciBiZXR3ZWVuIGNvbW1pdCBtZXNzYWdlIGhlYWRlciBhbmQgYm9keS4gKi9cbmNvbnN0IENPTU1JVF9IRUFERVJfU0VQQVJBVE9SID0gJ1xcblxcbic7XG5cbi8qKlxuICogTWVyZ2Ugc3RyYXRlZ3kgdGhhdCBwcmltYXJpbHkgbGV2ZXJhZ2VzIHRoZSBHaXRodWIgQVBJLiBUaGUgc3RyYXRlZ3kgbWVyZ2VzIGEgZ2l2ZW5cbiAqIHB1bGwgcmVxdWVzdCBpbnRvIGEgdGFyZ2V0IGJyYW5jaCB1c2luZyB0aGUgQVBJLiBUaGlzIGVuc3VyZXMgdGhhdCBHaXRodWIgZGlzcGxheXNcbiAqIHRoZSBwdWxsIHJlcXVlc3QgYXMgbWVyZ2VkLiBUaGUgbWVyZ2VkIGNvbW1pdHMgYXJlIHRoZW4gY2hlcnJ5LXBpY2tlZCBpbnRvIHRoZSByZW1haW5pbmdcbiAqIHRhcmdldCBicmFuY2hlcyB1c2luZyB0aGUgbG9jYWwgR2l0IGluc3RhbmNlLiBUaGUgYmVuZWZpdCBpcyB0aGF0IHRoZSBHaXRodWIgbWVyZ2VkIHN0YXRlXG4gKiBpcyBwcm9wZXJseSBzZXQsIGJ1dCBhIG5vdGFibGUgZG93bnNpZGUgaXMgdGhhdCBQUnMgY2Fubm90IHVzZSBmaXh1cCBvciBzcXVhc2ggY29tbWl0cy5cbiAqL1xuZXhwb3J0IGNsYXNzIEdpdGh1YkFwaU1lcmdlU3RyYXRlZ3kgZXh0ZW5kcyBNZXJnZVN0cmF0ZWd5IHtcbiAgY29uc3RydWN0b3IoXG4gICAgZ2l0OiBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LFxuICAgIHByaXZhdGUgX2NvbmZpZzogR2l0aHViQXBpTWVyZ2VTdHJhdGVneUNvbmZpZyxcbiAgKSB7XG4gICAgc3VwZXIoZ2l0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNZXJnZXMgdGhlIHNwZWNpZmllZCBwdWxsIHJlcXVlc3QgdmlhIHRoZSBHaXRodWIgQVBJLCBjaGVycnktcGlja3MgdGhlIGNoYW5nZSBpbnRvIHRoZSBvdGhlclxuICAgKiB0YXJnZXQgYnJhbmhjZXMgYW5kIHB1c2hlcyB0aGUgYnJhbmNoZXMgdXBzdHJlYW0uXG4gICAqXG4gICAqIEB0aHJvd3Mge0dpdENvbW1hbmRFcnJvcn0gQW4gdW5rbm93biBHaXQgY29tbWFuZCBlcnJvciBvY2N1cnJlZCB0aGF0IGlzIG5vdFxuICAgKiAgIHNwZWNpZmljIHRvIHRoZSBwdWxsIHJlcXVlc3QgbWVyZ2UuXG4gICAqIEB0aHJvd3Mge0ZhdGFsTWVyZ2VUb29sRXJyb3J9IEEgZmF0YWwgZXJyb3IgaWYgdGhlIG1lcmdlIGNvdWxkIG5vdCBiZSBwZXJmb3JtZWQuXG4gICAqL1xuICBvdmVycmlkZSBhc3luYyBtZXJnZShwdWxsUmVxdWVzdDogUHVsbFJlcXVlc3QpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7Z2l0aHViVGFyZ2V0QnJhbmNoLCBwck51bWJlciwgbmVlZHNDb21taXRNZXNzYWdlRml4dXAsIHRhcmdldEJyYW5jaGVzfSA9IHB1bGxSZXF1ZXN0O1xuICAgIGNvbnN0IG1ldGhvZCA9IHRoaXMuX2dldE1lcmdlQWN0aW9uRnJvbVB1bGxSZXF1ZXN0KHB1bGxSZXF1ZXN0KTtcbiAgICBjb25zdCBjaGVycnlQaWNrVGFyZ2V0QnJhbmNoZXMgPSB0YXJnZXRCcmFuY2hlcy5maWx0ZXIoKGIpID0+IGIgIT09IGdpdGh1YlRhcmdldEJyYW5jaCk7XG5cbiAgICBjb25zdCBtZXJnZU9wdGlvbnM6IE9jdG9raXRNZXJnZVBhcmFtcyA9IHtcbiAgICAgIHB1bGxfbnVtYmVyOiBwck51bWJlcixcbiAgICAgIG1lcmdlX21ldGhvZDogbWV0aG9kLFxuICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgIH07XG5cbiAgICBpZiAobmVlZHNDb21taXRNZXNzYWdlRml4dXApIHtcbiAgICAgIC8vIENvbW1pdCBtZXNzYWdlIGZpeHVwIGRvZXMgbm90IHdvcmsgd2l0aCBvdGhlciBtZXJnZSBtZXRob2RzIGFzIHRoZSBHaXRodWIgQVBJIG9ubHlcbiAgICAgIC8vIGFsbG93cyBjb21taXQgbWVzc2FnZSBtb2RpZmljYXRpb25zIGZvciBzcXVhc2ggbWVyZ2luZy5cbiAgICAgIGlmIChtZXRob2QgIT09ICdzcXVhc2gnKSB7XG4gICAgICAgIHRocm93IG5ldyBGYXRhbE1lcmdlVG9vbEVycm9yKFxuICAgICAgICAgIGBVbmFibGUgdG8gZml4dXAgY29tbWl0IG1lc3NhZ2Ugb2YgcHVsbCByZXF1ZXN0LiBDb21taXQgbWVzc2FnZSBjYW4gb25seSBiZSBgICtcbiAgICAgICAgICAgIGBtb2RpZmllZCBpZiB0aGUgUFIgaXMgbWVyZ2VkIHVzaW5nIHNxdWFzaC5gLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgYXdhaXQgdGhpcy5fcHJvbXB0Q29tbWl0TWVzc2FnZUVkaXQocHVsbFJlcXVlc3QsIG1lcmdlT3B0aW9ucyk7XG4gICAgfVxuXG4gICAgbGV0IG1lcmdlU3RhdHVzQ29kZTogbnVtYmVyO1xuICAgIGxldCBtZXJnZVJlc3BvbnNlTWVzc2FnZTogc3RyaW5nO1xuICAgIGxldCB0YXJnZXRTaGE6IHN0cmluZztcblxuICAgIHRyeSB7XG4gICAgICAvLyBNZXJnZSB0aGUgcHVsbCByZXF1ZXN0IHVzaW5nIHRoZSBHaXRodWIgQVBJIGludG8gdGhlIHNlbGVjdGVkIGJhc2UgYnJhbmNoLlxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5naXQuZ2l0aHViLnB1bGxzLm1lcmdlKG1lcmdlT3B0aW9ucyk7XG5cbiAgICAgIG1lcmdlU3RhdHVzQ29kZSA9IHJlc3VsdC5zdGF0dXM7XG4gICAgICBtZXJnZVJlc3BvbnNlTWVzc2FnZSA9IHJlc3VsdC5kYXRhLm1lc3NhZ2U7XG4gICAgICB0YXJnZXRTaGEgPSByZXN1bHQuZGF0YS5zaGE7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gTm90ZTogR2l0aHViIHVzdWFsbHkgcmV0dXJucyBgNDA0YCBhcyBzdGF0dXMgY29kZSBpZiB0aGUgQVBJIHJlcXVlc3QgdXNlcyBhXG4gICAgICAvLyB0b2tlbiB3aXRoIGluc3VmZmljaWVudCBwZXJtaXNzaW9ucy4gR2l0aHViIGRvZXMgdGhpcyBiZWNhdXNlIGl0IGRvZXNuJ3Qgd2FudFxuICAgICAgLy8gdG8gbGVhayB3aGV0aGVyIGEgcmVwb3NpdG9yeSBleGlzdHMgb3Igbm90LiBJbiBvdXIgY2FzZSB3ZSBleHBlY3QgYSBjZXJ0YWluXG4gICAgICAvLyByZXBvc2l0b3J5IHRvIGV4aXN0LCBzbyB3ZSBhbHdheXMgdHJlYXQgdGhpcyBhcyBhIHBlcm1pc3Npb24gZmFpbHVyZS5cbiAgICAgIGlmIChpc0dpdGh1YkFwaUVycm9yKGUpICYmIChlLnN0YXR1cyA9PT0gNDAzIHx8IGUuc3RhdHVzID09PSA0MDQpKSB7XG4gICAgICAgIHRocm93IG5ldyBGYXRhbE1lcmdlVG9vbEVycm9yKCdJbnN1ZmZpY2llbnQgR2l0aHViIEFQSSBwZXJtaXNzaW9ucyB0byBtZXJnZSBwdWxsIHJlcXVlc3QuJyk7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLmdpdGh1Yi5jb20vdjMvcHVsbHMvI3Jlc3BvbnNlLWlmLW1lcmdlLWNhbm5vdC1iZS1wZXJmb3JtZWRcbiAgICAvLyBQdWxsIHJlcXVlc3QgY2Fubm90IGJlIG1lcmdlZCBkdWUgdG8gbWVyZ2UgY29uZmxpY3RzLlxuICAgIGlmIChtZXJnZVN0YXR1c0NvZGUgPT09IDQwNSkge1xuICAgICAgdGhyb3cgbmV3IE1lcmdlQ29uZmxpY3RzRmF0YWxFcnJvcihbZ2l0aHViVGFyZ2V0QnJhbmNoXSk7XG4gICAgfVxuICAgIGlmIChtZXJnZVN0YXR1c0NvZGUgIT09IDIwMCkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsTWVyZ2VUb29sRXJyb3IoXG4gICAgICAgIGBVbmV4cGVjdGVkIG1lcmdlIHN0YXR1cyBjb2RlOiAke21lcmdlU3RhdHVzQ29kZX06ICR7bWVyZ2VSZXNwb25zZU1lc3NhZ2V9YCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIFBSIGRvZXMgbm90IG5lZWQgdG8gYmUgbWVyZ2VkIGludG8gYW55IG90aGVyIHRhcmdldCBicmFuY2hlcyxcbiAgICAvLyB3ZSBleGl0IGhlcmUgYXMgd2UgYWxyZWFkeSBjb21wbGV0ZWQgdGhlIG1lcmdlLlxuICAgIGlmICghY2hlcnJ5UGlja1RhcmdldEJyYW5jaGVzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFJlZnJlc2ggdGhlIHRhcmdldCBicmFuY2ggdGhlIFBSIGhhcyBiZWVuIG1lcmdlZCBpbnRvIHRocm91Z2ggdGhlIEFQSS4gV2UgbmVlZFxuICAgIC8vIHRvIHJlLWZldGNoIGFzIG90aGVyd2lzZSB3ZSBjYW5ub3QgY2hlcnJ5LXBpY2sgdGhlIG5ldyBjb21taXRzIGludG8gdGhlIHJlbWFpbmluZ1xuICAgIC8vIHRhcmdldCBicmFuY2hlcy5cbiAgICB0aGlzLmZldGNoVGFyZ2V0QnJhbmNoZXMoW2dpdGh1YlRhcmdldEJyYW5jaF0pO1xuXG4gICAgLy8gTnVtYmVyIG9mIGNvbW1pdHMgdGhhdCBoYXZlIGxhbmRlZCBpbiB0aGUgdGFyZ2V0IGJyYW5jaC4gVGhpcyBjb3VsZCB2YXJ5IGZyb21cbiAgICAvLyB0aGUgY291bnQgb2YgY29tbWl0cyBpbiB0aGUgUFIgZHVlIHRvIHNxdWFzaGluZy5cbiAgICBjb25zdCB0YXJnZXRDb21taXRzQ291bnQgPSBtZXRob2QgPT09ICdzcXVhc2gnID8gMSA6IHB1bGxSZXF1ZXN0LmNvbW1pdENvdW50O1xuXG4gICAgLy8gQ2hlcnJ5IHBpY2sgdGhlIG1lcmdlZCBjb21taXRzIGludG8gdGhlIHJlbWFpbmluZyB0YXJnZXQgYnJhbmNoZXMuXG4gICAgY29uc3QgZmFpbGVkQnJhbmNoZXMgPSBhd2FpdCB0aGlzLmNoZXJyeVBpY2tJbnRvVGFyZ2V0QnJhbmNoZXMoXG4gICAgICBgJHt0YXJnZXRTaGF9fiR7dGFyZ2V0Q29tbWl0c0NvdW50fS4uJHt0YXJnZXRTaGF9YCxcbiAgICAgIGNoZXJyeVBpY2tUYXJnZXRCcmFuY2hlcyxcbiAgICAgIHtcbiAgICAgICAgLy8gQ29tbWl0cyB0aGF0IGhhdmUgYmVlbiBjcmVhdGVkIGJ5IHRoZSBHaXRodWIgQVBJIGRvIG5vdCBuZWNlc3NhcmlseSBjb250YWluXG4gICAgICAgIC8vIGEgcmVmZXJlbmNlIHRvIHRoZSBzb3VyY2UgcHVsbCByZXF1ZXN0ICh1bmxlc3MgdGhlIHNxdWFzaCBzdHJhdGVneSBpcyB1c2VkKS5cbiAgICAgICAgLy8gVG8gZW5zdXJlIHRoYXQgb3JpZ2luYWwgY29tbWl0cyBjYW4gYmUgZm91bmQgd2hlbiBhIGNvbW1pdCBpcyB2aWV3ZWQgaW4gYVxuICAgICAgICAvLyB0YXJnZXQgYnJhbmNoLCB3ZSBhZGQgYSBsaW5rIHRvIHRoZSBvcmlnaW5hbCBjb21taXRzIHdoZW4gY2hlcnJ5LXBpY2tpbmcuXG4gICAgICAgIGxpbmtUb09yaWdpbmFsQ29tbWl0czogdHJ1ZSxcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIC8vIFdlIGFscmVhZHkgY2hlY2tlZCB3aGV0aGVyIHRoZSBQUiBjYW4gYmUgY2hlcnJ5LXBpY2tlZCBpbnRvIHRoZSB0YXJnZXQgYnJhbmNoZXMsXG4gICAgLy8gYnV0IGluIGNhc2UgdGhlIGNoZXJyeS1waWNrIHNvbWVob3cgZmFpbHMsIHdlIHN0aWxsIGhhbmRsZSB0aGUgY29uZmxpY3RzIGhlcmUuIFRoZVxuICAgIC8vIGNvbW1pdHMgY3JlYXRlZCB0aHJvdWdoIHRoZSBHaXRodWIgQVBJIGNvdWxkIGJlIGRpZmZlcmVudCAoaS5lLiB0aHJvdWdoIHNxdWFzaCkuXG4gICAgaWYgKGZhaWxlZEJyYW5jaGVzLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IE1lcmdlQ29uZmxpY3RzRmF0YWxFcnJvcihmYWlsZWRCcmFuY2hlcyk7XG4gICAgfVxuXG4gICAgdGhpcy5wdXNoVGFyZ2V0QnJhbmNoZXNVcHN0cmVhbShjaGVycnlQaWNrVGFyZ2V0QnJhbmNoZXMpO1xuXG4gICAgLy8gQmVjYXVzZSBvdXIgcHJvY2VzcyBicmluZ3MgY2hhbmdlcyBpbnRvIG11bHRpcGxlIGJyYW5jaGNlcywgd2UgaW5jbHVkZSBhIGNvbW1lbnQgd2hpY2hcbiAgICAvLyBleHByZXNzZXMgYWxsIG9mIHRoZSBicmFuY2hlcyB0aGUgY2hhbmdlcyB3ZXJlIG1lcmdlZCBpbnRvLlxuICAgIGF3YWl0IHRoaXMuZ2l0LmdpdGh1Yi5pc3N1ZXMuY3JlYXRlQ29tbWVudCh7XG4gICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICBpc3N1ZV9udW1iZXI6IHB1bGxSZXF1ZXN0LnByTnVtYmVyLFxuICAgICAgYm9keTogYFRoZSBjaGFuZ2VzIHdlcmUgbWVyZ2VkIGludG8gdGhlIGZvbGxvd2luZyBicmFuY2hlczogJHt0YXJnZXRCcmFuY2hlcy5qb2luKCcsICcpfWAsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUHJvbXB0cyB0aGUgdXNlciBmb3IgdGhlIGNvbW1pdCBtZXNzYWdlIGNoYW5nZXMuIFVubGlrZSBhcyBpbiB0aGUgYXV0b3NxdWFzaCBtZXJnZVxuICAgKiBzdHJhdGVneSwgd2UgY2Fubm90IHN0YXJ0IGFuIGludGVyYWN0aXZlIHJlYmFzZSBiZWNhdXNlIHdlIG1lcmdlIHVzaW5nIHRoZSBHaXRodWIgQVBJLlxuICAgKiBUaGUgR2l0aHViIEFQSSBvbmx5IGFsbG93cyBtb2RpZmljYXRpb25zIHRvIFBSIHRpdGxlIGFuZCBib2R5IGZvciBzcXVhc2ggbWVyZ2VzLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBfcHJvbXB0Q29tbWl0TWVzc2FnZUVkaXQoXG4gICAgcHVsbFJlcXVlc3Q6IFB1bGxSZXF1ZXN0LFxuICAgIG1lcmdlT3B0aW9uczogT2N0b2tpdE1lcmdlUGFyYW1zLFxuICApIHtcbiAgICBjb25zdCBjb21taXRNZXNzYWdlID0gYXdhaXQgdGhpcy5fZ2V0RGVmYXVsdFNxdWFzaENvbW1pdE1lc3NhZ2UocHVsbFJlcXVlc3QpO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IFByb21wdC5lZGl0b3Ioe1xuICAgICAgbWVzc2FnZTogJ1BsZWFzZSB1cGRhdGUgdGhlIGNvbW1pdCBtZXNzYWdlJyxcbiAgICAgIGRlZmF1bHQ6IGNvbW1pdE1lc3NhZ2UsXG4gICAgfSk7XG5cbiAgICAvLyBTcGxpdCB0aGUgbmV3IG1lc3NhZ2UgaW50byB0aXRsZSBhbmQgbWVzc2FnZS4gVGhpcyBpcyBuZWNlc3NhcnkgYmVjYXVzZSB0aGVcbiAgICAvLyBHaXRodWIgQVBJIGV4cGVjdHMgdGl0bGUgYW5kIG1lc3NhZ2UgdG8gYmUgcGFzc2VkIHNlcGFyYXRlbHkuXG4gICAgY29uc3QgW25ld1RpdGxlLCAuLi5uZXdNZXNzYWdlXSA9IHJlc3VsdC5zcGxpdChDT01NSVRfSEVBREVSX1NFUEFSQVRPUik7XG5cbiAgICAvLyBVcGRhdGUgdGhlIG1lcmdlIG9wdGlvbnMgc28gdGhhdCB0aGUgY2hhbmdlcyBhcmUgcmVmbGVjdGVkIGluIHRoZXJlLlxuICAgIG1lcmdlT3B0aW9ucy5jb21taXRfdGl0bGUgPSBgJHtuZXdUaXRsZX0gKCMke3B1bGxSZXF1ZXN0LnByTnVtYmVyfSlgO1xuICAgIG1lcmdlT3B0aW9ucy5jb21taXRfbWVzc2FnZSA9IG5ld01lc3NhZ2Uuam9pbihDT01NSVRfSEVBREVSX1NFUEFSQVRPUik7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyBhIGNvbW1pdCBtZXNzYWdlIGZvciB0aGUgZ2l2ZW4gcHVsbCByZXF1ZXN0LiBHaXRodWIgYnkgZGVmYXVsdCBjb25jYXRlbmF0ZXNcbiAgICogbXVsdGlwbGUgY29tbWl0IG1lc3NhZ2VzIGlmIGEgUFIgaXMgbWVyZ2VkIGluIHNxdWFzaCBtb2RlLiBXZSB0cnkgdG8gcmVwbGljYXRlIHRoaXNcbiAgICogYmVoYXZpb3IgaGVyZSBzbyB0aGF0IHdlIGhhdmUgYSBkZWZhdWx0IGNvbW1pdCBtZXNzYWdlIHRoYXQgY2FuIGJlIGZpeGVkIHVwLlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBfZ2V0RGVmYXVsdFNxdWFzaENvbW1pdE1lc3NhZ2UocHVsbFJlcXVlc3Q6IFB1bGxSZXF1ZXN0KTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBjb21taXRzID0gKGF3YWl0IHRoaXMuX2dldFB1bGxSZXF1ZXN0Q29tbWl0TWVzc2FnZXMocHVsbFJlcXVlc3QpKS5tYXAoKG1lc3NhZ2UpID0+ICh7XG4gICAgICBtZXNzYWdlLFxuICAgICAgcGFyc2VkOiBwYXJzZUNvbW1pdE1lc3NhZ2UobWVzc2FnZSksXG4gICAgfSkpO1xuICAgIGNvbnN0IG1lc3NhZ2VCYXNlID0gYCR7cHVsbFJlcXVlc3QudGl0bGV9JHtDT01NSVRfSEVBREVSX1NFUEFSQVRPUn1gO1xuICAgIGlmIChjb21taXRzLmxlbmd0aCA8PSAxKSB7XG4gICAgICByZXR1cm4gYCR7bWVzc2FnZUJhc2V9JHtjb21taXRzWzBdLnBhcnNlZC5ib2R5fWA7XG4gICAgfVxuICAgIGNvbnN0IGpvaW5lZE1lc3NhZ2VzID0gY29tbWl0cy5tYXAoKGMpID0+IGAqICR7Yy5tZXNzYWdlfWApLmpvaW4oQ09NTUlUX0hFQURFUl9TRVBBUkFUT1IpO1xuICAgIHJldHVybiBgJHttZXNzYWdlQmFzZX0ke2pvaW5lZE1lc3NhZ2VzfWA7XG4gIH1cblxuICAvKiogR2V0cyBhbGwgY29tbWl0IG1lc3NhZ2VzIG9mIGNvbW1pdHMgaW4gdGhlIHB1bGwgcmVxdWVzdC4gKi9cbiAgcHJpdmF0ZSBhc3luYyBfZ2V0UHVsbFJlcXVlc3RDb21taXRNZXNzYWdlcyh7cHJOdW1iZXJ9OiBQdWxsUmVxdWVzdCkge1xuICAgIGNvbnN0IGFsbENvbW1pdHM6IE9jdG9raXRQdWxsUmVxdWVzdENvbW1pdHNMaXN0ID0gYXdhaXQgdGhpcy5naXQuZ2l0aHViLnBhZ2luYXRlKFxuICAgICAgdGhpcy5naXQuZ2l0aHViLnB1bGxzLmxpc3RDb21taXRzLFxuICAgICAge1xuICAgICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICAgIHB1bGxfbnVtYmVyOiBwck51bWJlcixcbiAgICAgIH0sXG4gICAgKTtcbiAgICByZXR1cm4gYWxsQ29tbWl0cy5tYXAoKHtjb21taXR9KSA9PiBjb21taXQubWVzc2FnZSk7XG4gIH1cblxuICAvKiogRGV0ZXJtaW5lcyB0aGUgbWVyZ2UgYWN0aW9uIGZyb20gdGhlIGdpdmVuIHB1bGwgcmVxdWVzdC4gKi9cbiAgcHJpdmF0ZSBfZ2V0TWVyZ2VBY3Rpb25Gcm9tUHVsbFJlcXVlc3Qoe2xhYmVsc306IFB1bGxSZXF1ZXN0KTogR2l0aHViQXBpTWVyZ2VNZXRob2Qge1xuICAgIGlmICh0aGlzLl9jb25maWcubGFiZWxzKSB7XG4gICAgICBjb25zdCBtYXRjaGluZ0xhYmVsID0gdGhpcy5fY29uZmlnLmxhYmVscy5maW5kKCh7cGF0dGVybn0pID0+IGxhYmVscy5pbmNsdWRlcyhwYXR0ZXJuKSk7XG4gICAgICBpZiAobWF0Y2hpbmdMYWJlbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBtYXRjaGluZ0xhYmVsLm1ldGhvZDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2NvbmZpZy5kZWZhdWx0O1xuICB9XG59XG4iXX0=