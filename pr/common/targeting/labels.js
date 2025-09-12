import { assertValidReleaseConfig } from '../../../release/config/index.js';
import { getNextBranchName, isVersionBranch, } from '../../../release/versioning/index.js';
import { assertValidGithubConfig, ConfigValidationError, } from '../../../utils/config.js';
import { InvalidTargetBranchError, InvalidTargetLabelError, } from './target-label.js';
import { assertActiveLtsBranch } from './lts-branch.js';
import { Log } from '../../../utils/logging.js';
import { assertValidPullRequestConfig } from '../../config/index.js';
import { targetLabels } from '../labels/target.js';
export async function getTargetLabelConfigsForActiveReleaseTrains({ latest, releaseCandidate, next, exceptionalMinor }, api, config) {
    assertValidGithubConfig(config);
    assertValidPullRequestConfig(config);
    const nextBranchName = getNextBranchName(config.github);
    const repo = {
        owner: config.github.owner,
        name: config.github.name,
        nextBranchName,
        api,
    };
    const labelConfigs = [
        {
            label: targetLabels['TARGET_MAJOR'],
            branches: () => {
                if (!next.isMajor) {
                    throw new InvalidTargetLabelError(`Unable to merge pull request. The "${nextBranchName}" branch will be released as ` +
                        'a minor version.');
                }
                return [nextBranchName];
            },
        },
        {
            label: targetLabels['TARGET_MINOR'],
            branches: (githubTargetBranch) => {
                if (githubTargetBranch === exceptionalMinor?.branchName) {
                    return [exceptionalMinor.branchName];
                }
                return [nextBranchName];
            },
        },
        {
            label: targetLabels['TARGET_PATCH'],
            branches: (githubTargetBranch) => {
                if (githubTargetBranch === latest.branchName) {
                    return [latest.branchName];
                }
                const branches = [nextBranchName, latest.branchName];
                if (releaseCandidate !== null) {
                    branches.push(releaseCandidate.branchName);
                }
                if (exceptionalMinor !== null) {
                    branches.push(exceptionalMinor.branchName);
                }
                return branches;
            },
        },
        {
            label: targetLabels['TARGET_RC'],
            branches: (githubTargetBranch) => {
                if (releaseCandidate === null) {
                    throw new InvalidTargetLabelError(`No active feature-freeze/release-candidate branch. ` +
                        `Unable to merge pull request using "target: rc" label.`);
                }
                if (githubTargetBranch === releaseCandidate.branchName) {
                    return [releaseCandidate.branchName];
                }
                return [nextBranchName, releaseCandidate.branchName];
            },
        },
        {
            label: targetLabels['TARGET_FEATURE'],
            branches: (githubTargetBranch) => {
                if (isVersionBranch(githubTargetBranch) || githubTargetBranch === nextBranchName) {
                    throw new InvalidTargetBranchError('"target: feature" pull requests cannot target a releasable branch');
                }
                return [githubTargetBranch];
            },
        },
        {
            label: targetLabels['TARGET_AUTOMATION'],
            branches: (githubTargetBranch) => {
                if (!isVersionBranch(githubTargetBranch)) {
                    throw new InvalidTargetBranchError('"target: automation" pull requests can only target a release branch');
                }
                return [githubTargetBranch];
            },
        },
    ];
    try {
        assertValidReleaseConfig(config);
        labelConfigs.push({
            label: targetLabels['TARGET_LTS'],
            branches: async (githubTargetBranch) => {
                if (!isVersionBranch(githubTargetBranch)) {
                    throw new InvalidTargetBranchError(`PR cannot be merged as it does not target a long-term support ` +
                        `branch: "${githubTargetBranch}"`);
                }
                if (githubTargetBranch === latest.branchName) {
                    throw new InvalidTargetBranchError(`PR cannot be merged with "target: lts" into patch branch. ` +
                        `Consider changing the label to "target: patch" if this is intentional.`);
                }
                if (releaseCandidate !== null && githubTargetBranch === releaseCandidate.branchName) {
                    throw new InvalidTargetBranchError(`PR cannot be merged with "target: lts" into feature-freeze/release-candidate ` +
                        `branch. Consider changing the label to "target: rc" if this is intentional.`);
                }
                assertValidReleaseConfig(config);
                await assertActiveLtsBranch(repo, config.release, githubTargetBranch);
                return [githubTargetBranch];
            },
        });
    }
    catch (err) {
        if (err instanceof ConfigValidationError) {
            Log.debug('LTS target label not included in target labels as no valid release');
            Log.debug('configuration was found to allow the LTS branches to be determined.');
        }
        else {
            throw err;
        }
    }
    return labelConfigs;
}
//# sourceMappingURL=labels.js.map