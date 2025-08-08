import { CommandModule } from 'yargs';
export interface Options {
    prompt: string;
    files: string;
    model: string;
    temperature: number;
    maxConcurrency: number;
    apiKey?: string;
}
export declare const MigrateModule: CommandModule<{}, Options>;
