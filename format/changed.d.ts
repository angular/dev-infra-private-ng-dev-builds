/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CommandModule } from 'yargs';
/** Command line options. */
export interface Options {
    shaOrRef?: string;
    check: boolean;
}
/** CLI command module. */
export declare const ChangedModule: CommandModule<{}, Options>;
