import { isVersionPublishedToNpm } from '../../../versioning/npm-registry.js';
import { isFirstNextPrerelease } from '../../../versioning/prerelease-version.js';
import { CutPrereleaseBaseAction } from '../shared/cut-prerelease.js';
export class CutExceptionalMinorPrereleaseAction extends CutPrereleaseBaseAction {
    constructor() {
        super(...arguments);
        this.releaseTrain = this.active.exceptionalMinor;
        this.npmDistTag = 'do-not-use-exceptional-minor';
        this.shouldUseExistingVersion = (async () => {
            return (isFirstNextPrerelease(this.releaseTrain.version) &&
                !(await isVersionPublishedToNpm(this.releaseTrain.version, this.config)));
        })();
        this.releaseNotesCompareVersion = (async () => {
            if (await this.shouldUseExistingVersion) {
                return this.active.latest.version;
            }
            return this.releaseTrain.version;
        })();
    }
    async getDescription() {
        return `Exceptional Minor: ${await super.getDescription()}`;
    }
    static async isActive(active) {
        return active.exceptionalMinor !== null;
    }
}
//# sourceMappingURL=cut-exceptional-minor-prerelease.js.map