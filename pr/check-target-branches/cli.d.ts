import { CommandModule } from 'yargs';
export interface CheckTargetBranchesOptions {
    pr: number;
}
export declare const CheckTargetBranchesModule: CommandModule<{}, CheckTargetBranchesOptions>;
