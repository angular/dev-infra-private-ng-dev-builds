/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * A set of prompts from inquirer to be used throughout our tooling.  We access them via static metonds on this
 * class to allow easier mocking management in test environments.
 */
export declare abstract class Prompt {
    static confirm: import("@inquirer/type/dist/cjs/types").Prompt<boolean, {
        message: string;
        default?: boolean;
        transformer?: (value: boolean) => string;
        theme?: import("@inquirer/type/dist/cjs/types").PartialDeep<import("@inquirer/core/dist/cjs/types").Theme>;
    }>;
    static input: import("@inquirer/type/dist/cjs/types").Prompt<string, {
        message: string;
        default?: string;
        required?: boolean;
        transformer?: (value: string, { isFinal }: {
            isFinal: boolean;
        }) => string;
        validate?: (value: string) => boolean | string | Promise<string | boolean>;
        theme?: import("@inquirer/type/dist/cjs/types").PartialDeep<import("@inquirer/core/dist/cjs/types").Theme>;
    }>;
    static checkbox: <Value>(config: {
        message: string;
        prefix?: string;
        pageSize?: number;
        instructions?: string | boolean;
        choices: readonly (import("@inquirer/prompts").Separator | {
            name?: string;
            value: Value;
            short?: string;
            disabled?: boolean | string;
            checked?: boolean;
            type?: never;
        })[];
        loop?: boolean;
        required?: boolean;
        validate?: ((choices: readonly {
            name?: string;
            value: Value;
            short?: string;
            disabled?: boolean | string;
            checked?: boolean;
            type?: never;
        }[]) => boolean | string | Promise<string | boolean>) | undefined;
        theme?: import("@inquirer/type/dist/cjs/types").PartialDeep<import("@inquirer/core/dist/cjs/types").Theme<{
            icon: {
                checked: string;
                unchecked: string;
                cursor: string;
            };
            style: {
                disabledChoice: (text: string) => string;
                renderSelectedChoices: <T>(selectedChoices: ReadonlyArray<{
                    name?: string;
                    value: T;
                    short?: string;
                    disabled?: boolean | string;
                    checked?: boolean;
                    type?: never;
                }>, allChoices: ReadonlyArray<{
                    name?: string;
                    value: T;
                    short?: string;
                    disabled?: boolean | string;
                    checked?: boolean;
                    type?: never;
                } | import("@inquirer/prompts").Separator>) => string;
            };
            helpMode: "always" | "never" | "auto";
        }>>;
    }, context?: import("@inquirer/type/dist/cjs/types").Context) => import("@inquirer/type/dist/cjs/types").CancelablePromise<Value[]>;
    static select: <Value>(config: {
        message: string;
        choices: readonly (import("@inquirer/prompts").Separator | {
            value: Value;
            name?: string;
            description?: string;
            short?: string;
            disabled?: boolean | string;
            type?: never;
        })[];
        pageSize?: number;
        loop?: boolean;
        default?: unknown;
        theme?: import("@inquirer/type/dist/cjs/types").PartialDeep<import("@inquirer/core/dist/cjs/types").Theme<{
            icon: {
                cursor: string;
            };
            style: {
                disabled: (text: string) => string;
                description: (text: string) => string;
            };
            helpMode: "always" | "never" | "auto";
        }>>;
    }, context?: import("@inquirer/type/dist/cjs/types").Context) => import("@inquirer/type/dist/cjs/types").CancelablePromise<Value>;
    static editor: import("@inquirer/type/dist/cjs/types").Prompt<string, {
        message: string;
        default?: string;
        postfix?: string;
        waitForUseInput?: boolean;
        validate?: (value: string) => boolean | string | Promise<string | boolean>;
        theme?: import("@inquirer/type/dist/cjs/types").PartialDeep<import("@inquirer/core/dist/cjs/types").Theme>;
    }>;
}
