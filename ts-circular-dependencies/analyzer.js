/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import ts from 'typescript';
import { getFileStatus } from './file_system.js';
import { getModuleReferences } from './parser.js';
/** Default extensions that the analyzer uses for resolving imports. */
const DEFAULT_EXTENSIONS = ['ts', 'js', 'd.ts'];
/**
 * Analyzer that can be used to detect import cycles within source files. It supports
 * custom module resolution, source file caching and collects unresolved specifiers.
 */
export class Analyzer {
    constructor(resolveModuleFn, ignoreTypeOnlyChecks = false, extensions = DEFAULT_EXTENSIONS) {
        this.resolveModuleFn = resolveModuleFn;
        this.extensions = extensions;
        this._sourceFileCache = new Map();
        this.unresolvedModules = new Set();
        this.unresolvedFiles = new Map();
        this._ignoreTypeOnlyChecks = !!ignoreTypeOnlyChecks;
    }
    /** Finds all cycles in the specified source file. */
    findCycles(sf, visited = new WeakSet(), path = []) {
        const previousIndex = path.indexOf(sf);
        // If the given node is already part of the current path, then a cycle has
        // been found. Add the reference chain which represents the cycle to the results.
        if (previousIndex !== -1) {
            return [path.slice(previousIndex)];
        }
        // If the node has already been visited, then it's not necessary to go check its edges
        // again. Cycles would have been already detected and collected in the first check.
        if (visited.has(sf)) {
            return [];
        }
        path.push(sf);
        visited.add(sf);
        // Go through all edges, which are determined through import/exports, and collect cycles.
        const result = [];
        for (const ref of getModuleReferences(sf, this._ignoreTypeOnlyChecks)) {
            const targetFile = this._resolveImport(ref, sf.fileName);
            if (targetFile !== null) {
                result.push(...this.findCycles(this.getSourceFile(targetFile), visited, path.slice()));
            }
        }
        return result;
    }
    /** Gets the TypeScript source file of the specified path. */
    getSourceFile(filePath) {
        const resolvedPath = resolve(filePath);
        if (this._sourceFileCache.has(resolvedPath)) {
            return this._sourceFileCache.get(resolvedPath);
        }
        const fileContent = readFileSync(resolvedPath, 'utf8');
        const sourceFile = ts.createSourceFile(resolvedPath, fileContent, ts.ScriptTarget.Latest, false);
        this._sourceFileCache.set(resolvedPath, sourceFile);
        return sourceFile;
    }
    /** Resolves the given import specifier with respect to the specified containing file path. */
    _resolveImport(specifier, containingFilePath) {
        if (specifier.charAt(0) === '.') {
            const resolvedPath = this._resolveFileSpecifier(specifier, containingFilePath);
            if (resolvedPath === null) {
                this._trackUnresolvedFileImport(specifier, containingFilePath);
            }
            return resolvedPath;
        }
        if (this.resolveModuleFn) {
            const targetFile = this.resolveModuleFn(specifier);
            if (targetFile !== null) {
                const resolvedPath = this._resolveFileSpecifier(targetFile);
                if (resolvedPath !== null) {
                    return resolvedPath;
                }
            }
        }
        this.unresolvedModules.add(specifier);
        return null;
    }
    /** Tracks the given file import as unresolved. */
    _trackUnresolvedFileImport(specifier, originFilePath) {
        if (!this.unresolvedFiles.has(originFilePath)) {
            this.unresolvedFiles.set(originFilePath, [specifier]);
        }
        this.unresolvedFiles.get(originFilePath).push(specifier);
    }
    /** Resolves the given import specifier to the corresponding source file. */
    _resolveFileSpecifier(specifier, containingFilePath) {
        const importFullPath = containingFilePath !== undefined ? join(dirname(containingFilePath), specifier) : specifier;
        const stat = getFileStatus(importFullPath);
        if (stat && stat.isFile()) {
            return importFullPath;
        }
        for (const extension of this.extensions) {
            const pathWithExtension = `${importFullPath}.${extension}`;
            const withExtensionStat = getFileStatus(pathWithExtension);
            if (withExtensionStat?.isFile()) {
                return pathWithExtension;
            }
        }
        // Directories should be considered last. TypeScript first looks for source files, then
        // falls back to directories if no file with appropriate extension could be found.
        if (stat && stat.isDirectory()) {
            return this._resolveFileSpecifier(join(importFullPath, 'index'));
        }
        return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5hbHl6ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9uZy1kZXYvdHMtY2lyY3VsYXItZGVwZW5kZW5jaWVzL2FuYWx5emVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxJQUFJLENBQUM7QUFDaEMsT0FBTyxFQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFDLE1BQU0sTUFBTSxDQUFDO0FBQzVDLE9BQU8sRUFBRSxNQUFNLFlBQVksQ0FBQztBQUc1QixPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sa0JBQWtCLENBQUM7QUFDL0MsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sYUFBYSxDQUFDO0FBV2hELHVFQUF1RTtBQUN2RSxNQUFNLGtCQUFrQixHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztBQUVoRDs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sUUFBUTtJQVFuQixZQUNTLGVBQWdDLEVBQ3ZDLHVCQUFnQyxLQUFLLEVBQzlCLGFBQXVCLGtCQUFrQjtRQUZ6QyxvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUFFaEMsZUFBVSxHQUFWLFVBQVUsQ0FBK0I7UUFWMUMscUJBQWdCLEdBQUcsSUFBSSxHQUFHLEVBQXlCLENBQUM7UUFJNUQsc0JBQWlCLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUN0QyxvQkFBZSxHQUFHLElBQUksR0FBRyxFQUFvQixDQUFDO1FBTzVDLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxDQUFDLENBQUMsb0JBQW9CLENBQUM7SUFDdEQsQ0FBQztJQUVELHFEQUFxRDtJQUNyRCxVQUFVLENBQ1IsRUFBaUIsRUFDakIsVUFBVSxJQUFJLE9BQU8sRUFBaUIsRUFDdEMsT0FBdUIsRUFBRTtRQUV6QixNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FB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LENBQUM7UUFDSCxDQUFDO1FBQ0QsdUZBQXVGO1FBQ3ZGLGtGQUFrRjtRQUNsRixJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQztZQUMvQixPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDbkUsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7cmVhZEZpbGVTeW5jfSBmcm9tICdmcyc7XG5pbXBvcnQge2Rpcm5hbWUsIGpvaW4sIHJlc29sdmV9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtDaXJjdWxhckRlcGVuZGVuY2llc1BhcnNlck9wdGlvbnN9IGZyb20gJy4vY29uZmlnLmpzJztcblxuaW1wb3J0IHtnZXRGaWxlU3RhdHVzfSBmcm9tICcuL2ZpbGVfc3lzdGVtLmpzJztcbmltcG9ydCB7Z2V0TW9kdWxlUmVmZXJlbmNlc30gZnJvbSAnLi9wYXJzZXIuanMnO1xuXG5leHBvcnQgdHlwZSBNb2R1bGVSZXNvbHZlciA9IChzcGVjaWZpZXI6IHN0cmluZykgPT4gc3RyaW5nIHwgbnVsbDtcblxuLyoqXG4gKiBSZWZlcmVuY2UgY2hhaW5zIGRlc2NyaWJlIGEgc2VxdWVuY2Ugb2Ygc291cmNlIGZpbGVzIHdoaWNoIGFyZSBjb25uZWN0ZWQgdGhyb3VnaCBpbXBvcnRzLlxuICogZS5nLiBgZmlsZV9hLnRzYCBpbXBvcnRzIGBmaWxlX2IudHNgLCB3aGVyZWFzIGBmaWxlX2IudHNgIGltcG9ydHMgYGZpbGVfYy50c2AuIFRoZSByZWZlcmVuY2VcbiAqIGNoYWluIGRhdGEgc3RydWN0dXJlIGNvdWxkIGJlIHVzZWQgdG8gcmVwcmVzZW50IHRoaXMgaW1wb3J0IHNlcXVlbmNlLlxuICovXG5leHBvcnQgdHlwZSBSZWZlcmVuY2VDaGFpbjxUID0gdHMuU291cmNlRmlsZT4gPSBUW107XG5cbi8qKiBEZWZhdWx0IGV4dGVuc2lvbnMgdGhhdCB0aGUgYW5hbHl6ZXIgdXNlcyBmb3IgcmVzb2x2aW5nIGltcG9ydHMuICovXG5jb25zdCBERUZBVUxUX0VYVEVOU0lPTlMgPSBbJ3RzJywgJ2pzJywgJ2QudHMnXTtcblxuLyoqXG4gKiBBbmFseXplciB0aGF0IGNhbiBiZSB1c2VkIHRvIGRldGVjdCBpbXBvcnQgY3ljbGVzIHdpdGhpbiBzb3VyY2UgZmlsZXMuIEl0IHN1cHBvcnRzXG4gKiBjdXN0b20gbW9kdWxlIHJlc29sdXRpb24sIHNvdXJjZSBmaWxlIGNhY2hpbmcgYW5kIGNvbGxlY3RzIHVucmVzb2x2ZWQgc3BlY2lmaWVycy5cbiAqL1xuZXhwb3J0IGNsYXNzIEFuYWx5emVyIHtcbiAgcHJpdmF0ZSBfc291cmNlRmlsZUNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHRzLlNvdXJjZUZpbGU+KCk7XG5cbiAgcHJpdmF0ZSBfaWdub3JlVHlwZU9ubHlDaGVja3M6IGJvb2xlYW47XG5cbiAgdW5yZXNvbHZlZE1vZHVsZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgdW5yZXNvbHZlZEZpbGVzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZ1tdPigpO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyByZXNvbHZlTW9kdWxlRm4/OiBNb2R1bGVSZXNvbHZlcixcbiAgICBpZ25vcmVUeXBlT25seUNoZWNrczogYm9vbGVhbiA9IGZhbHNlLFxuICAgIHB1YmxpYyBleHRlbnNpb25zOiBzdHJpbmdbXSA9IERFRkFVTFRfRVhURU5TSU9OUyxcbiAgKSB7XG4gICAgdGhpcy5faWdub3JlVHlwZU9ubHlDaGVja3MgPSAhIWlnbm9yZVR5cGVPbmx5Q2hlY2tzO1xuICB9XG5cbiAgLyoqIEZpbmRzIGFsbCBjeWNsZXMgaW4gdGhlIHNwZWNpZmllZCBzb3VyY2UgZmlsZS4gKi9cbiAgZmluZEN5Y2xlcyhcbiAgICBzZjogdHMuU291cmNlRmlsZSxcbiAgICB2aXNpdGVkID0gbmV3IFdlYWtTZXQ8dHMuU291cmNlRmlsZT4oKSxcbiAgICBwYXRoOiBSZWZlcmVuY2VDaGFpbiA9IFtdLFxuICApOiBSZWZlcmVuY2VDaGFpbltdIHtcbiAgICBjb25zdCBwcmV2aW91c0luZGV4ID0gcGF0aC5pbmRleE9mKHNmKTtcbiAgICAvLyBJZiB0aGUgZ2l2ZW4gbm9kZSBpcyBhbHJlYWR5IHBhcnQgb2YgdGhlIGN1cnJlbnQgcGF0aCwgdGhlbiBhIGN5Y2xlIGhhc1xuICAgIC8vIGJlZW4gZm91bmQuIEFkZCB0aGUgcmVmZXJlbmNlIGNoYWluIHdoaWNoIHJlcHJlc2VudHMgdGhlIGN5Y2xlIHRvIHRoZSByZXN1bHRzLlxuICAgIGlmIChwcmV2aW91c0luZGV4ICE9PSAtMSkge1xuICAgICAgcmV0dXJuIFtwYXRoLnNsaWNlKHByZXZpb3VzSW5kZXgpXTtcbiAgICB9XG4gICAgLy8gSWYgdGhlIG5vZGUgaGFzIGFscmVhZHkgYmVlbiB2aXNpdGVkLCB0aGVuIGl0J3Mgbm90IG5lY2Vzc2FyeSB0byBnbyBjaGVjayBpdHMgZWRnZXNcbiAgICAvLyBhZ2Fpbi4gQ3ljbGVzIHdvdWxkIGhhdmUgYmVlbiBhbHJlYWR5IGRldGVjdGVkIGFuZCBjb2xsZWN0ZWQgaW4gdGhlIGZpcnN0IGNoZWNrLlxuICAgIGlmICh2aXNpdGVkLmhhcyhzZikpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgcGF0aC5wdXNoKHNmKTtcbiAgICB2aXNpdGVkLmFkZChzZik7XG4gICAgLy8gR28gdGhyb3VnaCBhbGwgZWRnZXMsIHdoaWNoIGFyZSBkZXRlcm1pbmVkIHRocm91Z2ggaW1wb3J0L2V4cG9ydHMsIGFuZCBjb2xsZWN0IGN5Y2xlcy5cbiAgICBjb25zdCByZXN1bHQ6IFJlZmVyZW5jZUNoYWluW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IHJlZiBvZiBnZXRNb2R1bGVSZWZlcmVuY2VzKHNmLCB0aGlzLl9pZ25vcmVUeXBlT25seUNoZWNrcykpIHtcbiAgICAgIGNvbnN0IHRhcmdldEZpbGUgPSB0aGlzLl9yZXNvbHZlSW1wb3J0KHJlZiwgc2YuZmlsZU5hbWUpO1xuICAgICAgaWYgKHRhcmdldEZpbGUgIT09IG51bGwpIHtcbiAgICAgICAgcmVzdWx0LnB1c2goLi4udGhpcy5maW5kQ3ljbGVzKHRoaXMuZ2V0U291cmNlRmlsZSh0YXJnZXRGaWxlKSwgdmlzaXRlZCwgcGF0aC5zbGljZSgpKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKiogR2V0cyB0aGUgVHlwZVNjcmlwdCBzb3VyY2UgZmlsZSBvZiB0aGUgc3BlY2lmaWVkIHBhdGguICovXG4gIGdldFNvdXJjZUZpbGUoZmlsZVBhdGg6IHN0cmluZyk6IHRzLlNvdXJjZUZpbGUge1xuICAgIGNvbnN0IHJlc29sdmVkUGF0aCA9IHJlc29sdmUoZmlsZVBhdGgpO1xuICAgIGlmICh0aGlzLl9zb3VyY2VGaWxlQ2FjaGUuaGFzKHJlc29sdmVkUGF0aCkpIHtcbiAgICAgIHJldHVybiB0aGlzLl9zb3VyY2VGaWxlQ2FjaGUuZ2V0KHJlc29sdmVkUGF0aCkhO1xuICAgIH1cbiAgICBjb25zdCBmaWxlQ29udGVudCA9IHJlYWRGaWxlU3luYyhyZXNvbHZlZFBhdGgsICd1dGY4Jyk7XG4gICAgY29uc3Qgc291cmNlRmlsZSA9IHRzLmNyZWF0ZVNvdXJjZUZpbGUoXG4gICAgICByZXNvbHZlZFBhdGgsXG4gICAgICBmaWxlQ29udGVudCxcbiAgICAgIHRzLlNjcmlwdFRhcmdldC5MYXRlc3QsXG4gICAgICBmYWxzZSxcbiAgICApO1xuICAgIHRoaXMuX3NvdXJjZUZpbGVDYWNoZS5zZXQocmVzb2x2ZWRQYXRoLCBzb3VyY2VGaWxlKTtcbiAgICByZXR1cm4gc291cmNlRmlsZTtcbiAgfVxuXG4gIC8qKiBSZXNvbHZlcyB0aGUgZ2l2ZW4gaW1wb3J0IHNwZWNpZmllciB3aXRoIHJlc3BlY3QgdG8gdGhlIHNwZWNpZmllZCBjb250YWluaW5nIGZpbGUgcGF0aC4gKi9cbiAgcHJpdmF0ZSBfcmVzb2x2ZUltcG9ydChzcGVjaWZpZXI6IHN0cmluZywgY29udGFpbmluZ0ZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBpZiAoc3BlY2lmaWVyLmNoYXJBdCgwKSA9PT0gJy4nKSB7XG4gICAgICBjb25zdCByZXNvbHZlZFBhdGggPSB0aGlzLl9yZXNvbHZlRmlsZVNwZWNpZmllcihzcGVjaWZpZXIsIGNvbnRhaW5pbmdGaWxlUGF0aCk7XG4gICAgICBpZiAocmVzb2x2ZWRQYXRoID09PSBudWxsKSB7XG4gICAgICAgIHRoaXMuX3RyYWNrVW5yZXNvbHZlZEZpbGVJbXBvcnQoc3BlY2lmaWVyLCBjb250YWluaW5nRmlsZVBhdGgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc29sdmVkUGF0aDtcbiAgICB9XG4gICAgaWYgKHRoaXMucmVzb2x2ZU1vZHVsZUZuKSB7XG4gICAgICBjb25zdCB0YXJnZXRGaWxlID0gdGhpcy5yZXNvbHZlTW9kdWxlRm4oc3BlY2lmaWVyKTtcbiAgICAgIGlmICh0YXJnZXRGaWxlICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IHJlc29sdmVkUGF0aCA9IHRoaXMuX3Jlc29sdmVGaWxlU3BlY2lmaWVyKHRhcmdldEZpbGUpO1xuICAgICAgICBpZiAocmVzb2x2ZWRQYXRoICE9PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmVkUGF0aDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnVucmVzb2x2ZWRNb2R1bGVzLmFkZChzcGVjaWZpZXIpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqIFRyYWNrcyB0aGUgZ2l2ZW4gZmlsZSBpbXBvcnQgYXMgdW5yZXNvbHZlZC4gKi9cbiAgcHJpdmF0ZSBfdHJhY2tVbnJlc29sdmVkRmlsZUltcG9ydChzcGVjaWZpZXI6IHN0cmluZywgb3JpZ2luRmlsZVBhdGg6IHN0cmluZykge1xuICAgIGlmICghdGhpcy51bnJlc29sdmVkRmlsZXMuaGFzKG9yaWdpbkZpbGVQYXRoKSkge1xuICAgICAgdGhpcy51bnJlc29sdmVkRmlsZXMuc2V0KG9yaWdpbkZpbGVQYXRoLCBbc3BlY2lmaWVyXSk7XG4gICAgfVxuICAgIHRoaXMudW5yZXNvbHZlZEZpbGVzLmdldChvcmlnaW5GaWxlUGF0aCkhLnB1c2goc3BlY2lmaWVyKTtcbiAgfVxuXG4gIC8qKiBSZXNvbHZlcyB0aGUgZ2l2ZW4gaW1wb3J0IHNwZWNpZmllciB0byB0aGUgY29ycmVzcG9uZGluZyBzb3VyY2UgZmlsZS4gKi9cbiAgcHJpdmF0ZSBfcmVzb2x2ZUZpbGVTcGVjaWZpZXIoc3BlY2lmaWVyOiBzdHJpbmcsIGNvbnRhaW5pbmdGaWxlUGF0aD86IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGNvbnN0IGltcG9ydEZ1bGxQYXRoID1cbiAgICAgIGNvbnRhaW5pbmdGaWxlUGF0aCAhPT0gdW5kZWZpbmVkID8gam9pbihkaXJuYW1lKGNvbnRhaW5pbmdGaWxlUGF0aCksIHNwZWNpZmllcikgOiBzcGVjaWZpZXI7XG4gICAgY29uc3Qgc3RhdCA9IGdldEZpbGVTdGF0dXMoaW1wb3J0RnVsbFBhdGgpO1xuICAgIGlmIChzdGF0ICYmIHN0YXQuaXNGaWxlKCkpIHtcbiAgICAgIHJldHVybiBpbXBvcnRGdWxsUGF0aDtcbiAgICB9XG4gICAgZm9yIChjb25zdCBleHRlbnNpb24gb2YgdGhpcy5leHRlbnNpb25zKSB7XG4gICAgICBjb25zdCBwYXRoV2l0aEV4dGVuc2lvbiA9IGAke2ltcG9ydEZ1bGxQYXRofS4ke2V4dGVuc2lvbn1gO1xuICAgICAgY29uc3Qgd2l0aEV4dGVuc2lvblN0YXQgPSBnZXRGaWxlU3RhdHVzKHBhdGhXaXRoRXh0ZW5zaW9uKTtcbiAgICAgIGlmICh3aXRoRXh0ZW5zaW9uU3RhdD8uaXNGaWxlKCkpIHtcbiAgICAgICAgcmV0dXJuIHBhdGhXaXRoRXh0ZW5zaW9uO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBEaXJlY3RvcmllcyBzaG91bGQgYmUgY29uc2lkZXJlZCBsYXN0LiBUeXBlU2NyaXB0IGZpcnN0IGxvb2tzIGZvciBzb3VyY2UgZmlsZXMsIHRoZW5cbiAgICAvLyBmYWxscyBiYWNrIHRvIGRpcmVjdG9yaWVzIGlmIG5vIGZpbGUgd2l0aCBhcHByb3ByaWF0ZSBleHRlbnNpb24gY291bGQgYmUgZm91bmQuXG4gICAgaWYgKHN0YXQgJiYgc3RhdC5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcmVzb2x2ZUZpbGVTcGVjaWZpZXIoam9pbihpbXBvcnRGdWxsUGF0aCwgJ2luZGV4JykpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuIl19