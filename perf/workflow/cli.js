import { measureWorkflow } from './workflow.js';
import { loadWorkflows } from './loader.js';
import { join } from 'path';
import { determineRepoBaseDirFromCwd } from '../../utils/repo-directory.js';
import { addWorkflowPerformanceResult } from './database.js';
import { Spinner } from '../../utils/spinner.js';
function builder(yargs) {
    return yargs
        .option('config-file', {
        default: '.ng-dev/dx-perf-workflows.yml',
        type: 'string',
        description: 'The path to the workflow definitions in a yml file',
    })
        .option('list', {
        default: false,
        type: 'boolean',
        description: 'Whether to get back a list of workflows that can be executed',
    })
        .option('name', {
        type: 'string',
        description: 'A specific workflow to run by name',
    })
        .option('commit-sha', {
        type: 'string',
        description: 'The commit sha to associate the measurement with, uploading it to our database',
    });
}
async function handler({ configFile, list, name, commitSha }) {
    const workflows = await loadWorkflows(join(determineRepoBaseDirFromCwd(), configFile));
    if (list) {
        process.stdout.write(JSON.stringify(Object.keys(workflows)));
        return;
    }
    const results = [];
    if (name) {
        const { value } = await measureWorkflow(workflows[name]);
        results.push({ value, name });
    }
    else {
        for (const workflow of Object.values(workflows)) {
            const { name, value } = await measureWorkflow(workflow);
            results.push({ value, name });
        }
    }
    if (commitSha) {
        const spinner = new Spinner('Uploading performance results to database');
        try {
            for (let { value, name } of results) {
                await addWorkflowPerformanceResult({
                    name,
                    value,
                    commit_sha: commitSha,
                });
            }
        }
        finally {
            spinner.success('Upload complete');
        }
    }
}
export const WorkflowsModule = {
    handler,
    builder,
    command: 'workflows',
    describe: 'Evaluate the performance of the provided workflows',
};
//# sourceMappingURL=cli.js.map