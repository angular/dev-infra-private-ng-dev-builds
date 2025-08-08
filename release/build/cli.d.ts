import { CommandModule } from 'yargs';
import { BuiltPackage } from '../config/index.js';
export type ReleaseBuildJsonStdout = BuiltPackage[];
export interface ReleaseBuildOptions {
    json: boolean;
}
export declare const ReleaseBuildCommandModule: CommandModule<{}, ReleaseBuildOptions>;
