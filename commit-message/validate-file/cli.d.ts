import { CommandModule } from 'yargs';
export interface ValidateFileOptions {
    file?: string;
    fileEnvVariable?: string;
    error: boolean | null;
}
export declare const ValidateFileModule: CommandModule<{}, ValidateFileOptions>;
