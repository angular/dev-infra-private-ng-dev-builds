/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CommandModule } from 'yargs';
/** The options available to the merge command via CLI. */
export interface MergeCommandOptions {
    pr: number;
    branchPrompt: boolean;
    forceManualBranches: boolean;
    dryRun: boolean;
}
/** yargs command module describing the command. */
export declare const MergeCommandModule: CommandModule<{}, MergeCommandOptions>;
