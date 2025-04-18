/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CommandModule } from 'yargs';
/** The options available to the rebase command via CLI. */
export interface RebaseOptions {
    pr: number;
    i?: boolean;
}
/** yargs command module for rebasing a PR  */
export declare const RebaseCommandModule: CommandModule<{}, RebaseOptions>;
