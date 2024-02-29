/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/** Configuration describing how files are synced into Google. */
export interface GoogleSyncConfig {
    /**
     * Patterns matching files which are synced into Google. Patterns
     * should be relative to the project directory.
     */
    syncedFilePatterns: string[];
    /**
     * Patterns matching files which are never synced into Google. Patterns
     * should be relative to the project directory.
     */
    alwaysExternalFilePatterns: string[];
    /**
     * Patterns matching files which need to be synced separately.
     * Patterns should be relative to the project directory.
     */
    separateFilePatterns: string[];
}
/** Describes a function for testing if a file is synced. */
export type SyncFileMatchFn = (projectRelativePath: string) => boolean;
/** Error class used when the Google Sync configuration is invalid. */
export declare class InvalidGoogleSyncConfigError extends Error {
}
/** Transforms the given sync configuration into a file match function. */
export declare function transformConfigIntoMatcher(config: GoogleSyncConfig): {
    ngSyncMatchFn: SyncFileMatchFn;
    separateSyncMatchFn: SyncFileMatchFn;
};
/**
 * Reads the configuration file from the given path.
 *
 * @throws {InvalidGoogleSyncConfigError} If the configuration is invalid.
 */
export declare function getGoogleSyncConfig(absolutePath: string): Promise<{
    ngMatchFn: SyncFileMatchFn;
    separateMatchFn: SyncFileMatchFn;
    config: GoogleSyncConfig;
}>;
