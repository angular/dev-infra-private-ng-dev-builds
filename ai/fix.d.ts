/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CommandModule } from 'yargs';
/** Command line options. */
export interface Options {
    /** Files that the fix should apply to. */
    files: string[];
    /** Error message(s) to be resolved. */
    error: string;
    /** Model that should be used to apply the prompt. */
    model: string;
    /** Temperature for the model. */
    temperature: number;
    /** API key to use when making requests. */
    apiKey?: string;
}
/** CLI command module. */
export declare const FixModule: CommandModule<{}, Options>;
