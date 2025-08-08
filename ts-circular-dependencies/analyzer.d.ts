import ts from 'typescript';
export type ModuleResolver = (specifier: string) => string | null;
export type ReferenceChain<T = ts.SourceFile> = T[];
export declare class Analyzer {
    resolveModuleFn?: ModuleResolver | undefined;
    extensions: string[];
    private _sourceFileCache;
    private _ignoreTypeOnlyChecks;
    unresolvedModules: Set<string>;
    unresolvedFiles: Map<string, string[]>;
    constructor(resolveModuleFn?: ModuleResolver | undefined, ignoreTypeOnlyChecks?: boolean, extensions?: string[]);
    findCycles(sf: ts.SourceFile, visited?: WeakSet<ts.SourceFile>, path?: ReferenceChain): ReferenceChain[];
    getSourceFile(filePath: string): ts.SourceFile;
    private _resolveImport;
    private _trackUnresolvedFileImport;
    private _resolveFileSpecifier;
}
