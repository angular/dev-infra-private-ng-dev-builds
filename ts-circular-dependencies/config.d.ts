import { ModuleResolver } from './analyzer.js';
export interface CircularDependenciesParserOptions {
    ignoreTypeOnlyChecks?: true;
}
export interface CircularDependenciesTestConfig extends CircularDependenciesParserOptions {
    baseDir: string;
    goldenFile?: string;
    glob: string;
    resolveModule?: ModuleResolver;
    approveCommand?: string;
}
export declare function loadTestConfig(configPath: string): Promise<CircularDependenciesTestConfig>;
export declare function loadEsmModule<T>(modulePath: string | URL): Promise<T>;
