import { CommandModule } from 'yargs';
export interface Options {
    files: string[];
    check: boolean;
}
export declare const FilesModule: CommandModule<{}, Options>;
