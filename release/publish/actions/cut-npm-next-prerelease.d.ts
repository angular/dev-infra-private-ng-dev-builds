import semver from 'semver';
import { ActiveReleaseTrains } from '../../versioning/active-release-trains.js';
import { CutPrereleaseBaseAction } from './shared/cut-prerelease.js';
export declare class CutNpmNextPrereleaseAction extends CutPrereleaseBaseAction {
    releaseTrain: import("../../versioning/release-trains.js").ReleaseTrain;
    npmDistTag: "next";
    shouldUseExistingVersion: Promise<boolean>;
    releaseNotesCompareVersion: Promise<semver.SemVer>;
    static isActive(_active: ActiveReleaseTrains): Promise<boolean>;
}
