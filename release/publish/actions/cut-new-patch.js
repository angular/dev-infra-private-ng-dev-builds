import { semverInc } from '../../../utils/semver.js';
import { ReleaseAction } from '../actions.js';
export class CutNewPatchAction extends ReleaseAction {
    constructor() {
        super(...arguments);
        this._previousVersion = this.active.latest.version;
        this._newVersion = semverInc(this._previousVersion, 'patch');
    }
    async getDescription() {
        const { branchName } = this.active.latest;
        const newVersion = this._newVersion;
        return `Cut a new patch release for the "${branchName}" branch (v${newVersion}).`;
    }
    async perform() {
        const { branchName } = this.active.latest;
        const newVersion = this._newVersion;
        const compareVersionForReleaseNotes = this._previousVersion;
        const { pullRequest, releaseNotes, builtPackagesWithInfo, beforeStagingSha } = await this.checkoutBranchAndStageVersion(newVersion, compareVersionForReleaseNotes, branchName);
        await this.promptAndWaitForPullRequestMerged(pullRequest);
        await this.publish(builtPackagesWithInfo, releaseNotes, beforeStagingSha, branchName, 'latest', { showAsLatestOnGitHub: true });
        await this.cherryPickChangelogIntoNextBranch(releaseNotes, branchName);
    }
    static async isActive(_active) {
        return true;
    }
}
//# sourceMappingURL=cut-new-patch.js.map