import { ActiveReleaseTrains } from '../../versioning/index.js';
import { BranchOffNextBranchBaseAction } from './shared/branch-off-next-branch.js';
export declare class MoveNextIntoFeatureFreezeAction extends BranchOffNextBranchBaseAction {
    newPhaseName: "feature-freeze";
    static isActive(active: ActiveReleaseTrains): Promise<boolean>;
}
