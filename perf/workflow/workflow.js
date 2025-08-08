import { ChildProcess } from '../../utils/child-process.js';
import { Spinner } from '../../utils/spinner.js';
export async function measureWorkflow({ name, workflow, prepare, cleanup }) {
    const spinner = new Spinner();
    try {
        if (prepare) {
            spinner.update('Preparing environment for workflow execution');
            await runCommands(prepare);
            spinner.update('Environment preperation completed');
        }
        spinner.update(`Executing workflow (${name})`);
        performance.mark('start');
        await runCommands(workflow);
        performance.mark('end');
        spinner.update('Workflow completed');
        if (cleanup) {
            spinner.update('Cleaning up environment after workflow');
            await runCommands(cleanup);
            spinner.update('Environment cleanup complete');
        }
        const results = performance.measure(name, 'start', 'end');
        spinner.success(`${name}: ${results.duration.toFixed(2)}ms`);
        return {
            name,
            value: results.duration,
        };
    }
    finally {
        spinner.complete();
    }
}
async function runCommands(commands) {
    if (!commands || commands.length === 0) {
        return;
    }
    for (let cmd of commands) {
        await ChildProcess.exec(cmd, { mode: 'silent' });
    }
}
//# sourceMappingURL=workflow.js.map