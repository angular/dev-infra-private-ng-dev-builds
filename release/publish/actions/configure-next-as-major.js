import semver from 'semver';
import { green, Log } from '../../../utils/logging.js';
import { workspaceRelativePackageJsonPath } from '../../../utils/constants.js';
import { ReleaseAction } from '../actions.js';
import { getCommitMessageForNextBranchMajorSwitch } from '../commit-message.js';
import { isFirstNextPrerelease } from '../../versioning/prerelease-version.js';
import { isVersionPublishedToNpm } from '../../versioning/npm-registry.js';
export class ConfigureNextAsMajorAction extends ReleaseAction {
    constructor() {
        super(...arguments);
        this._newVersion = semver.parse(`${this.active.next.version.major + 1}.0.0-next.0`);
    }
    async getDescription() {
        const { branchName } = this.active.next;
        const newVersion = this._newVersion;
        return `Configure the "${branchName}" branch to be released as major (v${newVersion}).`;
    }
    async perform() {
        const { branchName } = this.active.next;
        const newVersion = this._newVersion;
        const { sha: beforeStagingSha } = await this.getLatestCommitOfBranch(branchName);
        await this.assertPassingGithubStatus(beforeStagingSha, branchName);
        await this.checkoutUpstreamBranch(branchName);
        await this.updateProjectVersion(newVersion);
        const filesToCommit = [workspaceRelativePackageJsonPath];
        await this.createCommit(getCommitMessageForNextBranchMajorSwitch(newVersion), filesToCommit);
        const pullRequest = await this.pushChangesToForkAndCreatePullRequest(branchName, `switch-next-to-major-${newVersion}`, `Configure next branch to receive major changes for v${newVersion}`);
        Log.info(green('  ✓   Next branch update pull request has been created.'));
        await this.promptAndWaitForPullRequestMerged(pullRequest);
    }
    static async isActive(active, config) {
        return (!active.next.isMajor &&
            isFirstNextPrerelease(active.next.version) &&
            !(await isVersionPublishedToNpm(active.next.version, config)));
    }
}
//# sourceMappingURL=configure-next-as-major.js.map