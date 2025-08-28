import semver from 'semver';
import { workspaceRelativePackageJsonPath } from '../../../../utils/constants.js';
import { green, Log } from '../../../../utils/logging.js';
import { exceptionalMinorPackageIndicator } from '../../../versioning/version-branches.js';
import { ReleaseAction } from '../../actions.js';
export class PrepareExceptionalMinorAction extends ReleaseAction {
    constructor() {
        super(...arguments);
        this._patch = this.active.latest;
        this._baseBranch = this._patch.branchName;
        this._patchVersion = this._patch.version;
        this._newBranch = `${this._patchVersion.major}.${this._patchVersion.minor + 1}.x`;
        this._newVersion = semver.parse(`${this._patchVersion.major}.${this._patchVersion.minor + 1}.0-next.0`);
    }
    async getDescription() {
        return `Prepare an exceptional minor based on the existing "${this._baseBranch}" branch (${this._newBranch}).`;
    }
    async perform() {
        const { sha: latestBaseBranchSha } = await this.getLatestCommitOfBranch(this._baseBranch);
        await this.assertPassingGithubStatus(latestBaseBranchSha, this._baseBranch);
        await this.checkoutUpstreamBranch(this._baseBranch);
        await this.createLocalBranchFromHead(this._newBranch);
        await this.updateProjectVersion(this._newVersion, (pkgJson) => {
            pkgJson[exceptionalMinorPackageIndicator] = true;
        });
        const filesToCommit = [workspaceRelativePackageJsonPath];
        await this.createCommit(`build: prepare exceptional minor branch: ${this._newBranch}`, filesToCommit);
        await this.pushHeadToRemoteBranch(this._newBranch);
        Log.info(green(`  ✓   Version branch "${this._newBranch}" created.`));
        Log.info(green(`      Exceptional minor release-train is now active.`));
    }
    static async isActive(active) {
        if (active.exceptionalMinor !== null) {
            return false;
        }
        if (active.releaseCandidate !== null) {
            return active.releaseCandidate.isMajor;
        }
        return active.next.isMajor;
    }
}
//# sourceMappingURL=prepare-exceptional-minor.js.map