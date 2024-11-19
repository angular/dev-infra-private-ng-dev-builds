export interface Workflow {
    name: string;
    workflow: string[];
    prepare?: string[];
    cleanup?: string[];
}
export declare function loadWorkflows(src: string): Promise<{
    [key: string]: Workflow;
}>;
