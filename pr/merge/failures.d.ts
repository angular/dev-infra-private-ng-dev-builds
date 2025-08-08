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
    failedBranches: string[];
    constructor(failedBranches: string[]);
}
export declare class PullRequestValidationError extends FatalMergeToolError {
    constructor();
}
