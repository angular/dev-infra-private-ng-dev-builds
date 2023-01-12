/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CommandModule } from 'yargs';
import { EnvStampMode } from './env-stamp.js';
/**
 * Type describing a custom stamping function that
 * can be exposed through the `--additional-stamping-script`.
 */
export type EnvStampCustomPrintFn = (mode: EnvStampMode) => Promise<void>;
export interface Options {
    mode: EnvStampMode;
    includeVersion: boolean;
    additionalStampingScript: string | undefined;
}
/** CLI command module for building the environment stamp. */
export declare const BuildEnvStampCommand: CommandModule<{}, Options>;
