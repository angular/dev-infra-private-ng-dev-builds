import { ActiveReleaseTrains } from '../../versioning/active-release-trains.js';
import { ReleaseAction } from '../actions.js';
import { ReleaseConfig } from '../../config/index.js';
export declare class ConfigureNextAsMajorAction extends ReleaseAction {
    private _newVersion;
    getDescription(): Promise<string>;
    perform(): Promise<void>;
    static isActive(active: ActiveReleaseTrains, config: ReleaseConfig): Promise<boolean>;
}
