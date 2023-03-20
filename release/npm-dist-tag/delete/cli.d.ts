/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CommandModule } from 'yargs';
/** Command line options for deleting a NPM dist tag. */
export interface ReleaseNpmDistTagDeleteOptions {
    tagName: string;
}
/** CLI command module for deleting an NPM dist tag. */
export declare const ReleaseNpmDistTagDeleteCommand: CommandModule<{}, ReleaseNpmDistTagDeleteOptions>;
