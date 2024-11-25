/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CommandModule } from 'yargs';
interface WorkflowsParams {
    configFile: string;
    list: boolean;
    name?: string;
    commitSha?: string;
}
/** yargs command module for checking out a PR. */
export declare const WorkflowsModule: CommandModule<{}, WorkflowsParams>;
export {};
