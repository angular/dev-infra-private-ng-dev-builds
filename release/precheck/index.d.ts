/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import yargs from 'semver';
import { BuiltPackageWithInfo, ReleaseConfig } from '../config/index.js';
/**
 * Error class that can be used to report precheck failures. Messaging with
 * respect to the pre-check error is required to be handled manually.
 */
export declare class ReleasePrecheckError extends Error {
}
/**
 * Runs the release prechecks and checks whether they are passing for the
 * specified release config, intended new version and built release packages.
 *
 * @returns A boolean that indicates whether the prechecks are passing or not.
 */
export declare function assertPassingReleasePrechecks(config: ReleaseConfig, newVersion: yargs.SemVer, builtPackagesWithInfo: BuiltPackageWithInfo[]): Promise<boolean>;
