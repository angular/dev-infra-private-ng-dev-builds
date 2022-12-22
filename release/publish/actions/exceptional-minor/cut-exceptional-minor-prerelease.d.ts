/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ActiveReleaseTrains } from '../../../versioning/active-release-trains.js';
import { CutPrereleaseBaseAction } from '../shared/cut-prerelease.js';
/**
 * Release action that allows for `-next` pre-releases of an in-progress
 * exceptional minor. The action is active when there is an exceptional minor.
 *
 * The action will bump the pre-release version to the next increment
 * and publish it to NPM. Note that it would not be tagged on NPM as `@next`.
 */
export declare class CutExceptionalMinorPrereleaseAction extends CutPrereleaseBaseAction {
    releaseTrain: import("../../../versioning/release-trains.js").ReleaseTrain;
    npmDistTag: "exceptional-minor";
    shouldUseExistingVersion: Promise<boolean>;
    releaseNotesCompareVersion: Promise<import("@types/semver/classes/semver.js")>;
    getDescription(): Promise<string>;
    static isActive(active: ActiveReleaseTrains): Promise<boolean>;
}
