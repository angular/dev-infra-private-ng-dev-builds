import { Argv } from 'yargs';
type CompletedFn = (err: Error | null) => Promise<void> | void;
export declare function registerCompletedFunction(fn: CompletedFn): void;
export declare function runParserWithCompletedFunctions(applyConfiguration: (argv: Argv) => Argv): Promise<void>;
export {};
