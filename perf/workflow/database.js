import { Spanner } from '@google-cloud/spanner';
export async function addWorkflowPerformanceResult(result) {
    const spanner = new Spanner({
        projectId: 'internal-200822',
    });
    const instance = spanner.instance('ng-measurables');
    const database = instance.database('commit_performance');
    const workflowPerformanceTable = database.table('WorkflowPerformance');
    try {
        await workflowPerformanceTable.insert(result);
    }
    finally {
        await database.close();
    }
}
//# sourceMappingURL=database.js.map