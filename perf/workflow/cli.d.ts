import { CommandModule } from 'yargs';
interface WorkflowsParams {
    configFile: string;
    list: boolean;
    name?: string;
    commitSha?: string;
}
export declare const WorkflowsModule: CommandModule<{}, WorkflowsParams>;
export {};
