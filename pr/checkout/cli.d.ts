/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { CommandModule } from 'yargs';
import { CheckoutPullRequestParams } from './checkout.js';
/** yargs command module for checking out a PR  */
export declare const CheckoutCommandModule: CommandModule<{}, CheckoutPullRequestParams>;
