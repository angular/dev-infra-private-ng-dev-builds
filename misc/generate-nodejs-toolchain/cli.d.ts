import { CommandModule } from 'yargs';
export interface GenerateNodeJsToolchainOptions {
    nodeJsVersion: string;
}
export declare const GeneratedNodeJsToolchainModule: CommandModule<{}, GenerateNodeJsToolchainOptions>;
