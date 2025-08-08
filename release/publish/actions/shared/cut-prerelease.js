import { semverInc } from '../../../../utils/semver.js';
import { ReleaseAction } from '../../actions.js';
export class CutPrereleaseBaseAction extends ReleaseAction {
    async getDescription() {
        const branch = this._getBranch();
        const newVersion = await this.getNewVersion();
        return `Cut a new pre-release for the "${branch}" branch (v${newVersion}).`;
    }
    async getReleaseCandidateDescription() {
        const branch = this._getBranch();
        const newVersion = await this.getNewVersion();
        return `Cut a first release-candidate for the "${branch}" branch (v${newVersion}).`;
    }
    async perform() {
        const branchName = this._getBranch();
        const newVersion = await this.getNewVersion();
        const compareVersionForReleaseNotes = await this.releaseNotesCompareVersion;
        const { pullRequest, releaseNotes, builtPackagesWithInfo, beforeStagingSha } = await this.checkoutBranchAndStageVersion(newVersion, compareVersionForReleaseNotes, branchName);
        await this.promptAndWaitForPullRequestMerged(pullRequest);
        await this.publish(builtPackagesWithInfo, releaseNotes, beforeStagingSha, branchName, this.npmDistTag, { showAsLatestOnGitHub: false });
        if (this.releaseTrain !== this.active.next) {
            await this.cherryPickChangelogIntoNextBranch(releaseNotes, branchName);
        }
    }
    async getNewVersion() {
        if (await this.shouldUseExistingVersion) {
            return this.releaseTrain.version;
        }
        else {
            return semverInc(this.releaseTrain.version, 'prerelease');
        }
    }
    _getBranch() {
        return this.releaseTrain.branchName;
    }
}
//# sourceMappingURL=cut-prerelease.js.map