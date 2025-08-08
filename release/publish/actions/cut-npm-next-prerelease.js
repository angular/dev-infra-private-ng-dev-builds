import { isVersionPublishedToNpm } from '../../versioning/npm-registry.js';
import { isFirstNextPrerelease } from '../../versioning/prerelease-version.js';
import { CutPrereleaseBaseAction } from './shared/cut-prerelease.js';
export class CutNpmNextPrereleaseAction extends CutPrereleaseBaseAction {
    constructor() {
        super(...arguments);
        this.releaseTrain = this.active.releaseCandidate ?? this.active.next;
        this.npmDistTag = 'next';
        this.shouldUseExistingVersion = (async () => {
            if (this.releaseTrain === this.active.next && isFirstNextPrerelease(this.active.next.version)) {
                return !(await isVersionPublishedToNpm(this.active.next.version, this.config));
            }
            return false;
        })();
        this.releaseNotesCompareVersion = (async () => {
            if (this.releaseTrain === this.active.next && (await this.shouldUseExistingVersion)) {
                return this.active.latest.version;
            }
            return this.releaseTrain.version;
        })();
    }
    static async isActive(_active) {
        return true;
    }
}
//# sourceMappingURL=cut-npm-next-prerelease.js.map