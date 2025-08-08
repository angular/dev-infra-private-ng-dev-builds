import { Argv } from 'yargs';
import { CircularDependenciesTestConfig } from './config.js';
export declare function tsCircularDependenciesBuilder(localYargs: Argv): Argv<{
    config: string;
} & {
    warnings: boolean | undefined;
}>;
export declare function main(approve: boolean, config: CircularDependenciesTestConfig, printWarnings: boolean): number;
