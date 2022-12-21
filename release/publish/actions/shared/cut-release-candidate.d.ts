/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import semver from 'semver';
import { NpmDistTag } from '../../../versioning/npm-registry.js';
import { ReleaseTrain } from '../../../versioning/release-trains.js';
import { ReleaseAction } from '../../actions.js';
/**
 * Base action class for cutting a first release candidate for a release-train.
 * The version is bumped from an arbitrary `next` pre-release to `rc.0`.
 *
 * This base action can be used for cutting first release-candidate's of
 * an in-progress exceptional minor train, or for an actual feature-freeze train.
 */
export declare abstract class CutReleaseCandidateBaseAction extends ReleaseAction {
    abstract releaseTrain: ReleaseTrain;
    abstract npmDistTag: NpmDistTag | null;
    getDescription(): Promise<string>;
    perform(): Promise<void>;
    /** Gets the new version that will be published. */
    getNewVersion(): semver.SemVer;
    /** Gets the compare version for generating release notes. */
    getReleaseNotesCompareVersion(): semver.SemVer;
    private _getBranch;
}
