/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Buildifier } from './buildifier.js';
import { Prettier } from './prettier.js';
/**
 * Get all defined formatters which are active based on the current loaded config.
 */
export declare function getActiveFormatters(): Promise<(Buildifier | Prettier)[]>;
export { Formatter, type FormatterAction } from './base-formatter.js';
