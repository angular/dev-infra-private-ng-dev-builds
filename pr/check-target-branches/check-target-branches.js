import { assertValidGithubConfig, getConfig } from '../../utils/config.js';
import { Log } from '../../utils/logging.js';
import { GitClient } from '../../utils/git/git-client.js';
import { assertValidPullRequestConfig } from '../config/index.js';
import { getTargetBranchesAndLabelForPullRequest } from '../common/targeting/target-label.js';
import { ActiveReleaseTrains } from '../../release/versioning/active-release-trains.js';
import { getNextBranchName } from '../../release/versioning/version-branches.js';
async function getTargetBranchesForPr(prNumber, config) {
    const { owner, name: repo } = config.github;
    const git = await GitClient.get();
    const prData = (await git.github.pulls.get({ owner, repo, pull_number: prNumber })).data;
    const labels = prData.labels.map((l) => l.name);
    const githubTargetBranch = prData.base.ref;
    const activeReleaseTrains = await ActiveReleaseTrains.fetch({
        name: repo,
        owner: owner,
        nextBranchName: getNextBranchName(config.github),
        api: git.github,
    });
    return getTargetBranchesAndLabelForPullRequest(activeReleaseTrains, git.github, config, labels, githubTargetBranch);
}
export async function printTargetBranchesForPr(prNumber) {
    const config = await getConfig();
    assertValidGithubConfig(config);
    assertValidPullRequestConfig(config);
    if (config.pullRequest.__noTargetLabeling) {
        Log.info(`This repository does not use target labeling (special flag enabled).`);
        Log.info(`PR #${prNumber} will merge into: ${config.github.mainBranchName}`);
        return;
    }
    const target = await getTargetBranchesForPr(prNumber, config);
    Log.info(`PR has the following target label: ${target.label.name}`);
    Log.info.group(`PR #${prNumber} will merge into:`);
    target.branches.forEach((name) => Log.info(`- ${name}`));
    Log.info.groupEnd();
}
//# sourceMappingURL=check-target-branches.js.map