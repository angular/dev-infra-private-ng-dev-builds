import { CommandModule } from 'yargs';
export interface Options {
    files: string[];
    error: string;
    model: string;
    temperature: number;
    apiKey?: string;
}
export declare const FixModule: CommandModule<{}, Options>;
