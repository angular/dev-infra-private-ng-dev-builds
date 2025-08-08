import { createPullRequestValidation, PullRequestValidation } from './validation-config.js';
export const pendingStateValidation = createPullRequestValidation({ name: 'assertPending', canBeForceIgnored: false }, () => Validation);
class Validation extends PullRequestValidation {
    assert(pullRequest) {
        switch (pullRequest.state) {
            case 'CLOSED':
                throw this._createError('Pull request is already closed.');
            case 'MERGED':
                throw this._createError('Pull request is already merged.');
        }
    }
}
//# sourceMappingURL=assert-pending.js.map