/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ActiveReleaseTrains } from '../../../release/versioning/active-release-trains.js';
import { NgDevConfig, GithubConfig } from '../../../utils/config.js';
import { PullRequestConfig, PullRequestValidationConfig } from '../../config/index.js';
import { PullRequestFromGithub } from '../fetch-pull-request.js';
import { PullRequestTarget } from '../targeting/target-label.js';
import { PullRequestValidationFailure } from './validation-failure.js';
import { AuthenticatedGitClient } from '../../../utils/git/authenticated-git-client.js';
/**
 * Runs all valiations that the given pull request is valid, returning a list of all failing
 * validations.
 *
 * Active release trains may be available for additional checks or not.
 */
export declare function assertValidPullRequest(pullRequest: PullRequestFromGithub, validationConfig: PullRequestValidationConfig, ngDevConfig: NgDevConfig<{
    pullRequest: PullRequestConfig;
    github: GithubConfig;
}>, activeReleaseTrains: ActiveReleaseTrains | null, target: PullRequestTarget, gitClient: AuthenticatedGitClient): Promise<PullRequestValidationFailure[]>;
