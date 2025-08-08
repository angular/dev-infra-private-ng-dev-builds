import { Assertions, MultipleAssertions } from './config-assertions.js';
import { setCachedConfig } from './config-cache.js';
export type NgDevConfig<T = {}> = T & {
    __isNgDevConfigObject: boolean;
};
export interface GithubConfig {
    owner: string;
    name: string;
    mainBranchName: string;
    useSsh?: boolean;
    private?: boolean;
    useNgDevAuthService?: boolean;
}
export interface GoogleSyncConfig {
    syncedFilePatterns: string[];
    alwaysExternalFilePatterns: string[];
    separateFilePatterns: string[];
}
export interface CaretakerConfig {
    githubQueries?: {
        name: string;
        query: string;
    }[];
    caretakerGroup?: string;
    g3SyncConfigPath?: string;
}
export declare const setConfig: typeof setCachedConfig;
export declare function getConfig(): Promise<NgDevConfig>;
export declare function getConfig(baseDir: string): Promise<NgDevConfig>;
export declare function getConfig<A extends MultipleAssertions>(assertions: A): Promise<NgDevConfig<Assertions<A>>>;
export declare function getUserConfig(): Promise<{
    [key: string]: any;
}>;
export declare class ConfigValidationError extends Error {
    readonly errors: string[];
    constructor(message?: string, errors?: string[]);
}
export declare function assertValidGithubConfig<T extends NgDevConfig>(config: T & Partial<{
    github: GithubConfig;
}>): asserts config is T & {
    github: GithubConfig;
};
export declare function assertValidCaretakerConfig<T extends NgDevConfig>(config: T & Partial<{
    caretaker: CaretakerConfig;
}>): asserts config is T & {
    caretaker: CaretakerConfig;
};
