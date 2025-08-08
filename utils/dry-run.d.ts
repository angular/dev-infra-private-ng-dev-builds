import { Argv } from 'yargs';
export declare function addDryRunFlag<T>(args: Argv<T>): Argv<T & {
    dryRun: boolean;
}>;
export declare function isDryRun(): boolean;
export declare class DryRunError extends Error {
    constructor();
}
