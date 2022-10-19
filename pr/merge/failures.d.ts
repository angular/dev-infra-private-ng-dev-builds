/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/** Error class that indicates a fatal merge tool error that cannot be ignored. */
export declare class FatalMergeToolError extends Error {
    constructor(message: string);
}
export declare class UserAbortedMergeToolError extends FatalMergeToolError {
    constructor();
}
export declare class MismatchedTargetBranchFatalError extends FatalMergeToolError {
    constructor(allowedBranches: string[]);
}
export declare class UnsatisfiedBaseShaFatalError extends FatalMergeToolError {
    constructor();
}
export declare class MergeConflictsFatalError extends FatalMergeToolError {
    constructor(failedBranches: string[]);
}
export declare class PullRequestValidationError extends FatalMergeToolError {
    constructor();
}
