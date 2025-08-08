import semver from 'semver';
import { ActiveReleaseTrains } from '../../../versioning/active-release-trains.js';
import { CutPrereleaseBaseAction } from '../shared/cut-prerelease.js';
export declare class CutExceptionalMinorPrereleaseAction extends CutPrereleaseBaseAction {
    releaseTrain: import("../../../versioning/release-trains.js").ReleaseTrain;
    npmDistTag: "do-not-use-exceptional-minor";
    shouldUseExistingVersion: Promise<boolean>;
    releaseNotesCompareVersion: Promise<semver.SemVer>;
    getDescription(): Promise<string>;
    static isActive(active: ActiveReleaseTrains): Promise<boolean>;
}
