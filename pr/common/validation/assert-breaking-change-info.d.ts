/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Commit } from '../../../commit-message/parse.js';
/** Assert the pull request is properly denoted if it contains breaking changes. */
export declare const breakingChangeInfoValidation: {
    run(validationConfig: import("./validation-config.js").PullRequestValidationConfig, commits: Commit[], labels: string[]): Promise<import("./validation-failure.js").PullRequestValidationFailure | null>;
};
