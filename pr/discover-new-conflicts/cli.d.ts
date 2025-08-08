import { CommandModule } from 'yargs';
export interface DiscoverNewConflictsOptions {
    date: number;
    pr: number;
}
export declare const DiscoverNewConflictsCommandModule: CommandModule<{}, DiscoverNewConflictsOptions>;
