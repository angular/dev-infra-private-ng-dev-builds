import { Argv } from 'yargs';
type CompletedFn = (err: Error | null) => Promise<void> | void;
/** Register a function to be called when the command completes. */
export declare function registerCompletedFunction(fn: CompletedFn): void;
/**
 * Run the yargs process, as configured by the supplied function, calling a set of completion
 * functions after the command completes.
 */
export declare function runParserWithCompletedFunctions(applyConfiguration: (argv: Argv) => Argv): Promise<void>;
export {};
