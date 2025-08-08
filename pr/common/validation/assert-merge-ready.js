import { actionLabels } from '../labels/index.js';
import { createPullRequestValidation, PullRequestValidation } from './validation-config.js';
export const mergeReadyValidation = createPullRequestValidation({ name: 'assertMergeReady', canBeForceIgnored: false }, () => Validation);
class Validation extends PullRequestValidation {
    assert(pullRequest) {
        if (pullRequest.isDraft) {
            throw this._createError('Pull request is still a draft.');
        }
        if (!pullRequest.labels.nodes.some(({ name }) => name === actionLabels['ACTION_MERGE'].name)) {
            throw this._createError('Pull request is not marked as merge ready.');
        }
    }
}
//# sourceMappingURL=assert-merge-ready.js.map