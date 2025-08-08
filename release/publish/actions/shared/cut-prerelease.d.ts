import semver from 'semver';
import { NpmDistTag } from '../../../versioning/npm-registry.js';
import { ReleaseTrain } from '../../../versioning/release-trains.js';
import { ReleaseAction } from '../../actions.js';
export declare abstract class CutPrereleaseBaseAction extends ReleaseAction {
    abstract releaseTrain: ReleaseTrain;
    abstract npmDistTag: NpmDistTag;
    abstract shouldUseExistingVersion: Promise<boolean>;
    abstract releaseNotesCompareVersion: Promise<semver.SemVer>;
    getDescription(): Promise<string>;
    getReleaseCandidateDescription(): Promise<string>;
    perform(): Promise<void>;
    getNewVersion(): Promise<semver.SemVer>;
    private _getBranch;
}
