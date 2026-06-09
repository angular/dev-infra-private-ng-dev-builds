import type { PullRequest } from './actions.js';
export declare class UserAbortedReleaseActionError extends Error {
}
export declare class FatalReleaseActionError extends Error {
}
export declare class StageOnlySuccessError extends Error {
    pullRequest: PullRequest;
    constructor(pullRequest: PullRequest);
}
