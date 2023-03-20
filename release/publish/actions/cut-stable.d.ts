/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ActiveReleaseTrains } from '../../versioning/active-release-trains.js';
import { ReleaseAction } from '../actions.js';
/**
 * Release action that cuts a stable version for the current release-train
 * in the "release-candidate" phase.
 *
 * There are only two possible release-trains that can ever be in the RC phase.
 * This is either an exceptional-minor or the dedicated FF/RC release-train.
 */
export declare class CutStableAction extends ReleaseAction {
    private _train;
    private _branch;
    private _newVersion;
    private _isNewMajor;
    getDescription(): Promise<string>;
    perform(): Promise<void>;
    private _getNpmDistTag;
    /** Gets the new stable version of the given release-train. */
    private _computeNewVersion;
    static isActive(active: ActiveReleaseTrains): Promise<boolean>;
}
