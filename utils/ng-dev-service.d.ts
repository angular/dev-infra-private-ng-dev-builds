/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Argv } from 'yargs';
/**
 * Sets up middleware to ensure that configuration and setup is completed for commands which
 *  require the ng-dev service
 */
export declare function canUseNgDevService<T extends {}>(argv: Argv<T>, isAuthCommand: true): Argv<T & {
    useAuthService: boolean;
}>;
export declare function canUseNgDevService<T extends {
    githubToken: string | null;
}>(argv: Argv<T>): Argv<T & {
    useAuthService: boolean;
}>;
