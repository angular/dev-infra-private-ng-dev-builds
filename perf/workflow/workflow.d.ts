import { Workflow } from './loader.js';
export declare function measureWorkflow({ name, workflow, prepare, cleanup }: Workflow): Promise<{
    name: string;
    value: number;
}>;
