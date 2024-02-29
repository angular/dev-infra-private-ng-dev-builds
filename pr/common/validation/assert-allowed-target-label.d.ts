/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Commit } from '../../../commit-message/parse.js';
import { ActiveReleaseTrains } from '../../../release/versioning/active-release-trains.js';
import { PullRequestConfig } from '../../config/index.js';
import { TargetLabel } from '../labels/target.js';
/** Assert the commits provided are allowed to merge to the provided target label. */
export declare const changesAllowForTargetLabelValidation: {
    run(validationConfig: import("../../config/index.js").PullRequestValidationConfig, commits: Commit[], targetLabel: TargetLabel, config: PullRequestConfig, releaseTrains: ActiveReleaseTrains, labelsOnPullRequest: string[]): Promise<import("./validation-failure.js").PullRequestValidationFailure | null>;
};
