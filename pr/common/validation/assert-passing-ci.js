import { getStatusesForPullRequest, PullRequestStatus, } from '../fetch-pull-request.js';
import { createPullRequestValidation, PullRequestValidation } from './validation-config.js';
export const passingCiValidation = createPullRequestValidation({ name: 'assertPassingCi', canBeForceIgnored: true }, () => Validation);
class Validation extends PullRequestValidation {
    assert(pullRequest) {
        const { combinedStatus, statuses } = getStatusesForPullRequest(pullRequest);
        if (statuses.find((status) => status.name === 'lint') === undefined) {
            throw this._createError('Pull request is missing expected status checks. Check the pull request for pending workflows');
        }
        if (combinedStatus === PullRequestStatus.PENDING) {
            throw this._createError('Pull request has pending status checks.');
        }
        if (combinedStatus === PullRequestStatus.FAILING) {
            throw this._createError('Pull request has failing status checks.');
        }
    }
}
//# sourceMappingURL=assert-passing-ci.js.map