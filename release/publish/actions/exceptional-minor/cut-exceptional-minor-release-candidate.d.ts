import semver from 'semver';
import { ActiveReleaseTrains } from '../../../versioning/active-release-trains.js';
import { CutExceptionalMinorPrereleaseAction } from './cut-exceptional-minor-prerelease.js';
export declare class CutExceptionalMinorReleaseCandidateAction extends CutExceptionalMinorPrereleaseAction {
    getDescription(): Promise<string>;
    getNewVersion(): Promise<semver.SemVer>;
    static isActive(active: ActiveReleaseTrains): Promise<boolean>;
}
