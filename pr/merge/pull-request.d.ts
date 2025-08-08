import { PullRequestValidationFailure } from '../common/validation/validation-failure.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { GithubConfig, NgDevConfig } from '../../utils/config.js';
import { PullRequestConfig, PullRequestValidationConfig } from '../config/index.js';
export interface PullRequest {
    url: string;
    prNumber: number;
    title: string;
    labels: string[];
    targetBranches: string[];
    githubTargetBranch: string;
    commitCount: number;
    requiredBaseSha?: string;
    needsCommitMessageFixup: boolean;
    hasCaretakerNote: boolean;
    baseSha: string;
    revisionRange: string;
    validationFailures: PullRequestValidationFailure[];
    headSha: string;
}
export declare function loadAndValidatePullRequest({ git, config, }: {
    git: AuthenticatedGitClient;
    config: NgDevConfig<{
        pullRequest: PullRequestConfig;
        github: GithubConfig;
    }>;
}, prNumber: number, validationConfig: PullRequestValidationConfig): Promise<PullRequest>;
