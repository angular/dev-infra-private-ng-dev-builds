import { getTargetBranchesAndLabelForPullRequest, } from '../common/targeting/target-label.js';
import { fetchPullRequestFromGithub } from '../common/fetch-pull-request.js';
import { FatalMergeToolError } from './failures.js';
import { ActiveReleaseTrains } from '../../release/versioning/active-release-trains.js';
import { assertValidPullRequest } from '../common/validation/validate-pull-request.js';
import { TEMP_PR_HEAD_BRANCH } from './strategies/strategy.js';
import { mergeLabels } from '../common/labels/merge.js';
import { targetLabels } from '../common/labels/target.js';
export async function loadAndValidatePullRequest({ git, config, }, prNumber, validationConfig) {
    const prData = await fetchPullRequestFromGithub(git, prNumber);
    if (prData === null) {
        throw new FatalMergeToolError('Pull request could not be found.');
    }
    const labels = prData.labels.nodes.map((l) => l.name);
    const githubTargetBranch = prData.baseRefName;
    const { mainBranchName, name, owner } = config.github;
    let activeReleaseTrains = null;
    let target = null;
    if (config.pullRequest.__noTargetLabeling) {
        target = { branches: [config.github.mainBranchName], label: targetLabels['TARGET_MAJOR'] };
    }
    else {
        activeReleaseTrains = await ActiveReleaseTrains.fetch({
            name,
            nextBranchName: mainBranchName,
            owner,
            api: git.github,
        });
        target = await getTargetBranchesAndLabelForPullRequest(activeReleaseTrains, git.github, config, labels, githubTargetBranch);
    }
    const validationFailures = await assertValidPullRequest(prData, validationConfig, config, activeReleaseTrains, target, git);
    const requiredBaseSha = config.pullRequest.requiredBaseCommits &&
        config.pullRequest.requiredBaseCommits[githubTargetBranch];
    const needsCommitMessageFixup = labels.includes(mergeLabels['MERGE_FIX_COMMIT_MESSAGE'].name);
    const hasCaretakerNote = labels.includes(mergeLabels['MERGE_CARETAKER_NOTE'].name);
    const baseSha = prData.baseCommitInfo.nodes[0].commit.parents.nodes[0].oid;
    const revisionRange = `${baseSha}..${TEMP_PR_HEAD_BRANCH}`;
    return {
        url: prData.url,
        prNumber,
        labels,
        requiredBaseSha,
        githubTargetBranch,
        needsCommitMessageFixup,
        baseSha,
        revisionRange,
        hasCaretakerNote,
        validationFailures,
        targetBranches: target.branches,
        title: prData.title,
        commitCount: prData.commits.totalCount,
        headSha: prData.headRefOid,
    };
}
//# sourceMappingURL=pull-request.js.map