/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CommandModule } from 'yargs';
export interface CheckTargetBranchesOptions {
    pr: number;
}
/** yargs command module describing the command.  */
export declare const CheckTargetBranchesModule: CommandModule<{}, CheckTargetBranchesOptions>;
