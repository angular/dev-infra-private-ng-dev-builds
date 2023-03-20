/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ActiveReleaseTrains } from '../../../versioning/active-release-trains.js';
import { ReleaseAction } from '../../actions.js';
/**
 * SPECIAL: Action should only be used by dev-infra members.
 *
 * Release action that cuts a new minor for an LTS major. The new LTS
 * minor branch is required to be created beforehand.
 */
export declare class SpecialCutLongTermSupportMinorAction extends ReleaseAction {
    getDescription(): Promise<string>;
    perform(): Promise<void>;
    private _askForVersionBranch;
    static isActive(_active: ActiveReleaseTrains): Promise<boolean>;
}
