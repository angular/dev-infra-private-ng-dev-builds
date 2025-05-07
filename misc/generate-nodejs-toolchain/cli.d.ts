import { CommandModule } from 'yargs';
/** Command line options. */
export interface GenerateNodeJsToolchainOptions {
    nodeJsVersion: string;
}
/** CLI command module. */
export declare const GeneratedNodeJsToolchainModule: CommandModule<{}, GenerateNodeJsToolchainOptions>;
