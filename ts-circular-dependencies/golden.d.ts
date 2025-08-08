import { ReferenceChain } from './analyzer.js';
export type CircularDependency = ReferenceChain<string>;
export type Golden = CircularDependency[];
export declare function convertReferenceChainToGolden(refs: ReferenceChain[], baseDir: string): Golden;
export declare function compareGoldens(actual: Golden, expected: Golden): {
    newCircularDeps: CircularDependency[];
    fixedCircularDeps: CircularDependency[];
};
