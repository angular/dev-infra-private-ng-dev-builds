import { Log, red } from '../../../utils/logging.js';
import { mergeLabels } from '../labels/index.js';
import { targetLabels } from '../labels/target.js';
import { createPullRequestValidation, PullRequestValidation } from './validation-config.js';
const automationBots = ['angular-robot'];
export const changesAllowForTargetLabelValidation = createPullRequestValidation({ name: 'assertChangesAllowForTargetLabel', canBeForceIgnored: true }, () => Validation);
class Validation extends PullRequestValidation {
    assert(commits, targetLabel, config, releaseTrains, labelsOnPullRequest, pullRequest) {
        if (labelsOnPullRequest.includes(mergeLabels['MERGE_FIX_COMMIT_MESSAGE'].name)) {
            Log.debug('Skipping commit message target label validation because the commit message fixup label is ' +
                'applied.');
            return;
        }
        const exemptedScopes = config.targetLabelExemptScopes || [];
        commits = commits.filter((commit) => !exemptedScopes.includes(commit.scope));
        const hasBreakingChanges = commits.some((commit) => commit.breakingChanges.length !== 0);
        const hasDeprecations = commits.some((commit) => commit.deprecations.length !== 0);
        const hasFeatureCommits = commits.some((commit) => commit.type === 'feat');
        switch (targetLabel) {
            case targetLabels['TARGET_MAJOR']:
                break;
            case targetLabels['TARGET_MINOR']:
                if (hasBreakingChanges) {
                    throw this._createHasBreakingChangesError(targetLabel);
                }
                break;
            case targetLabels['TARGET_RC']:
            case targetLabels['TARGET_LTS']:
            case targetLabels['TARGET_PATCH']:
                if (hasBreakingChanges) {
                    throw this._createHasBreakingChangesError(targetLabel);
                }
                if (hasFeatureCommits) {
                    throw this._createHasFeatureCommitsError(targetLabel);
                }
                if (hasDeprecations && !releaseTrains.isFeatureFreeze()) {
                    throw this._createHasDeprecationsError(targetLabel);
                }
            case targetLabels['TARGET_AUTOMATION']:
                if (!automationBots.includes(pullRequest.author.login)) {
                    throw this._createUserUsingAutomationLabelError(targetLabel, pullRequest.author.login);
                }
                break;
            default:
                Log.warn(red('WARNING: Unable to confirm all commits in the pull request are'));
                Log.warn(red(`eligible to be merged into the target branches for: ${targetLabel.name}`));
                break;
        }
    }
    _createHasBreakingChangesError(label) {
        const message = `Cannot merge into branch for "${label.name}" as the pull request has ` +
            `breaking changes. Breaking changes can only be merged with the "target: major" label.`;
        return this._createError(message);
    }
    _createHasDeprecationsError(label) {
        const message = `Cannot merge into branch for "${label.name}" as the pull request ` +
            `contains deprecations. Deprecations can only be merged with the "target: minor" or ` +
            `"target: major" label.`;
        return this._createError(message);
    }
    _createHasFeatureCommitsError(label) {
        const message = `Cannot merge into branch for "${label.name}" as the pull request has ` +
            'commits with the "feat" type. New features can only be merged with the "target: minor" ' +
            'or "target: major" label.';
        return this._createError(message);
    }
    _createUserUsingAutomationLabelError(label, author) {
        const message = `Cannot merge into branch for "${label.name}" as the pull request is authored by "${author}" ` +
            `but only known automation bot accounts (${automationBots.join(', ')}) can use this label.`;
        return this._createError(message);
    }
}
//# sourceMappingURL=assert-allowed-target-label.js.map