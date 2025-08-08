import { CommandModule } from 'yargs';
import { BuiltPackageWithInfo } from '../config/index.js';
export interface ReleasePrecheckJsonStdin {
    builtPackagesWithInfo: BuiltPackageWithInfo[];
    newVersion: string;
}
export declare const ReleasePrecheckCommandModule: CommandModule<{}, {}>;
