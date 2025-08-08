export interface WorkflowPerformanceRowResult {
    commit_sha: string;
    value: number;
    name: string;
}
export declare function addWorkflowPerformanceResult(result: WorkflowPerformanceRowResult): Promise<void>;
