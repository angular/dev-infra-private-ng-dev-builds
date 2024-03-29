/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { GithubConfig, CaretakerConfig } from '../../utils/config.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
/** The BaseModule to extend modules for caretaker checks from. */
export declare abstract class BaseModule<Data> {
    protected git: AuthenticatedGitClient;
    protected config: {
        caretaker: CaretakerConfig;
        github: GithubConfig;
    };
    /** The data for the module. */
    readonly data: Promise<Data>;
    constructor(git: AuthenticatedGitClient, config: {
        caretaker: CaretakerConfig;
        github: GithubConfig;
    });
    /** Asynchronously retrieve data for the module. */
    protected abstract retrieveData(): Promise<Data>;
    /** Print the information discovered for the module to the terminal. */
    abstract printToTerminal(): Promise<void>;
}
