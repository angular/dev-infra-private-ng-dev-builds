import { getStatusesForPullRequest } from '../fetch-pull-request.js';
import { createPullRequestValidation, PullRequestValidation } from './validation-config.js';
export const enforcedStatusesValidation = createPullRequestValidation({ name: 'assertEnforcedStatuses', canBeForceIgnored: true }, () => Validation);
class Validation extends PullRequestValidation {
    assert(pullRequest, config) {
        if (config.requiredStatuses === undefined) {
            return;
        }
        const { statuses } = getStatusesForPullRequest(pullRequest);
        const missing = [];
        for (const enforced of config.requiredStatuses) {
            if (!statuses.some((s) => s.name === enforced.name && s.type === enforced.type)) {
                missing.push(enforced.name);
            }
        }
        if (missing.length > 0) {
            throw this._createError(`Required statuses are missing on the pull request (${missing.join(', ')}).`);
        }
    }
}
//# sourceMappingURL=assert-enforced-statuses.js.map