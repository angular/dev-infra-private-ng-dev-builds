/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ModuleResolver } from './analyzer.js';
/** Options used at runtime by the parser.  */
export interface CircularDependenciesParserOptions {
    /** Whether to ignore type only imports in circular dependency checks. */
    ignoreTypeOnlyChecks?: true;
}
/** Configuration for a circular dependencies test. */
export interface CircularDependenciesTestConfig extends CircularDependenciesParserOptions {
    /** Base directory used for shortening paths in the golden file. */
    baseDir: string;
    /** Path to the golden file that is used for checking and approving. */
    goldenFile?: string;
    /** Glob that resolves source files which should be checked. */
    glob: string;
    /**
     * Optional module resolver function that can be used to resolve modules
     * to absolute file paths.
     */
    resolveModule?: ModuleResolver;
    /**
     * Optional command that will be displayed if the golden check failed. This can be used
     * to consistently use script aliases for checking/approving the golden.
     */
    approveCommand?: string;
}
/**
 * Loads the configuration for the circular dependencies test. If the config cannot be
 * loaded, an error will be printed and the process exists with a non-zero exit code.
 */
export declare function loadTestConfig(configPath: string): Promise<CircularDependenciesTestConfig>;
/**
 * This uses a dynamic import to load a module which may be ESM.
 * CommonJS code can load ESM code via a dynamic import. Unfortunately, TypeScript
 * will currently, unconditionally downlevel dynamic import into a require call.
 * require calls cannot load ESM code and will result in a runtime error. To workaround
 * this, a Function constructor is used to prevent TypeScript from changing the dynamic import.
 * Once TypeScript provides support for keeping the dynamic import this workaround can
 * be dropped.
 *
 * @param modulePath The path of the module to load.
 * @returns A Promise that resolves to the dynamically imported module.
 */
export declare function loadEsmModule<T>(modulePath: string | URL): Promise<T>;
