import { CommandModule } from 'yargs';
import { EnvStampMode } from './env-stamp.js';
export type EnvStampCustomPrintFn = (mode: EnvStampMode) => Promise<void>;
export interface Options {
    mode: EnvStampMode;
    includeVersion: boolean;
    additionalStampingScript: string | undefined;
}
export declare const BuildEnvStampCommand: CommandModule<{}, Options>;
