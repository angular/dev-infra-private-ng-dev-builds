/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CutNpmNextPrereleaseAction } from '../cut-npm-next-prerelease.js';
/**
 * Base action that can be used to move the next release-train into the dedicated FF/RC
 * release-train while also cutting a release to move the train into the `feature-freeze`
 * or `release-candidate` phase.
 *
 * This means that a new version branch is created based on the next branch, and a new
 * pre-release (either RC or another `next`) is cut- indicating the new phase.
 */
export declare abstract class BranchOffNextBranchBaseAction extends CutNpmNextPrereleaseAction {
    /** Phase which the release-train currently in the `next` phase will move into. */
    abstract newPhaseName: 'feature-freeze' | 'release-candidate';
    private _nextPrerelease;
    private _rcPrerelease;
    getDescription(): Promise<string>;
    perform(): Promise<void>;
    /** Computes the new version for the release-train being branched-off. */
    private _computeNewVersion;
    /** Gets the release notes compare version for the branching-off release. */
    private _computeReleaseNoteCompareVersion;
    /** Creates a new version branch from the next branch. */
    private _createNewVersionBranchFromNext;
    /**
     * Creates a pull request for the next branch that bumps the version to the next
     * minor, and cherry-picks the changelog for the newly branched-off release-candidate
     * or feature-freeze version.
     */
    private _createNextBranchUpdatePullRequest;
}
