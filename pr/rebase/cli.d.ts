import { CommandModule } from 'yargs';
export interface RebaseOptions {
    pr: number;
    i?: boolean;
}
export declare const RebaseCommandModule: CommandModule<{}, RebaseOptions>;
