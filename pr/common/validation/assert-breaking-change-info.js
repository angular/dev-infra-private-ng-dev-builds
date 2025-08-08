import { managedLabels } from '../labels/index.js';
import { createPullRequestValidation, PullRequestValidation } from './validation-config.js';
export const breakingChangeInfoValidation = createPullRequestValidation({ name: 'assertPending', canBeForceIgnored: false }, () => Validation);
class Validation extends PullRequestValidation {
    assert(commits, labels) {
        const hasLabel = labels.includes(managedLabels['DETECTED_BREAKING_CHANGE'].name);
        const hasCommit = commits.some((commit) => commit.breakingChanges.length !== 0);
        if (!hasLabel && hasCommit) {
            throw this._createMissingBreakingChangeLabelError();
        }
        if (hasLabel && !hasCommit) {
            throw this._createMissingBreakingChangeCommitError();
        }
    }
    _createMissingBreakingChangeLabelError() {
        const message = `Pull Request has at least one commit containing a breaking change note, ` +
            `but does not have a breaking change label. Make sure to apply the ` +
            `following label: ${managedLabels['DETECTED_BREAKING_CHANGE'].name}`;
        return this._createError(message);
    }
    _createMissingBreakingChangeCommitError() {
        const message = 'Pull Request has a breaking change label, but does not contain any commits with ' +
            'breaking change notes (i.e. commits do not have a `BREAKING CHANGE: <..>` section).';
        return this._createError(message);
    }
}
//# sourceMappingURL=assert-breaking-change-info.js.map