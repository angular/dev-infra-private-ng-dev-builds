import { Commit } from '../../../commit-message/parse.js';
export declare const breakingChangeInfoValidation: {
    run(validationConfig: import("../../config/index.js").PullRequestValidationConfig, commits: Commit[], labels: string[]): Promise<import("./validation-failure.js").PullRequestValidationFailure | null>;
};
