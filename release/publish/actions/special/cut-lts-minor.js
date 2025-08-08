import semver from 'semver';
import { Log } from '../../../../utils/logging.js';
import { getLtsNpmDistTagOfMajor } from '../../../versioning/long-term-support.js';
import { convertVersionBranchToSemVer, isVersionBranch, } from '../../../versioning/version-branches.js';
import { FatalReleaseActionError } from '../../actions-error.js';
import { ReleaseAction } from '../../actions.js';
import { Prompt } from '../../../../utils/prompt.js';
export class SpecialCutLongTermSupportMinorAction extends ReleaseAction {
    async getDescription() {
        return `SPECIAL: Cut a new release for an LTS minor.`;
    }
    async perform() {
        const ltsBranch = await this._askForVersionBranch('Please specify the target LTS branch:');
        const compareVersionForReleaseNotes = semver.parse(await Prompt.input({ message: 'Compare version for release' }));
        const newVersion = semver.parse(`${ltsBranch.branchVersion.major}.${ltsBranch.branchVersion.minor}.0`);
        const { pullRequest, releaseNotes, builtPackagesWithInfo, beforeStagingSha } = await this.checkoutBranchAndStageVersion(newVersion, compareVersionForReleaseNotes, ltsBranch.branch);
        await this.promptAndWaitForPullRequestMerged(pullRequest);
        await this.publish(builtPackagesWithInfo, releaseNotes, beforeStagingSha, ltsBranch.branch, getLtsNpmDistTagOfMajor(newVersion.major), { showAsLatestOnGitHub: false });
        await this.cherryPickChangelogIntoNextBranch(releaseNotes, ltsBranch.branch);
    }
    async _askForVersionBranch(message) {
        const branch = await Prompt.input({ message });
        if (!isVersionBranch(branch)) {
            Log.error('Invalid release branch specified.');
            throw new FatalReleaseActionError();
        }
        const branchVersion = convertVersionBranchToSemVer(branch);
        if (branchVersion === null) {
            Log.error('Could not parse version branch.');
            throw new FatalReleaseActionError();
        }
        return { branch, branchVersion };
    }
    static async isActive(_active) {
        return process.env['NG_DEV_SPECIAL_RELEASE_ACTIONS'] === '1';
    }
}
//# sourceMappingURL=cut-lts-minor.js.map