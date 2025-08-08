import { ConfigValidationError } from '../../utils/config.js';
export function assertValidPullRequestConfig(config) {
    const errors = [];
    if (config.pullRequest === undefined) {
        throw new ConfigValidationError('No pullRequest configuration found. Set the `pullRequest` configuration.');
    }
    if (config.pullRequest.githubApiMerge === undefined) {
        errors.push('No explicit choice of merge strategy. Please set `githubApiMerge`.');
    }
    if (errors.length) {
        throw new ConfigValidationError('Invalid `pullRequest` configuration', errors);
    }
}
//# sourceMappingURL=index.js.map