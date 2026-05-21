import { PullRequestValidationConfig } from '../../config/index.js';
export declare class PullRequestValidationFailure {
    readonly message: string;
    readonly validationName: keyof PullRequestValidationConfig;
    readonly canBeForceIgnored: boolean;
    readonly isFinal: boolean;
    constructor(message: string, validationName: keyof PullRequestValidationConfig, canBeForceIgnored: boolean, isFinal?: boolean);
}
