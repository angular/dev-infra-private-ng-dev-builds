import { Commit } from '../../../commit-message/parse.js';
import { ActiveReleaseTrains } from '../../../release/versioning/active-release-trains.js';
import { PullRequestConfig } from '../../config/index.js';
import { TargetLabel } from '../labels/target.js';
export declare const changesAllowForTargetLabelValidation: {
    run(validationConfig: import("../../config/index.js").PullRequestValidationConfig, commits: Commit[], targetLabel: TargetLabel, config: PullRequestConfig, releaseTrains: ActiveReleaseTrains, labelsOnPullRequest: string[]): Promise<import("./validation-failure.js").PullRequestValidationFailure | null>;
};
