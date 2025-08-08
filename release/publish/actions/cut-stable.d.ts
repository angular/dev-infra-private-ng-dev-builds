import { ActiveReleaseTrains } from '../../versioning/active-release-trains.js';
import { ReleaseAction } from '../actions.js';
export declare class CutStableAction extends ReleaseAction {
    private _train;
    private _branch;
    private _newVersion;
    private _isNewMajor;
    getDescription(): Promise<string>;
    perform(): Promise<void>;
    private _getNpmDistTag;
    private _computeNewVersion;
    static isActive(active: ActiveReleaseTrains): Promise<boolean>;
}
