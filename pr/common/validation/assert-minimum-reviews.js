import { createPullRequestValidation, PullRequestValidation } from './validation-config.js';
export const minimumReviewsValidation = createPullRequestValidation({ name: 'assertMinimumReviews', canBeForceIgnored: false }, () => Validation);
class Validation extends PullRequestValidation {
    assert(pullRequest) {
        const totalCount = pullRequest.reviews.nodes.filter(({ authorAssociation }) => authorAssociation === 'MEMBER').length;
        if (totalCount === 0) {
            throw this._createError(`Pull request cannot be merged without at least one review from a team member`);
        }
    }
}
//# sourceMappingURL=assert-minimum-reviews.js.map