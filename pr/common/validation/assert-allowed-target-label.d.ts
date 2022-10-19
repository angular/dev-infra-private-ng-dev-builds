/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Commit } from '../../../commit-message/parse.js';
import { ActiveReleaseTrains } from '../../../release/versioning/active-release-trains.js';
import { PullRequestConfig } from '../../config/index.js';
import { TargetLabelName } from '../targeting/target-label.js';
/** Assert the commits provided are allowed to merge to the provided target label. */
export declare const changesAllowForTargetLabelValidation: {
    run(validationConfig: import("./validation-config.js").PullRequestValidationConfig, commits: Commit[], labelName: TargetLabelName, config: PullRequestConfig, releaseTrains: ActiveReleaseTrains, labelsOnPullRequest: string[]): Promise<import("./validation-failure.js").PullRequestValidationFailure | null>;
};
