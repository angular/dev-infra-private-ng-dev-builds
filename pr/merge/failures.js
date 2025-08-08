export class FatalMergeToolError extends Error {
    constructor(message) {
        super(message);
    }
}
export class UserAbortedMergeToolError extends FatalMergeToolError {
    constructor() {
        super('Tool exited due to user aborting merge attempt.');
    }
}
export class MismatchedTargetBranchFatalError extends FatalMergeToolError {
    constructor(allowedBranches) {
        super(`Pull request is set to wrong base branch. Please update the PR in the Github UI ` +
            `to one of the following branches: ${allowedBranches.join(', ')}.`);
    }
}
export class UnsatisfiedBaseShaFatalError extends FatalMergeToolError {
    constructor() {
        super(`Pull request has not been rebased recently and could be bypassing CI checks. ` +
            `Please rebase the PR.`);
    }
}
export class MergeConflictsFatalError extends FatalMergeToolError {
    constructor(failedBranches) {
        super(`Cannot not merge pull request into the following branches due to merge ` +
            `conflicts: ${failedBranches.join(', ')}. Please rebase the PR or update the target label.`);
        this.failedBranches = failedBranches;
    }
}
export class PullRequestValidationError extends FatalMergeToolError {
    constructor() {
        super('Tool exited as at least one pull request validation error was discovered.');
    }
}
//# sourceMappingURL=failures.js.map