/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Argv } from 'yargs';
import { CircularDependenciesTestConfig } from './config.js';
export declare function tsCircularDependenciesBuilder(localYargs: Argv): Argv<{
    config: string;
} & {
    warnings: boolean | undefined;
}>;
/**
 * Runs the ts-circular-dependencies tool.
 * @param approve Whether the detected circular dependencies should be approved.
 * @param config Configuration for the current circular dependencies test.
 * @param printWarnings Whether warnings should be printed out.
 * @returns Status code.
 */
export declare function main(approve: boolean, config: CircularDependenciesTestConfig, printWarnings: boolean): number;
