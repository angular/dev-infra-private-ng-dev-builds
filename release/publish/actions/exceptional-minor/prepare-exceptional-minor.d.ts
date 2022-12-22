/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ActiveReleaseTrains } from '../../../versioning/active-release-trains.js';
import { ReleaseAction } from '../../actions.js';
/**
 * Release action for initiating an exceptional minor release-train. This
 * action is active when a new major is already in-progress but another
 * minor is suddenly needed for the previous major.
 *
 * The action will create a new branch based on the existing "latest"
 * release-train. No release will be published immediately to allow for
 * changes to be made. Once changes have been made, an exceptional minor
 * can switch into the `release-candidate` phase, and then become "latest".
 *
 * More details can be found here: http://go/angular-exceptional-minor.
 */
export declare class PrepareExceptionalMinorAction extends ReleaseAction {
    private _patch;
    private _baseBranch;
    private _patchVersion;
    private _newBranch;
    private _newVersion;
    getDescription(): Promise<string>;
    perform(): Promise<void>;
    static isActive(active: ActiveReleaseTrains): Promise<boolean>;
}
