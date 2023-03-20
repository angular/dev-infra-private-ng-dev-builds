/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Argv } from 'yargs';
/** Sets up the `github-token` command option for the given Yargs instance. */
export declare function addGithubTokenOption<T>(argv: Argv<T>): Argv<T & {
    githubToken: void;
}>;
/**
 * If the github token is able to be determined, either by being provided as a parameter or being
 * present in the environment, it is used to set the configuration for the AuthenticatedGitClient.
 * Otherwise, an error is thrown.
 *
 * We explicitly return void for this function to allow this function to be used as a `coerce`
 * function for yargs. This allows for the option, `github-token` to be available for users without
 * including it in the generated types for the `Argv` object on a command, helping us to enforce
 * that the token should only be accessed from the AuthenticatedGitClient itself.
 */
export declare function configureGitClientWithTokenOrFromEnvironment(token: string | undefined): void;
