import { ActiveReleaseTrains } from '../../versioning/active-release-trains.js';
import { ReleaseAction } from '../actions.js';
export declare class CutLongTermSupportPatchAction extends ReleaseAction {
    ltsBranches: Promise<import("../../versioning/long-term-support.js").LtsBranches>;
    getDescription(): Promise<string>;
    perform(): Promise<void>;
    private _promptForTargetLtsBranch;
    private _getChoiceForLtsBranch;
    static isActive(_active: ActiveReleaseTrains): Promise<boolean>;
}
