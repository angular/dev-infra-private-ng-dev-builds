import { ConfigValidationError } from '../../utils/config.js';
export function assertValidPullRequestConfig(config) {
    const errors = [];
    if (config.pullRequest === undefined) {
        throw new ConfigValidationError('No pullRequest configuration found. Set the `pullRequest` configuration.');
    }
    const { conditionalAutosquashMerge, githubApiMerge } = config.pullRequest;
    if (githubApiMerge === undefined) {
        errors.push('No explicit choice of merge strategy. Please set `githubApiMerge`.');
    }
    if (conditionalAutosquashMerge && !githubApiMerge) {
        errors.push('`conditionalAutosquashMerge` requires a GitHub API merge strategy to inspect commit history. ' +
            'Please configure `githubApiMerge` or disable `conditionalAutosquashMerge`.');
    }
    if (errors.length) {
        throw new ConfigValidationError('Invalid `pullRequest` configuration', errors);
    }
}
//# sourceMappingURL=index.js.map