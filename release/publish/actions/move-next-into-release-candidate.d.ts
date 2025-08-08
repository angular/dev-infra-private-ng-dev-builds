import { ActiveReleaseTrains } from '../../versioning/index.js';
import { BranchOffNextBranchBaseAction } from './shared/branch-off-next-branch.js';
export declare class MoveNextIntoReleaseCandidateAction extends BranchOffNextBranchBaseAction {
    newPhaseName: "release-candidate";
    static isActive(active: ActiveReleaseTrains): Promise<boolean>;
}
