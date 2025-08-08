import { getStatusesForPullRequest, PullRequestStatus, } from '../fetch-pull-request.js';
import { createPullRequestValidation, PullRequestValidation } from './validation-config.js';
export const signedClaValidation = createPullRequestValidation({ name: 'assertSignedCla', canBeForceIgnored: true }, () => Validation);
class Validation extends PullRequestValidation {
    assert(pullRequest) {
        const passing = getStatusesForPullRequest(pullRequest).statuses.some(({ name, status }) => {
            return name === 'cla/google' && status === PullRequestStatus.PASSING;
        });
        if (!passing) {
            throw this._createError('CLA is not signed by the contributor.');
        }
    }
}
//# sourceMappingURL=assert-signed-cla.js.map