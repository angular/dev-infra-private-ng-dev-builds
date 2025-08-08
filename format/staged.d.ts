import { CommandModule } from 'yargs';
export interface Options {
    check: boolean;
}
export declare const StagedModule: CommandModule<{}, Options>;
