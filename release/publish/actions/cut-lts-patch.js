import { Prompt } from '../../../utils/prompt.js';
import { semverInc } from '../../../utils/semver.js';
import { fetchLongTermSupportBranchesFromNpm, } from '../../versioning/long-term-support.js';
import { ReleaseAction } from '../actions.js';
export class CutLongTermSupportPatchAction extends ReleaseAction {
    constructor() {
        super(...arguments);
        this.ltsBranches = fetchLongTermSupportBranchesFromNpm(this.config);
    }
    async getDescription() {
        const { active } = await this.ltsBranches;
        return `Cut a new release for an active LTS branch (${active.length} active).`;
    }
    async perform() {
        const ltsBranch = await this._promptForTargetLtsBranch();
        const newVersion = semverInc(ltsBranch.version, 'patch');
        const compareVersionForReleaseNotes = ltsBranch.version;
        const { pullRequest, releaseNotes, builtPackagesWithInfo, beforeStagingSha } = await this.checkoutBranchAndStageVersion(newVersion, compareVersionForReleaseNotes, ltsBranch.name);
        await this.promptAndWaitForPullRequestMerged(pullRequest);
        await this.publish(builtPackagesWithInfo, releaseNotes, beforeStagingSha, ltsBranch.name, ltsBranch.npmDistTag, { showAsLatestOnGitHub: false });
        await this.cherryPickChangelogIntoNextBranch(releaseNotes, ltsBranch.name);
    }
    async _promptForTargetLtsBranch() {
        const { active, inactive } = await this.ltsBranches;
        const activeBranchChoices = active.map((branch) => this._getChoiceForLtsBranch(branch));
        const inactiveBranchChoices = inactive.map((branch) => this._getChoiceForLtsBranch(branch));
        if (inactive.length !== 0) {
            activeBranchChoices.push({ name: 'Inactive LTS versions (not recommended)', value: null });
        }
        const activeLtsBranch = await Prompt.select({
            message: 'Please select a version for which you want to cut an LTS patch',
            choices: activeBranchChoices,
        });
        if (activeLtsBranch) {
            return activeLtsBranch;
        }
        return await Prompt.select({
            message: 'Please select an inactive LTS version for which you want to cut an LTS patch',
            choices: inactiveBranchChoices,
        });
    }
    _getChoiceForLtsBranch(branch) {
        return { name: `v${branch.version.major} (from ${branch.name})`, value: branch };
    }
    static async isActive(_active) {
        return true;
    }
}
//# sourceMappingURL=cut-lts-patch.js.map