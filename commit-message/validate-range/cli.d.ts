import { CommandModule } from 'yargs';
export interface ValidateRangeOptions {
    startingRef: string;
    endingRef: string;
}
export declare const ValidateRangeModule: CommandModule<{}, ValidateRangeOptions>;
