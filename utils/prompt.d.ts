/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { confirm, input, checkbox, select, editor } from '@inquirer/prompts';
/**
 * A set of prompts from inquirer to be used throughout our tooling.  We access them via static metonds on this
 * class to allow easier mocking management in test environments.
 */
export declare class Prompt {
    static confirm: typeof confirm;
    static input: typeof input;
    static checkbox: typeof checkbox;
    static select: typeof select;
    static editor: typeof editor;
}
