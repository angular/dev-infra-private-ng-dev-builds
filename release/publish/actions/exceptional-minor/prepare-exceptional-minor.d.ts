import { ActiveReleaseTrains } from '../../../versioning/active-release-trains.js';
import { ReleaseAction } from '../../actions.js';
export declare class PrepareExceptionalMinorAction extends ReleaseAction {
    private _patch;
    private _baseBranch;
    private _patchVersion;
    private _newBranch;
    private _newVersion;
    getDescription(): Promise<string>;
    perform(): Promise<void>;
    static isActive(active: ActiveReleaseTrains): Promise<boolean>;
}
