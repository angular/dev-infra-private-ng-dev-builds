import { CommandModule } from 'yargs';
export interface Options {
    shaOrRef?: string;
    check: boolean;
}
export declare const ChangedModule: CommandModule<{}, Options>;
