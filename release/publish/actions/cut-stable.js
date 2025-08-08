import semver from 'semver';
import { getLtsNpmDistTagOfMajor } from '../../versioning/long-term-support.js';
import { exceptionalMinorPackageIndicator } from '../../versioning/version-branches.js';
import { FatalReleaseActionError } from '../actions-error.js';
import { ReleaseAction } from '../actions.js';
import { ExternalCommands } from '../external-commands.js';
export class CutStableAction extends ReleaseAction {
    constructor() {
        super(...arguments);
        this._train = (this.active.exceptionalMinor ?? this.active.releaseCandidate);
        this._branch = this._train.branchName;
        this._newVersion = this._computeNewVersion(this._train);
        this._isNewMajor = this._train.isMajor;
    }
    async getDescription() {
        if (this._isNewMajor) {
            return `Cut a stable release for the "${this._branch}" branch — published as \`@next\` (v${this._newVersion}).`;
        }
        else {
            return `Cut a stable release for the "${this._branch}" branch — published as \`@latest\` (v${this._newVersion}).`;
        }
    }
    async perform() {
        if (this._isNewMajor && this._train === this.active.exceptionalMinor) {
            throw new FatalReleaseActionError('Unexpected major release of an `exceptional-minor`.');
        }
        const branchName = this._branch;
        const newVersion = this._newVersion;
        const compareVersionForReleaseNotes = this.active.latest.version;
        const stagingOpts = {
            updatePkgJsonFn: (pkgJson) => {
                pkgJson[exceptionalMinorPackageIndicator] = undefined;
            },
        };
        const { pullRequest, releaseNotes, builtPackagesWithInfo, beforeStagingSha } = await this.checkoutBranchAndStageVersion(newVersion, compareVersionForReleaseNotes, branchName, stagingOpts);
        await this.promptAndWaitForPullRequestMerged(pullRequest);
        await this.publish(builtPackagesWithInfo, releaseNotes, beforeStagingSha, branchName, this._getNpmDistTag(), { showAsLatestOnGitHub: true });
        if (this._train === this.active.exceptionalMinor) {
            await ExternalCommands.invokeDeleteNpmDistTag(this.projectDir, 'do-not-use-exceptional-minor', this.pnpmVersioning);
        }
        if (this._isNewMajor) {
            const previousPatch = this.active.latest;
            const ltsTagForPatch = getLtsNpmDistTagOfMajor(previousPatch.version.major);
            await this.checkoutUpstreamBranch(previousPatch.branchName);
            await this.installDependenciesForCurrentBranch();
            await ExternalCommands.invokeSetNpmDist(this.projectDir, ltsTagForPatch, previousPatch.version, this.pnpmVersioning, {
                skipExperimentalPackages: true,
            });
        }
        await this.cherryPickChangelogIntoNextBranch(releaseNotes, branchName);
    }
    _getNpmDistTag() {
        return this._isNewMajor ? 'next' : 'latest';
    }
    _computeNewVersion({ version }) {
        return semver.parse(`${version.major}.${version.minor}.${version.patch}`);
    }
    static async isActive(active) {
        if (active.exceptionalMinor !== null) {
            return active.exceptionalMinor.version.prerelease[0] === 'rc';
        }
        if (active.releaseCandidate !== null) {
            return active.releaseCandidate.version.prerelease[0] === 'rc';
        }
        return false;
    }
}
//# sourceMappingURL=cut-stable.js.map