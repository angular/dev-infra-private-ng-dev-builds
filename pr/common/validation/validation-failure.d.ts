/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { PullRequestValidationConfig } from './validation-config.js';
/** Class that can be used to describe pull request validation failures. */
export declare class PullRequestValidationFailure {
    /** Human-readable message for the failure */
    readonly message: string;
    /** Validation config name for the failure. */
    readonly validationName: keyof PullRequestValidationConfig;
    /** Validation config name for the failure. */
    readonly canBeForceIgnored: boolean;
    constructor(
    /** Human-readable message for the failure */
    message: string, 
    /** Validation config name for the failure. */
    validationName: keyof PullRequestValidationConfig, 
    /** Validation config name for the failure. */
    canBeForceIgnored: boolean);
}
