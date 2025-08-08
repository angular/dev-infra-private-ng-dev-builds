import { getTargetLabelConfigsForActiveReleaseTrains } from './labels.js';
export class InvalidTargetBranchError {
    constructor(failureMessage) {
        this.failureMessage = failureMessage;
    }
}
export class InvalidTargetLabelError {
    constructor(failureMessage) {
        this.failureMessage = failureMessage;
    }
}
export async function getMatchingTargetLabelConfigForPullRequest(labelsOnPullRequest, labelConfigs) {
    const matches = [];
    for (const prLabelName of labelsOnPullRequest) {
        const match = labelConfigs.find(({ label }) => label.name === prLabelName);
        if (match !== undefined) {
            matches.push(match);
        }
    }
    if (matches.length === 1) {
        return matches[0];
    }
    if (matches.length === 0) {
        throw new InvalidTargetLabelError('Unable to determine target for the PR as it has no target label.');
    }
    throw new InvalidTargetLabelError('Unable to determine target for the PR as it has multiple target labels.');
}
export async function getTargetBranchesAndLabelForPullRequest(activeReleaseTrains, github, config, labelsOnPullRequest, githubTargetBranch) {
    const labelConfigs = await getTargetLabelConfigsForActiveReleaseTrains(activeReleaseTrains, github, config);
    const matchingConfig = await getMatchingTargetLabelConfigForPullRequest(labelsOnPullRequest, labelConfigs);
    return {
        branches: await getBranchesForTargetLabel(matchingConfig, githubTargetBranch),
        label: matchingConfig.label,
    };
}
export async function getBranchesForTargetLabel(labelConfig, githubTargetBranch) {
    return typeof labelConfig.branches === 'function'
        ? await labelConfig.branches(githubTargetBranch)
        : await labelConfig.branches;
}
//# sourceMappingURL=target-label.js.map