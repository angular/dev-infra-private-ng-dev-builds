import { BranchOffNextBranchBaseAction } from './shared/branch-off-next-branch.js';
export class MoveNextIntoReleaseCandidateAction extends BranchOffNextBranchBaseAction {
    constructor() {
        super(...arguments);
        this.newPhaseName = 'release-candidate';
    }
    static async isActive(active) {
        return active.releaseCandidate === null && !active.next.isMajor;
    }
}
//# sourceMappingURL=move-next-into-release-candidate.js.map