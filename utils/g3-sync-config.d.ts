export interface GoogleSyncConfig {
    syncedFilePatterns: string[];
    alwaysExternalFilePatterns: string[];
    separateFilePatterns: string[];
}
export type SyncFileMatchFn = (projectRelativePath: string) => boolean;
export declare class InvalidGoogleSyncConfigError extends Error {
}
export declare function transformConfigIntoMatcher(config: GoogleSyncConfig): {
    ngSyncMatchFn: SyncFileMatchFn;
    separateSyncMatchFn: SyncFileMatchFn;
};
export declare function getGoogleSyncConfig(absolutePath: string): Promise<{
    ngMatchFn: SyncFileMatchFn;
    separateMatchFn: SyncFileMatchFn;
    config: GoogleSyncConfig;
}>;
