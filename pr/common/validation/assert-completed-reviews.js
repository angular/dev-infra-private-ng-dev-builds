import { createPullRequestValidation, PullRequestValidation } from './validation-config.js';
export const completedReviewsValidation = createPullRequestValidation({ name: 'assertCompletedReviews', canBeForceIgnored: false }, () => Validation);
class Validation extends PullRequestValidation {
    assert(pullRequest) {
        const totalCount = pullRequest.reviewRequests.totalCount;
        if (totalCount !== 0) {
            throw this._createError(`Pull request cannot be merged with pending reviews, it current has ${totalCount} pending review(s)`);
        }
    }
}
//# sourceMappingURL=assert-completed-reviews.js.map