/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ActiveReleaseTrains } from '../../versioning/active-release-trains.js';
import { ReleaseAction } from '../actions.js';
import { ReleaseConfig } from '../../config/index.js';
/**
 * Release action that configures the active next release-train to be for a major
 * version. This means that major changes can land in the next branch.
 */
export declare class ConfigureNextAsMajorAction extends ReleaseAction {
    private _newVersion;
    getDescription(): Promise<string>;
    perform(): Promise<void>;
    static isActive(active: ActiveReleaseTrains, config: ReleaseConfig): Promise<boolean>;
}
