import { PullRequestValidationFailure } from './validation-failure.js';
const defaultConfig = {
    assertPending: true,
    assertMergeReady: true,
    assertSignedCla: true,
    assertChangesAllowForTargetLabel: true,
    assertPassingCi: true,
    assertCompletedReviews: true,
    assertEnforcedStatuses: true,
    assertMinimumReviews: true,
    assertIsolatedSeparateFiles: false,
    assertEnforceTested: false,
};
export function createPullRequestValidationConfig(config) {
    return { ...defaultConfig, ...config };
}
export class PullRequestValidation {
    constructor(name, _createError) {
        this.name = name;
        this._createError = _createError;
    }
}
export function createPullRequestValidation({ name, canBeForceIgnored }, getValidationCtor) {
    return {
        async run(validationConfig, ...args) {
            if (validationConfig[name]) {
                const validation = new (getValidationCtor())(name, (message) => new PullRequestValidationFailure(message, name, canBeForceIgnored));
                try {
                    await validation.assert(...args);
                }
                catch (e) {
                    if (e instanceof PullRequestValidationFailure) {
                        return e;
                    }
                    throw e;
                }
            }
            return null;
        },
    };
}
//# sourceMappingURL=validation-config.js.map