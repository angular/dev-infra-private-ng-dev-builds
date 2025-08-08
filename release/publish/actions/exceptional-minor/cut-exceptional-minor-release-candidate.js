import { semverInc } from '../../../../utils/semver.js';
import { CutExceptionalMinorPrereleaseAction } from './cut-exceptional-minor-prerelease.js';
export class CutExceptionalMinorReleaseCandidateAction extends CutExceptionalMinorPrereleaseAction {
    async getDescription() {
        return `Exceptional Minor: ${await super.getReleaseCandidateDescription()}`;
    }
    async getNewVersion() {
        return semverInc(this.releaseTrain.version, 'prerelease', 'rc');
    }
    static async isActive(active) {
        return (active.exceptionalMinor !== null && active.exceptionalMinor.version.prerelease[0] === 'next');
    }
}
//# sourceMappingURL=cut-exceptional-minor-release-candidate.js.map