import { CommandModule } from 'yargs';
import { NpmPackage } from '../config/index.js';
export type ReleaseInfoJsonStdout = {
    npmPackages: NpmPackage[];
};
export interface ReleaseInfoOptions {
    json: boolean;
}
export declare const ReleaseInfoCommandModule: CommandModule<{}, ReleaseInfoOptions>;
