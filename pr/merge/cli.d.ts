import { CommandModule } from 'yargs';
export interface MergeCommandOptions {
    pr: number;
    branchPrompt: boolean;
    forceManualBranches: boolean;
    dryRun: boolean;
    ignorePendingReviews: boolean;
    waitForValidations: boolean;
}
export declare const MergeCommandModule: CommandModule<{}, MergeCommandOptions>;
