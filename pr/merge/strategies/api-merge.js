/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import inquirer from 'inquirer';
import { parseCommitMessage } from '../../../commit-message/parse.js';
import { MergeStrategy } from './strategy.js';
import { isGithubApiError } from '../../../utils/git/github.js';
import { FatalMergeToolError, MergeConflictsFatalError } from '../failures.js';
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
        const { result } = await inquirer.prompt({
            type: 'editor',
            name: 'result',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLW1lcmdlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL21lcmdlL3N0cmF0ZWdpZXMvYXBpLW1lcmdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sUUFBUSxNQUFNLFVBQVUsQ0FBQztBQUVoQyxPQUFPLEVBQUMsa0JBQWtCLEVBQUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUtwRSxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBQzVDLE9BQU8sRUFBQyxnQkFBZ0IsRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBQzlELE9BQU8sRUFBQyxtQkFBbUIsRUFBRSx3QkFBd0IsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBUTdFLHdEQUF3RDtBQUN4RCxNQUFNLHVCQUF1QixHQUFHLE1BQU0sQ0FBQztBQUV2Qzs7Ozs7O0dBTUc7QUFDSCxNQUFNLE9BQU8sc0JBQXVCLFNBQVEsYUFBYTtJQUN2RCxZQUNFLEdBQTJCLEVBQ25CLE9BQXFDO1FBRTdDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUZILFlBQU8sR0FBUCxPQUFPLENBQThCO0lBRy9DLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ00sS0FBSyxDQUFDLEtBQUssQ0FBQyxXQUF3QjtRQUMzQyxNQUFNLEVBQUMsa0JBQWtCLEVBQUUsUUFBUSxFQUFFLHVCQUF1QixFQUFFLGNBQWMsRUFBQyxHQUFHLFdBQVcsQ0FBQztRQUM1RixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsOEJBQThCLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDaEUsTUFBTSx3QkFBd0IsR0FBRyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssa0JBQWtCLENBQUMsQ0FBQztRQUV4RixNQUFNLFlBQVksR0FBdUI7WUFDdkMsV0FBVyxFQUFFLFFBQVE7WUFDckIsWUFB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Q0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDeEIsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBQyxPQUFPLEVBQUMsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ3hGLElBQUksYUFBYSxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUNoQyxPQUFPLGFBQWEsQ0FBQyxNQUFNLENBQUM7WUFDOUIsQ0FBQztRQUNILENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO0lBQzlCLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1Jlc3RFbmRwb2ludE1ldGhvZFR5cGVzfSBmcm9tICdAb2N0b2tpdC9wbHVnaW4tcmVzdC1lbmRwb2ludC1tZXRob2RzJztcbmltcG9ydCBpbnF1aXJlciBmcm9tICdpbnF1aXJlcic7XG5cbmltcG9ydCB7cGFyc2VDb21taXRNZXNzYWdlfSBmcm9tICcuLi8uLi8uLi9jb21taXQtbWVzc2FnZS9wYXJzZS5qcyc7XG5pbXBvcnQge0F1dGhlbnRpY2F0ZWRHaXRDbGllbnR9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQuanMnO1xuaW1wb3J0IHtHaXRodWJBcGlNZXJnZU1ldGhvZCwgR2l0aHViQXBpTWVyZ2VTdHJhdGVneUNvbmZpZ30gZnJvbSAnLi4vLi4vY29uZmlnL2luZGV4LmpzJztcbmltcG9ydCB7UHVsbFJlcXVlc3R9IGZyb20gJy4uL3B1bGwtcmVxdWVzdC5qcyc7XG5cbmltcG9ydCB7TWVyZ2VTdHJhdGVneX0gZnJvbSAnLi9zdHJhdGVneS5qcyc7XG5pbXBvcnQge2lzR2l0aHViQXBpRXJyb3J9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2dpdC9naXRodWIuanMnO1xuaW1wb3J0IHtGYXRhbE1lcmdlVG9vbEVycm9yLCBNZXJnZUNvbmZsaWN0c0ZhdGFsRXJyb3J9IGZyb20gJy4uL2ZhaWx1cmVzLmpzJztcblxuLyoqIFR5cGUgZGVzY3JpYmluZyB0aGUgcGFyYW1ldGVycyBmb3IgdGhlIE9jdG9raXQgYG1lcmdlYCBBUEkgZW5kcG9pbnQuICovXG50eXBlIE9jdG9raXRNZXJnZVBhcmFtcyA9IFJlc3RFbmRwb2ludE1ldGhvZFR5cGVzWydwdWxscyddWydtZXJnZSddWydwYXJhbWV0ZXJzJ107XG5cbnR5cGUgT2N0b2tpdFB1bGxSZXF1ZXN0Q29tbWl0c0xpc3QgPVxuICBSZXN0RW5kcG9pbnRNZXRob2RUeXBlc1sncHVsbHMnXVsnbGlzdENvbW1pdHMnXVsncmVzcG9uc2UnXVsnZGF0YSddO1xuXG4vKiogU2VwYXJhdG9yIGJldHdlZW4gY29tbWl0IG1lc3NhZ2UgaGVhZGVyIGFuZCBib2R5LiAqL1xuY29uc3QgQ09NTUlUX0hFQURFUl9TRVBBUkFUT1IgPSAnXFxuXFxuJztcblxuLyoqXG4gKiBNZXJnZSBzdHJhdGVneSB0aGF0IHByaW1hcmlseSBsZXZlcmFnZXMgdGhlIEdpdGh1YiBBUEkuIFRoZSBzdHJhdGVneSBtZXJnZXMgYSBnaXZlblxuICogcHVsbCByZXF1ZXN0IGludG8gYSB0YXJnZXQgYnJhbmNoIHVzaW5nIHRoZSBBUEkuIFRoaXMgZW5zdXJlcyB0aGF0IEdpdGh1YiBkaXNwbGF5c1xuICogdGhlIHB1bGwgcmVxdWVzdCBhcyBtZXJnZWQuIFRoZSBtZXJnZWQgY29tbWl0cyBhcmUgdGhlbiBjaGVycnktcGlja2VkIGludG8gdGhlIHJlbWFpbmluZ1xuICogdGFyZ2V0IGJyYW5jaGVzIHVzaW5nIHRoZSBsb2NhbCBHaXQgaW5zdGFuY2UuIFRoZSBiZW5lZml0IGlzIHRoYXQgdGhlIEdpdGh1YiBtZXJnZWQgc3RhdGVcbiAqIGlzIHByb3Blcmx5IHNldCwgYnV0IGEgbm90YWJsZSBkb3duc2lkZSBpcyB0aGF0IFBScyBjYW5ub3QgdXNlIGZpeHVwIG9yIHNxdWFzaCBjb21taXRzLlxuICovXG5leHBvcnQgY2xhc3MgR2l0aHViQXBpTWVyZ2VTdHJhdGVneSBleHRlbmRzIE1lcmdlU3RyYXRlZ3kge1xuICBjb25zdHJ1Y3RvcihcbiAgICBnaXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4gICAgcHJpdmF0ZSBfY29uZmlnOiBHaXRodWJBcGlNZXJnZVN0cmF0ZWd5Q29uZmlnLFxuICApIHtcbiAgICBzdXBlcihnaXQpO1xuICB9XG5cbiAgLyoqXG4gICAqIE1lcmdlcyB0aGUgc3BlY2lmaWVkIHB1bGwgcmVxdWVzdCB2aWEgdGhlIEdpdGh1YiBBUEksIGNoZXJyeS1waWNrcyB0aGUgY2hhbmdlIGludG8gdGhlIG90aGVyXG4gICAqIHRhcmdldCBicmFuaGNlcyBhbmQgcHVzaGVzIHRoZSBicmFuY2hlcyB1cHN0cmVhbS5cbiAgICpcbiAgICogQHRocm93cyB7R2l0Q29tbWFuZEVycm9yfSBBbiB1bmtub3duIEdpdCBjb21tYW5kIGVycm9yIG9jY3VycmVkIHRoYXQgaXMgbm90XG4gICAqICAgc3BlY2lmaWMgdG8gdGhlIHB1bGwgcmVxdWVzdCBtZXJnZS5cbiAgICogQHRocm93cyB7RmF0YWxNZXJnZVRvb2xFcnJvcn0gQSBmYXRhbCBlcnJvciBpZiB0aGUgbWVyZ2UgY291bGQgbm90IGJlIHBlcmZvcm1lZC5cbiAgICovXG4gIG92ZXJyaWRlIGFzeW5jIG1lcmdlKHB1bGxSZXF1ZXN0OiBQdWxsUmVxdWVzdCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHtnaXRodWJUYXJnZXRCcmFuY2gsIHByTnVtYmVyLCBuZWVkc0NvbW1pdE1lc3NhZ2VGaXh1cCwgdGFyZ2V0QnJhbmNoZXN9ID0gcHVsbFJlcXVlc3Q7XG4gICAgY29uc3QgbWV0aG9kID0gdGhpcy5fZ2V0TWVyZ2VBY3Rpb25Gcm9tUHVsbFJlcXVlc3QocHVsbFJlcXVlc3QpO1xuICAgIGNvbnN0IGNoZXJyeVBpY2tUYXJnZXRCcmFuY2hlcyA9IHRhcmdldEJyYW5jaGVzLmZpbHRlcigoYikgPT4gYiAhPT0gZ2l0aHViVGFyZ2V0QnJhbmNoKTtcblxuICAgIGNvbnN0IG1lcmdlT3B0aW9uczogT2N0b2tpdE1lcmdlUGFyYW1zID0ge1xuICAgICAgcHVsbF9udW1iZXI6IHByTnVtYmVyLFxuICAgICAgbWVyZ2VfbWV0aG9kOiBtZXRob2QsXG4gICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgfTtcblxuICAgIGlmIChuZWVkc0NvbW1pdE1lc3NhZ2VGaXh1cCkge1xuICAgICAgLy8gQ29tbWl0IG1lc3NhZ2UgZml4dXAgZG9lcyBub3Qgd29yayB3aXRoIG90aGVyIG1lcmdlIG1ldGhvZHMgYXMgdGhlIEdpdGh1YiBBUEkgb25seVxuICAgICAgLy8gYWxsb3dzIGNvbW1pdCBtZXNzYWdlIG1vZGlmaWNhdGlvbnMgZm9yIHNxdWFzaCBtZXJnaW5nLlxuICAgICAgaWYgKG1ldGhvZCAhPT0gJ3NxdWFzaCcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEZhdGFsTWVyZ2VUb29sRXJyb3IoXG4gICAgICAgICAgYFVuYWJsZSB0byBmaXh1cCBjb21taXQgbWVzc2FnZSBvZiBwdWxsIHJlcXVlc3QuIENvbW1pdCBtZXNzYWdlIGNhbiBvbmx5IGJlIGAgK1xuICAgICAgICAgICAgYG1vZGlmaWVkIGlmIHRoZSBQUiBpcyBtZXJnZWQgdXNpbmcgc3F1YXNoLmAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBhd2FpdCB0aGlzLl9wcm9tcHRDb21taXRNZXNzYWdlRWRpdChwdWxsUmVxdWVzdCwgbWVyZ2VPcHRpb25zKTtcbiAgICB9XG5cbiAgICBsZXQgbWVyZ2VTdGF0dXNDb2RlOiBudW1iZXI7XG4gICAgbGV0IG1lcmdlUmVzcG9uc2VNZXNzYWdlOiBzdHJpbmc7XG4gICAgbGV0IHRhcmdldFNoYTogc3RyaW5nO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIE1lcmdlIHRoZSBwdWxsIHJlcXVlc3QgdXNpbmcgdGhlIEdpdGh1YiBBUEkgaW50byB0aGUgc2VsZWN0ZWQgYmFzZSBicmFuY2guXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdpdC5naXRodWIucHVsbHMubWVyZ2UobWVyZ2VPcHRpb25zKTtcblxuICAgICAgbWVyZ2VTdGF0dXNDb2RlID0gcmVzdWx0LnN0YXR1cztcbiAgICAgIG1lcmdlUmVzcG9uc2VNZXNzYWdlID0gcmVzdWx0LmRhdGEubWVzc2FnZTtcbiAgICAgIHRhcmdldFNoYSA9IHJlc3VsdC5kYXRhLnNoYTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBOb3RlOiBHaXRodWIgdXN1YWxseSByZXR1cm5zIGA0MDRgIGFzIHN0YXR1cyBjb2RlIGlmIHRoZSBBUEkgcmVxdWVzdCB1c2VzIGFcbiAgICAgIC8vIHRva2VuIHdpdGggaW5zdWZmaWNpZW50IHBlcm1pc3Npb25zLiBHaXRodWIgZG9lcyB0aGlzIGJlY2F1c2UgaXQgZG9lc24ndCB3YW50XG4gICAgICAvLyB0byBsZWFrIHdoZXRoZXIgYSByZXBvc2l0b3J5IGV4aXN0cyBvciBub3QuIEluIG91ciBjYXNlIHdlIGV4cGVjdCBhIGNlcnRhaW5cbiAgICAgIC8vIHJlcG9zaXRvcnkgdG8gZXhpc3QsIHNvIHdlIGFsd2F5cyB0cmVhdCB0aGlzIGFzIGEgcGVybWlzc2lvbiBmYWlsdXJlLlxuICAgICAgaWYgKGlzR2l0aHViQXBpRXJyb3IoZSkgJiYgKGUuc3RhdHVzID09PSA0MDMgfHwgZS5zdGF0dXMgPT09IDQwNCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEZhdGFsTWVyZ2VUb29sRXJyb3IoJ0luc3VmZmljaWVudCBHaXRodWIgQVBJIHBlcm1pc3Npb25zIHRvIG1lcmdlIHB1bGwgcmVxdWVzdC4nKTtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuXG4gICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIuZ2l0aHViLmNvbS92My9wdWxscy8jcmVzcG9uc2UtaWYtbWVyZ2UtY2Fubm90LWJlLXBlcmZvcm1lZFxuICAgIC8vIFB1bGwgcmVxdWVzdCBjYW5ub3QgYmUgbWVyZ2VkIGR1ZSB0byBtZXJnZSBjb25mbGljdHMuXG4gICAgaWYgKG1lcmdlU3RhdHVzQ29kZSA9PT0gNDA1KSB7XG4gICAgICB0aHJvdyBuZXcgTWVyZ2VDb25mbGljdHNGYXRhbEVycm9yKFtnaXRodWJUYXJnZXRCcmFuY2hdKTtcbiAgICB9XG4gICAgaWYgKG1lcmdlU3RhdHVzQ29kZSAhPT0gMjAwKSB7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxNZXJnZVRvb2xFcnJvcihcbiAgICAgICAgYFVuZXhwZWN0ZWQgbWVyZ2Ugc3RhdHVzIGNvZGU6ICR7bWVyZ2VTdGF0dXNDb2RlfTogJHttZXJnZVJlc3BvbnNlTWVzc2FnZX1gLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgUFIgZG9lcyBub3QgbmVlZCB0byBiZSBtZXJnZWQgaW50byBhbnkgb3RoZXIgdGFyZ2V0IGJyYW5jaGVzLFxuICAgIC8vIHdlIGV4aXQgaGVyZSBhcyB3ZSBhbHJlYWR5IGNvbXBsZXRlZCB0aGUgbWVyZ2UuXG4gICAgaWYgKCFjaGVycnlQaWNrVGFyZ2V0QnJhbmNoZXMubGVuZ3RoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUmVmcmVzaCB0aGUgdGFyZ2V0IGJyYW5jaCB0aGUgUFIgaGFzIGJlZW4gbWVyZ2VkIGludG8gdGhyb3VnaCB0aGUgQVBJLiBXZSBuZWVkXG4gICAgLy8gdG8gcmUtZmV0Y2ggYXMgb3RoZXJ3aXNlIHdlIGNhbm5vdCBjaGVycnktcGljayB0aGUgbmV3IGNvbW1pdHMgaW50byB0aGUgcmVtYWluaW5nXG4gICAgLy8gdGFyZ2V0IGJyYW5jaGVzLlxuICAgIHRoaXMuZmV0Y2hUYXJnZXRCcmFuY2hlcyhbZ2l0aHViVGFyZ2V0QnJhbmNoXSk7XG5cbiAgICAvLyBOdW1iZXIgb2YgY29tbWl0cyB0aGF0IGhhdmUgbGFuZGVkIGluIHRoZSB0YXJnZXQgYnJhbmNoLiBUaGlzIGNvdWxkIHZhcnkgZnJvbVxuICAgIC8vIHRoZSBjb3VudCBvZiBjb21taXRzIGluIHRoZSBQUiBkdWUgdG8gc3F1YXNoaW5nLlxuICAgIGNvbnN0IHRhcmdldENvbW1pdHNDb3VudCA9IG1ldGhvZCA9PT0gJ3NxdWFzaCcgPyAxIDogcHVsbFJlcXVlc3QuY29tbWl0Q291bnQ7XG5cbiAgICAvLyBDaGVycnkgcGljayB0aGUgbWVyZ2VkIGNvbW1pdHMgaW50byB0aGUgcmVtYWluaW5nIHRhcmdldCBicmFuY2hlcy5cbiAgICBjb25zdCBmYWlsZWRCcmFuY2hlcyA9IGF3YWl0IHRoaXMuY2hlcnJ5UGlja0ludG9UYXJnZXRCcmFuY2hlcyhcbiAgICAgIGAke3RhcmdldFNoYX1+JHt0YXJnZXRDb21taXRzQ291bnR9Li4ke3RhcmdldFNoYX1gLFxuICAgICAgY2hlcnJ5UGlja1RhcmdldEJyYW5jaGVzLFxuICAgICAge1xuICAgICAgICAvLyBDb21taXRzIHRoYXQgaGF2ZSBiZWVuIGNyZWF0ZWQgYnkgdGhlIEdpdGh1YiBBUEkgZG8gbm90IG5lY2Vzc2FyaWx5IGNvbnRhaW5cbiAgICAgICAgLy8gYSByZWZlcmVuY2UgdG8gdGhlIHNvdXJjZSBwdWxsIHJlcXVlc3QgKHVubGVzcyB0aGUgc3F1YXNoIHN0cmF0ZWd5IGlzIHVzZWQpLlxuICAgICAgICAvLyBUbyBlbnN1cmUgdGhhdCBvcmlnaW5hbCBjb21taXRzIGNhbiBiZSBmb3VuZCB3aGVuIGEgY29tbWl0IGlzIHZpZXdlZCBpbiBhXG4gICAgICAgIC8vIHRhcmdldCBicmFuY2gsIHdlIGFkZCBhIGxpbmsgdG8gdGhlIG9yaWdpbmFsIGNvbW1pdHMgd2hlbiBjaGVycnktcGlja2luZy5cbiAgICAgICAgbGlua1RvT3JpZ2luYWxDb21taXRzOiB0cnVlLFxuICAgICAgfSxcbiAgICApO1xuXG4gICAgLy8gV2UgYWxyZWFkeSBjaGVja2VkIHdoZXRoZXIgdGhlIFBSIGNhbiBiZSBjaGVycnktcGlja2VkIGludG8gdGhlIHRhcmdldCBicmFuY2hlcyxcbiAgICAvLyBidXQgaW4gY2FzZSB0aGUgY2hlcnJ5LXBpY2sgc29tZWhvdyBmYWlscywgd2Ugc3RpbGwgaGFuZGxlIHRoZSBjb25mbGljdHMgaGVyZS4gVGhlXG4gICAgLy8gY29tbWl0cyBjcmVhdGVkIHRocm91Z2ggdGhlIEdpdGh1YiBBUEkgY291bGQgYmUgZGlmZmVyZW50IChpLmUuIHRocm91Z2ggc3F1YXNoKS5cbiAgICBpZiAoZmFpbGVkQnJhbmNoZXMubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgTWVyZ2VDb25mbGljdHNGYXRhbEVycm9yKGZhaWxlZEJyYW5jaGVzKTtcbiAgICB9XG5cbiAgICB0aGlzLnB1c2hUYXJnZXRCcmFuY2hlc1Vwc3RyZWFtKGNoZXJyeVBpY2tUYXJnZXRCcmFuY2hlcyk7XG5cbiAgICAvLyBCZWNhdXNlIG91ciBwcm9jZXNzIGJyaW5ncyBjaGFuZ2VzIGludG8gbXVsdGlwbGUgYnJhbmNoY2VzLCB3ZSBpbmNsdWRlIGEgY29tbWVudCB3aGljaFxuICAgIC8vIGV4cHJlc3NlcyBhbGwgb2YgdGhlIGJyYW5jaGVzIHRoZSBjaGFuZ2VzIHdlcmUgbWVyZ2VkIGludG8uXG4gICAgYXdhaXQgdGhpcy5naXQuZ2l0aHViLmlzc3Vlcy5jcmVhdGVDb21tZW50KHtcbiAgICAgIC4uLnRoaXMuZ2l0LnJlbW90ZVBhcmFtcyxcbiAgICAgIGlzc3VlX251bWJlcjogcHVsbFJlcXVlc3QucHJOdW1iZXIsXG4gICAgICBib2R5OiBgVGhlIGNoYW5nZXMgd2VyZSBtZXJnZWQgaW50byB0aGUgZm9sbG93aW5nIGJyYW5jaGVzOiAke3RhcmdldEJyYW5jaGVzLmpvaW4oJywgJyl9YCxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9tcHRzIHRoZSB1c2VyIGZvciB0aGUgY29tbWl0IG1lc3NhZ2UgY2hhbmdlcy4gVW5saWtlIGFzIGluIHRoZSBhdXRvc3F1YXNoIG1lcmdlXG4gICAqIHN0cmF0ZWd5LCB3ZSBjYW5ub3Qgc3RhcnQgYW4gaW50ZXJhY3RpdmUgcmViYXNlIGJlY2F1c2Ugd2UgbWVyZ2UgdXNpbmcgdGhlIEdpdGh1YiBBUEkuXG4gICAqIFRoZSBHaXRodWIgQVBJIG9ubHkgYWxsb3dzIG1vZGlmaWNhdGlvbnMgdG8gUFIgdGl0bGUgYW5kIGJvZHkgZm9yIHNxdWFzaCBtZXJnZXMuXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIF9wcm9tcHRDb21taXRNZXNzYWdlRWRpdChcbiAgICBwdWxsUmVxdWVzdDogUHVsbFJlcXVlc3QsXG4gICAgbWVyZ2VPcHRpb25zOiBPY3Rva2l0TWVyZ2VQYXJhbXMsXG4gICkge1xuICAgIGNvbnN0IGNvbW1pdE1lc3NhZ2UgPSBhd2FpdCB0aGlzLl9nZXREZWZhdWx0U3F1YXNoQ29tbWl0TWVzc2FnZShwdWxsUmVxdWVzdCk7XG4gICAgY29uc3Qge3Jlc3VsdH0gPSBhd2FpdCBpbnF1aXJlci5wcm9tcHQ8e3Jlc3VsdDogc3RyaW5nfT4oe1xuICAgICAgdHlwZTogJ2VkaXRvcicsXG4gICAgICBuYW1lOiAncmVzdWx0JyxcbiAgICAgIG1lc3NhZ2U6ICdQbGVhc2UgdXBkYXRlIHRoZSBjb21taXQgbWVzc2FnZScsXG4gICAgICBkZWZhdWx0OiBjb21taXRNZXNzYWdlLFxuICAgIH0pO1xuXG4gICAgLy8gU3BsaXQgdGhlIG5ldyBtZXNzYWdlIGludG8gdGl0bGUgYW5kIG1lc3NhZ2UuIFRoaXMgaXMgbmVjZXNzYXJ5IGJlY2F1c2UgdGhlXG4gICAgLy8gR2l0aHViIEFQSSBleHBlY3RzIHRpdGxlIGFuZCBtZXNzYWdlIHRvIGJlIHBhc3NlZCBzZXBhcmF0ZWx5LlxuICAgIGNvbnN0IFtuZXdUaXRsZSwgLi4ubmV3TWVzc2FnZV0gPSByZXN1bHQuc3BsaXQoQ09NTUlUX0hFQURFUl9TRVBBUkFUT1IpO1xuXG4gICAgLy8gVXBkYXRlIHRoZSBtZXJnZSBvcHRpb25zIHNvIHRoYXQgdGhlIGNoYW5nZXMgYXJlIHJlZmxlY3RlZCBpbiB0aGVyZS5cbiAgICBtZXJnZU9wdGlvbnMuY29tbWl0X3RpdGxlID0gYCR7bmV3VGl0bGV9ICgjJHtwdWxsUmVxdWVzdC5wck51bWJlcn0pYDtcbiAgICBtZXJnZU9wdGlvbnMuY29tbWl0X21lc3NhZ2UgPSBuZXdNZXNzYWdlLmpvaW4oQ09NTUlUX0hFQURFUl9TRVBBUkFUT1IpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgYSBjb21taXQgbWVzc2FnZSBmb3IgdGhlIGdpdmVuIHB1bGwgcmVxdWVzdC4gR2l0aHViIGJ5IGRlZmF1bHQgY29uY2F0ZW5hdGVzXG4gICAqIG11bHRpcGxlIGNvbW1pdCBtZXNzYWdlcyBpZiBhIFBSIGlzIG1lcmdlZCBpbiBzcXVhc2ggbW9kZS4gV2UgdHJ5IHRvIHJlcGxpY2F0ZSB0aGlzXG4gICAqIGJlaGF2aW9yIGhlcmUgc28gdGhhdCB3ZSBoYXZlIGEgZGVmYXVsdCBjb21taXQgbWVzc2FnZSB0aGF0IGNhbiBiZSBmaXhlZCB1cC5cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgX2dldERlZmF1bHRTcXVhc2hDb21taXRNZXNzYWdlKHB1bGxSZXF1ZXN0OiBQdWxsUmVxdWVzdCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgY29tbWl0cyA9IChhd2FpdCB0aGlzLl9nZXRQdWxsUmVxdWVzdENvbW1pdE1lc3NhZ2VzKHB1bGxSZXF1ZXN0KSkubWFwKChtZXNzYWdlKSA9PiAoe1xuICAgICAgbWVzc2FnZSxcbiAgICAgIHBhcnNlZDogcGFyc2VDb21taXRNZXNzYWdlKG1lc3NhZ2UpLFxuICAgIH0pKTtcbiAgICBjb25zdCBtZXNzYWdlQmFzZSA9IGAke3B1bGxSZXF1ZXN0LnRpdGxlfSR7Q09NTUlUX0hFQURFUl9TRVBBUkFUT1J9YDtcbiAgICBpZiAoY29tbWl0cy5sZW5ndGggPD0gMSkge1xuICAgICAgcmV0dXJuIGAke21lc3NhZ2VCYXNlfSR7Y29tbWl0c1swXS5wYXJzZWQuYm9keX1gO1xuICAgIH1cbiAgICBjb25zdCBqb2luZWRNZXNzYWdlcyA9IGNvbW1pdHMubWFwKChjKSA9PiBgKiAke2MubWVzc2FnZX1gKS5qb2luKENPTU1JVF9IRUFERVJfU0VQQVJBVE9SKTtcbiAgICByZXR1cm4gYCR7bWVzc2FnZUJhc2V9JHtqb2luZWRNZXNzYWdlc31gO1xuICB9XG5cbiAgLyoqIEdldHMgYWxsIGNvbW1pdCBtZXNzYWdlcyBvZiBjb21taXRzIGluIHRoZSBwdWxsIHJlcXVlc3QuICovXG4gIHByaXZhdGUgYXN5bmMgX2dldFB1bGxSZXF1ZXN0Q29tbWl0TWVzc2FnZXMoe3ByTnVtYmVyfTogUHVsbFJlcXVlc3QpIHtcbiAgICBjb25zdCBhbGxDb21taXRzOiBPY3Rva2l0UHVsbFJlcXVlc3RDb21taXRzTGlzdCA9IGF3YWl0IHRoaXMuZ2l0LmdpdGh1Yi5wYWdpbmF0ZShcbiAgICAgIHRoaXMuZ2l0LmdpdGh1Yi5wdWxscy5saXN0Q29tbWl0cyxcbiAgICAgIHtcbiAgICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgICBwdWxsX251bWJlcjogcHJOdW1iZXIsXG4gICAgICB9LFxuICAgICk7XG4gICAgcmV0dXJuIGFsbENvbW1pdHMubWFwKCh7Y29tbWl0fSkgPT4gY29tbWl0Lm1lc3NhZ2UpO1xuICB9XG5cbiAgLyoqIERldGVybWluZXMgdGhlIG1lcmdlIGFjdGlvbiBmcm9tIHRoZSBnaXZlbiBwdWxsIHJlcXVlc3QuICovXG4gIHByaXZhdGUgX2dldE1lcmdlQWN0aW9uRnJvbVB1bGxSZXF1ZXN0KHtsYWJlbHN9OiBQdWxsUmVxdWVzdCk6IEdpdGh1YkFwaU1lcmdlTWV0aG9kIHtcbiAgICBpZiAodGhpcy5fY29uZmlnLmxhYmVscykge1xuICAgICAgY29uc3QgbWF0Y2hpbmdMYWJlbCA9IHRoaXMuX2NvbmZpZy5sYWJlbHMuZmluZCgoe3BhdHRlcm59KSA9PiBsYWJlbHMuaW5jbHVkZXMocGF0dGVybikpO1xuICAgICAgaWYgKG1hdGNoaW5nTGFiZWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gbWF0Y2hpbmdMYWJlbC5tZXRob2Q7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jb25maWcuZGVmYXVsdDtcbiAgfVxufVxuIl19