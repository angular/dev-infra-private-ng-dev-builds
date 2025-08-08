import semver from 'semver';
import { ActiveReleaseTrains } from '../../versioning/active-release-trains.js';
import { CutNpmNextPrereleaseAction } from './cut-npm-next-prerelease.js';
export declare class CutNpmNextReleaseCandidateAction extends CutNpmNextPrereleaseAction {
    getDescription(): Promise<string>;
    getNewVersion(): Promise<semver.SemVer>;
    static isActive(active: ActiveReleaseTrains): Promise<boolean>;
}
