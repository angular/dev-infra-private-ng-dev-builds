import { semverInc } from '../../../utils/semver.js';
import { CutNpmNextPrereleaseAction } from './cut-npm-next-prerelease.js';
export class CutNpmNextReleaseCandidateAction extends CutNpmNextPrereleaseAction {
    async getDescription() {
        return await super.getReleaseCandidateDescription();
    }
    async getNewVersion() {
        return semverInc(this.releaseTrain.version, 'prerelease', 'rc');
    }
    static async isActive(active) {
        return active.isFeatureFreeze();
    }
}
//# sourceMappingURL=cut-npm-next-release-candidate.js.map