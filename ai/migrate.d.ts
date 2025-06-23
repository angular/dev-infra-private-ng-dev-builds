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
    /** Prompt that should be applied. */
    prompt: string;
    /** Glob of files that the prompt should apply to. */
    files: string;
    /** Model that should be used to apply the prompt. */
    model: string;
    /** Temperature for the model. */
    temperature: number;
    /** Maximum number of concurrent API requests. */
    maxConcurrency: number;
    /** API key to use when making requests. */
    apiKey?: string;
}
/** CLI command module. */
export declare const MigrateModule: CommandModule<{}, Options>;
