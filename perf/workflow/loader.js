import { readFile } from 'fs/promises';
import { parse } from 'yaml';
export async function loadWorkflows(src) {
    const filteredWorkflows = {};
    const rawWorkflows = await readFile(src, { encoding: 'utf-8' });
    const workflows = parse(rawWorkflows).workflows;
    for (const [name, workflow] of Object.entries(workflows)) {
        if (workflow.disabled !== true) {
            filteredWorkflows[name] = workflow;
        }
    }
    return filteredWorkflows;
}
//# sourceMappingURL=loader.js.map