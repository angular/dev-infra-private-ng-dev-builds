/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export type EnvStampMode = 'snapshot' | 'release';
/** Log the environment variables expected by Bazel for stamping. */
export declare function printEnvStamp(mode: EnvStampMode, includeVersion: boolean): Promise<void>;
