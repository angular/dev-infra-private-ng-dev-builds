import { readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import ts from 'typescript';
import { getFileStatus } from './file_system.js';
import { getModuleReferences } from './parser.js';
const DEFAULT_EXTENSIONS = ['ts', 'js', 'd.ts'];
export class Analyzer {
    constructor(resolveModuleFn, ignoreTypeOnlyChecks = false, extensions = DEFAULT_EXTENSIONS) {
        this.resolveModuleFn = resolveModuleFn;
        this.extensions = extensions;
        this._sourceFileCache = new Map();
        this.unresolvedModules = new Set();
        this.unresolvedFiles = new Map();
        this._ignoreTypeOnlyChecks = !!ignoreTypeOnlyChecks;
    }
    findCycles(sf, visited = new WeakSet(), path = []) {
        const previousIndex = path.indexOf(sf);
        if (previousIndex !== -1) {
            return [path.slice(previousIndex)];
        }
        if (visited.has(sf)) {
            return [];
        }
        path.push(sf);
        visited.add(sf);
        const result = [];
        for (const ref of getModuleReferences(sf, this._ignoreTypeOnlyChecks)) {
            const targetFile = this._resolveImport(ref, sf.fileName);
            if (targetFile !== null) {
                result.push(...this.findCycles(this.getSourceFile(targetFile), visited, path.slice()));
            }
        }
        return result;
    }
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
    _trackUnresolvedFileImport(specifier, originFilePath) {
        if (!this.unresolvedFiles.has(originFilePath)) {
            this.unresolvedFiles.set(originFilePath, [specifier]);
        }
        this.unresolvedFiles.get(originFilePath).push(specifier);
    }
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
        if (stat && stat.isDirectory()) {
            return this._resolveFileSpecifier(join(importFullPath, 'index'));
        }
        return null;
    }
}
//# sourceMappingURL=analyzer.js.map