import { ActiveReleaseTrains } from '../../../release/versioning/active-release-trains.js';
import { NgDevConfig, GithubConfig } from '../../../utils/config.js';
import { PullRequestConfig, PullRequestValidationConfig } from '../../config/index.js';
import { PullRequestFromGithub } from '../fetch-pull-request.js';
import { PullRequestTarget } from '../targeting/target-label.js';
import { PullRequestValidationFailure } from './validation-failure.js';
import { AuthenticatedGitClient } from '../../../utils/git/authenticated-git-client.js';
export declare function assertValidPullRequest(pullRequest: PullRequestFromGithub, validationConfig: PullRequestValidationConfig, ngDevConfig: NgDevConfig<{
    pullRequest: PullRequestConfig;
    github: GithubConfig;
}>, activeReleaseTrains: ActiveReleaseTrains | null, target: PullRequestTarget, gitClient: AuthenticatedGitClient): Promise<PullRequestValidationFailure[]>;
