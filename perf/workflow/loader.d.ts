export interface Workflow {
    name: string;
    workflow: string[];
    prepare?: string[];
    cleanup?: string[];
    disabled?: true;
}
export declare function loadWorkflows(src: string): Promise<{
    [key: string]: Workflow;
}>;
