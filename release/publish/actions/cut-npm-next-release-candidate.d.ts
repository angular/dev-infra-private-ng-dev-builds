/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import semver from 'semver';
import { ActiveReleaseTrains } from '../../versioning/active-release-trains.js';
import { CutNpmNextPrereleaseAction } from './cut-npm-next-prerelease.js';
/**
 * Release action that allows for the NPM `@next` first release-candidate. The
 * action is only active when there is a current feature-freeze going on.
 *
 * The action will bump the pre-release version from the `-next` prerelease to
 * the first release-candidate. The action will then become inactive again as
 * additional RC pre-releases would be handled by `CutNpmNextPrereleaseAction` then.
 *
 * Additional note: There is a separate action allowing in-progress minor's to
 * go directly into the RC phase from the `next` train. See `MoveNextIntoReleaseCandidate`.
 */
export declare class CutNpmNextReleaseCandidateAction extends CutNpmNextPrereleaseAction {
    getDescription(): Promise<string>;
    getNewVersion(): Promise<semver.SemVer>;
    static isActive(active: ActiveReleaseTrains): Promise<boolean>;
}
