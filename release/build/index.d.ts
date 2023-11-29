/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BuiltPackage } from '../config/index.js';
/** Build all of the releasable targets in the repository */
export declare function buildAllTargets(): Promise<BuiltPackage[]>;
