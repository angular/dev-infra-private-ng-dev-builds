/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { AuthenticatedGitClient } from '../../../utils/git/authenticated-git-client.js';
import { GithubApiMergeStrategyConfig } from '../../config/index.js';
import { PullRequest } from '../pull-request.js';
import { MergeStrategy } from './strategy.js';
/**
 * Merge strategy that primarily leverages the Github API. The strategy merges a given
 * pull request into a target branch using the API. This ensures that Github displays
 * the pull request as merged. The merged commits are then cherry-picked into the remaining
 * target branches using the local Git instance. The benefit is that the Github merged state
 * is properly set, but a notable downside is that PRs cannot use fixup or squash commits.
 */
export declare class GithubApiMergeStrategy extends MergeStrategy {
    private _config;
    constructor(git: AuthenticatedGitClient, _config: GithubApiMergeStrategyConfig);
    /**
     * Merges the specified pull request via the Github API, cherry-picks the change into the other
     * target branhces and pushes the branches upstream.
     *
     * @throws {GitCommandError} An unknown Git command error occurred that is not
     *   specific to the pull request merge.
     * @throws {FatalMergeToolError} A fatal error if the merge could not be performed.
     */
    merge(pullRequest: PullRequest): Promise<void>;
    /**
     * Prompts the user for the commit message changes. Unlike as in the autosquash merge
     * strategy, we cannot start an interactive rebase because we merge using the Github API.
     * The Github API only allows modifications to PR title and body for squash merges.
     */
    private _promptCommitMessageEdit;
    /**
     * Gets a commit message for the given pull request. Github by default concatenates
     * multiple commit messages if a PR is merged in squash mode. We try to replicate this
     * behavior here so that we have a default commit message that can be fixed up.
     */
    private _getDefaultSquashCommitMessage;
    /** Gets all commit messages of commits in the pull request. */
    private _getPullRequestCommitMessages;
    /** Determines the merge action from the given pull request. */
    private _getMergeActionFromPullRequest;
}
