import { PullRequestValidationConfig } from '../../config/index.js';
import { PullRequestValidationFailure } from './validation-failure.js';
export declare function createPullRequestValidationConfig(config: PullRequestValidationConfig): PullRequestValidationConfig;
export type PullRequestValidationErrorCreateFn = (message: string) => PullRequestValidationFailure;
export declare abstract class PullRequestValidation {
    protected name: keyof PullRequestValidationConfig;
    protected _createError: PullRequestValidationErrorCreateFn;
    constructor(name: keyof PullRequestValidationConfig, _createError: PullRequestValidationErrorCreateFn);
    abstract assert(...parameters: unknown[]): void | Promise<void>;
}
export declare function createPullRequestValidation<T extends PullRequestValidation>({ name, canBeForceIgnored }: {
    name: keyof PullRequestValidationConfig;
    canBeForceIgnored: boolean;
}, getValidationCtor: () => new (...args: ConstructorParameters<typeof PullRequestValidation>) => T): {
    run(validationConfig: PullRequestValidationConfig, ...args: Parameters<T["assert"]>): Promise<PullRequestValidationFailure | null>;
};
