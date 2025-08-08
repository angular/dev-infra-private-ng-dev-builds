import { ActiveReleaseTrains } from '../../../versioning/active-release-trains.js';
import { ReleaseAction } from '../../actions.js';
export declare class SpecialCutLongTermSupportMinorAction extends ReleaseAction {
    getDescription(): Promise<string>;
    perform(): Promise<void>;
    private _askForVersionBranch;
    static isActive(_active: ActiveReleaseTrains): Promise<boolean>;
}
