import { BranchOffNextBranchBaseAction } from './shared/branch-off-next-branch.js';
export class MoveNextIntoFeatureFreezeAction extends BranchOffNextBranchBaseAction {
    constructor() {
        super(...arguments);
        this.newPhaseName = 'feature-freeze';
    }
    static async isActive(active) {
        return active.releaseCandidate === null && active.next.isMajor;
    }
}
//# sourceMappingURL=move-next-into-feature-freeze.js.map