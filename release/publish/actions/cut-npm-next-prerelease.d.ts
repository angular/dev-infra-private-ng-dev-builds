/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import semver from 'semver';
import { ActiveReleaseTrains } from '../../versioning/active-release-trains.js';
import { CutPrereleaseBaseAction } from './shared/cut-prerelease.js';
/**
 * Release action that allows NPM `@next` pre-releases. The action will
 * always be active and operate on the an ongoing FF/RC train, or the
 * next release-train.
 *
 * The action will bump the pre-release version to the next increment
 * and publish it to NPM along with the `@npm` dist tag.
 */
export declare class CutNpmNextPrereleaseAction extends CutPrereleaseBaseAction {
    releaseTrain: import("../../versioning/release-trains.js").ReleaseTrain;
    npmDistTag: "next";
    shouldUseExistingVersion: Promise<boolean>;
    releaseNotesCompareVersion: Promise<semver.SemVer>;
    static isActive(_active: ActiveReleaseTrains): Promise<boolean>;
}
