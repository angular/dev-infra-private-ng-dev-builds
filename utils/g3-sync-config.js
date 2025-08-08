import { Minimatch } from 'minimatch';
import fs from 'fs';
import * as jsonc from 'jsonc-parser';
export class InvalidGoogleSyncConfigError extends Error {
}
export function transformConfigIntoMatcher(config) {
    const syncedFilePatterns = config.syncedFilePatterns.map((p) => new Minimatch(p));
    const alwaysExternalFilePatterns = config.alwaysExternalFilePatterns.map((p) => new Minimatch(p));
    const separateFilePatterns = config.separateFilePatterns.map((p) => new Minimatch(p));
    const ngSyncMatchFn = (projectRelativePath) => syncedFilePatterns.some((p) => p.match(projectRelativePath)) &&
        alwaysExternalFilePatterns.every((p) => !p.match(projectRelativePath)) &&
        separateFilePatterns.every((p) => !p.match(projectRelativePath));
    const separateSyncMatchFn = (projectRelativePath) => separateFilePatterns.some((p) => p.match(projectRelativePath)) &&
        alwaysExternalFilePatterns.every((p) => !p.match(projectRelativePath));
    return { ngSyncMatchFn, separateSyncMatchFn };
}
export async function getGoogleSyncConfig(absolutePath) {
    const content = await fs.promises.readFile(absolutePath, 'utf8');
    const errors = [];
    const config = jsonc.parse(content, errors);
    if (errors.length !== 0) {
        throw new InvalidGoogleSyncConfigError(`Google Sync Configuration is invalid: ` +
            errors.map((e) => jsonc.printParseErrorCode(e.error)).join('\n'));
    }
    const matchFns = transformConfigIntoMatcher(config);
    return {
        config,
        ngMatchFn: matchFns.ngSyncMatchFn,
        separateMatchFn: matchFns.separateSyncMatchFn,
    };
}
//# sourceMappingURL=g3-sync-config.js.map