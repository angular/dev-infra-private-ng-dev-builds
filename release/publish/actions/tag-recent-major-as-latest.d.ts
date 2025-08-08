import semver from 'semver';
import { ReleaseConfig } from '../../config/index.js';
import { ActiveReleaseTrains } from '../../versioning/active-release-trains.js';
import { ReleaseAction } from '../actions.js';
export declare class TagRecentMajorAsLatest extends ReleaseAction {
    getDescription(): Promise<string>;
    perform(): Promise<void>;
    updateGithubReleaseEntryToStable(version: semver.SemVer): Promise<void>;
    static isActive({ latest }: ActiveReleaseTrains, config: ReleaseConfig): Promise<boolean>;
}
