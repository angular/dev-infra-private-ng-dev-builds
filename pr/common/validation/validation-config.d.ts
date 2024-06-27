/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { PullRequestValidationConfig } from '../../config/index.js';
import { PullRequestValidationFailure } from './validation-failure.js';
export declare function createPullRequestValidationConfig(config: PullRequestValidationConfig): PullRequestValidationConfig;
/** Type describing a helper function for validations to create a validation failure. */
export type PullRequestValidationErrorCreateFn = (message: string) => PullRequestValidationFailure;
/**
 * Base class for pull request validations, providing helpers for the validation errors,
 * and a consistent interface for checking the activation state of validations
 */
export declare abstract class PullRequestValidation {
    protected name: keyof PullRequestValidationConfig;
    protected _createError: PullRequestValidationErrorCreateFn;
    constructor(name: keyof PullRequestValidationConfig, _createError: PullRequestValidationErrorCreateFn);
    /** Assertion function to be defined for the specific validator. */
    abstract assert(...parameters: unknown[]): void | Promise<void>;
}
/** Creates a pull request validation from a configuration and implementation class. */
export declare function createPullRequestValidation<T extends PullRequestValidation>({ name, canBeForceIgnored }: {
    name: keyof PullRequestValidationConfig;
    canBeForceIgnored: boolean;
}, getValidationCtor: () => new (...args: ConstructorParameters<typeof PullRequestValidation>) => T): {
    run(validationConfig: PullRequestValidationConfig, ...args: Parameters<T["assert"]>): Promise<PullRequestValidationFailure | null>;
};
