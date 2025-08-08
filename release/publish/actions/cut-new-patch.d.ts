import { ActiveReleaseTrains } from '../../versioning/active-release-trains.js';
import { ReleaseAction } from '../actions.js';
export declare class CutNewPatchAction extends ReleaseAction {
    private _previousVersion;
    private _newVersion;
    getDescription(): Promise<string>;
    perform(): Promise<void>;
    static isActive(_active: ActiveReleaseTrains): Promise<boolean>;
}
