import { CommandModule } from 'yargs';
export interface RestoreCommitMessageOptions {
    file?: string;
    source?: string;
    fileEnvVariable?: string;
}
export declare const RestoreCommitMessageModule: CommandModule<{}, RestoreCommitMessageOptions>;
