/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CommandModule } from 'yargs';
/** Command line options for setting an NPM dist tag. */
export interface ReleaseNpmDistTagSetOptions {
    tagName: string;
    targetVersion: string;
    skipExperimentalPackages: boolean;
}
/** CLI command module for setting an NPM dist tag. */
export declare const ReleaseNpmDistTagSetCommand: CommandModule<{}, ReleaseNpmDistTagSetOptions>;
