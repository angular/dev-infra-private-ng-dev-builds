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
 * Base action that cuts a pre-release increment for a given release train.
 * A minor or major can have an arbitrary amount of next pre-releases.
 *
 * This base action is used for supporting pre-releases of the `next` train,
 * or an exceptional minor train, or an in-progress FF/RC train.
 */
export declare abstract class CutPrereleaseBaseAction extends ReleaseAction {
    abstract releaseTrain: ReleaseTrain;
    abstract npmDistTag: NpmDistTag | null;
    /**
     * Whether the existing version of the release train should be used. This
     * functionality exists to allow for cases where a release-train is newly
     * created and uses a version that is "to be released".
     *
     * This can happen when an exceptional minor branch is created, or when we
     * branch off from `main` and bump the version for the upcoming version-
     * which we do not publish immediately.
     *
     * If the promise returns `true`- the same version is used. If `false`,
     * the simple pre-release increment is used. e.g. `next.1` becomes `next.2`.
     */
    abstract shouldUseExistingVersion: Promise<boolean>;
    /**
     * Compare version used for the release notes generation. This is configurable
     * because there is no obvious choice for a compare version if `shouldUseExistingVersion`
     * would evaluate to `true`.
     */
    abstract releaseNotesCompareVersion: Promise<semver.SemVer>;
    getDescription(): Promise<string>;
    perform(): Promise<void>;
    /** Gets the new version that will be published. */
    getNewVersion(): Promise<semver.SemVer>;
    private _getBranch;
}
