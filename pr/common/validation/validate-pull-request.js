import { parseCommitMessage } from '../../../commit-message/parse.js';
import { changesAllowForTargetLabelValidation } from './assert-allowed-target-label.js';
import { breakingChangeInfoValidation } from './assert-breaking-change-info.js';
import { completedReviewsValidation } from './assert-completed-reviews.js';
import { isolatedSeparateFilesValidation } from './assert-isolated-separate-files.js';
import { enforcedStatusesValidation } from './assert-enforced-statuses.js';
import { enforceTestedValidation } from './assert-enforce-tested.js';
import { mergeReadyValidation } from './assert-merge-ready.js';
import { minimumReviewsValidation } from './assert-minimum-reviews.js';
import { passingCiValidation } from './assert-passing-ci.js';
import { pendingStateValidation } from './assert-pending.js';
import { signedClaValidation } from './assert-signed-cla.js';
export async function assertValidPullRequest(pullRequest, validationConfig, ngDevConfig, activeReleaseTrains, target, gitClient) {
    const labels = pullRequest.labels.nodes.map((l) => l.name);
    const commitsInPr = pullRequest.commits.nodes.map((n) => {
        return parseCommitMessage(n.commit.message);
    });
    const validationResults = [
        minimumReviewsValidation.run(validationConfig, pullRequest),
        completedReviewsValidation.run(validationConfig, pullRequest),
        mergeReadyValidation.run(validationConfig, pullRequest),
        signedClaValidation.run(validationConfig, pullRequest),
        pendingStateValidation.run(validationConfig, pullRequest),
        breakingChangeInfoValidation.run(validationConfig, commitsInPr, labels),
        passingCiValidation.run(validationConfig, pullRequest),
        enforcedStatusesValidation.run(validationConfig, pullRequest, ngDevConfig.pullRequest),
        isolatedSeparateFilesValidation.run(validationConfig, ngDevConfig, pullRequest.number, gitClient),
        enforceTestedValidation.run(validationConfig, pullRequest, gitClient),
    ];
    if (activeReleaseTrains !== null) {
        validationResults.push(changesAllowForTargetLabelValidation.run(validationConfig, commitsInPr, target.label, ngDevConfig.pullRequest, activeReleaseTrains, labels, pullRequest));
    }
    return await Promise.all(validationResults).then((results) => {
        return results.filter((((result) => result !== null)));
    });
}
//# sourceMappingURL=validate-pull-request.js.map