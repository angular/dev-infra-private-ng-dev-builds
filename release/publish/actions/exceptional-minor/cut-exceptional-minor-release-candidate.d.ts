/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import semver from 'semver';
import { ActiveReleaseTrains } from '../../../versioning/active-release-trains.js';
import { CutExceptionalMinorPrereleaseAction } from './cut-exceptional-minor-prerelease.js';
/**
 * Release action that allows for the first exceptional minor release-candidate. The
 * action is only active when there is an in-progress exceptional minor that
 * is still in the `-next` pre-release phase.
 *
 * The action will bump the pre-release version from the `-next` prerelease to
 * the first release-candidate. The action will then become inactive again as
 * additional RC pre-releases would be handled by `CutExceptionalMinorPrereleaseAction`
 * then.
 */
export declare class CutExceptionalMinorReleaseCandidateAction extends CutExceptionalMinorPrereleaseAction {
    getDescription(): Promise<string>;
    getNewVersion(): Promise<semver.SemVer>;
    static isActive(active: ActiveReleaseTrains): Promise<boolean>;
}
