/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { measureWorkflow } from './workflow.js';
import { loadWorkflows } from './loader.js';
import { join } from 'path';
import { determineRepoBaseDirFromCwd } from '../../utils/repo-directory.js';
import { addWorkflowPerformanceResult } from './database.js';
import { Spinner } from '../../utils/spinner.js';
/** Builds the checkout pull request command. */
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
/** Handles the checkout pull request command. */
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
/** yargs command module for checking out a PR. */
export const WorkflowsModule = {
    handler,
    builder,
    command: 'workflows',
    describe: 'Evaluate the performance of the provided workflows',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3BlcmYvd29ya2Zsb3cvY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUdILE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDOUMsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGFBQWEsQ0FBQztBQUMxQyxPQUFPLEVBQUMsSUFBSSxFQUFDLE1BQU0sTUFBTSxDQUFDO0FBQzFCLE9BQU8sRUFBQywyQkFBMkIsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQzFFLE9BQU8sRUFBQyw0QkFBNEIsRUFBQyxNQUFNLGVBQWUsQ0FBQztBQUMzRCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFTL0MsZ0RBQWdEO0FBQ2hELFNBQVMsT0FBTyxDQUFDLEtBQVc7SUFDMUIsT0FBTyxLQUFLO1NBQ1QsTUFBTSxDQUFDLGFBQTZCLEVBQUU7UUFDckMsT0FBTyxFQUFFLCtCQUErQjtRQUN4QyxJQUFJLEVBQUUsUUFBUTtRQUNkLFdBQVcsRUFBRSxvREFBb0Q7S0FDbEUsQ0FBQztTQUNELE1BQU0sQ0FBQyxNQUFNLEVBQUU7UUFDZCxPQUFPLEVBQUUsS0FBSztRQUNkLElBQUksRUFBRSxTQUFTO1FBQ2YsV0FBVyxFQUFFLDhEQUE4RDtLQUM1RSxDQUFDO1NBQ0QsTUFBTSxDQUFDLE1BQU0sRUFBRTtRQUNkLElBQUksRUFBRSxRQUFRO1FBQ2QsV0FBVyxFQUFFLG9DQUFvQztLQUNsRCxDQUFDO1NBQ0QsTUFBTSxDQUFDLFlBQTJCLEVBQUU7UUFDbkMsSUFBSSxFQUFFLFFBQVE7UUFDZCxXQUFXLEVBQUUsZ0ZBQWdGO0tBQzlGLENBQUMsQ0FBQztBQUNQLENBQUM7QUFFRCxpREFBaUQ7QUFDakQsS0FBSyxVQUFVLE9BQU8sQ0FBQyxFQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBa0I7SUFDekUsTUFBTSxTQUFTLEdBQUcsTUFBTSxhQUFhLENBQUMsSUFBSSxDQUFDLDJCQUEyQixFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUV2RixJQUFJLElBQUksRUFBRSxDQUFDO1FBQ1QsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3RCxPQUFPO0lBQ1QsQ0FBQztJQUVELE1BQU0sT0FBTyxHQUFvQyxFQUFFLENBQUM7SUFFcEQsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUNULE1BQU0sRUFBQyxLQUFLLEVBQUMsR0FBRyxNQUFNLGVBQWUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN2RCxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUMsS0FBSyxFQUFFLElBQUksRUFBQyxDQUFDLENBQUM7SUFDOUIsQ0FBQztTQUFNLENBQUM7UUFDTixLQUFLLE1BQU0sUUFBUSxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztZQUNoRCxNQUFNLEVBQUMsSUFBSSxFQUFFLEtBQUssRUFBQyxHQUFHLE1BQU0sZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3RELE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBQyxLQUFLLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQztRQUM5QixDQUFDO0lBQ0gsQ0FBQztJQUVELElBQUksU0FBUyxFQUFFLENBQUM7UUFDZCxNQUFNLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO1FBQ3pFLElBQUksQ0FBQztZQUNILEtBQUssSUFBSSxFQUFDLEtBQUssRUFBRSxJQUFJLEVBQUMsSUFBSSxPQUFPLEVBQUUsQ0FBQztnQkFDbEMsTUFBTSw0QkFBNEIsQ0FBQztvQkFDakMsSUFBSTtvQkFDSixLQUFLO29CQUNMLFVBQVUsRUFBRSxTQUFTO2lCQUN0QixDQUFDLENBQUM7WUFDTCxDQUFDO1FBQ0gsQ0FBQztnQkFBUyxDQUFDO1lBQ1QsT0FBTyxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3JDLENBQUM7SUFDSCxDQUFDO0FBQ0gsQ0FBQztBQUVELGtEQUFrRDtBQUNsRCxNQUFNLENBQUMsTUFBTSxlQUFlLEdBQXVDO0lBQ2pFLE9BQU87SUFDUCxPQUFPO0lBQ1AsT0FBTyxFQUFFLFdBQVc7SUFDcEIsUUFBUSxFQUFFLG9EQUFvRDtDQUMvRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QXJndiwgQ29tbWFuZE1vZHVsZX0gZnJvbSAneWFyZ3MnO1xuaW1wb3J0IHttZWFzdXJlV29ya2Zsb3d9IGZyb20gJy4vd29ya2Zsb3cuanMnO1xuaW1wb3J0IHtsb2FkV29ya2Zsb3dzfSBmcm9tICcuL2xvYWRlci5qcyc7XG5pbXBvcnQge2pvaW59IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtkZXRlcm1pbmVSZXBvQmFzZURpckZyb21Dd2R9IGZyb20gJy4uLy4uL3V0aWxzL3JlcG8tZGlyZWN0b3J5LmpzJztcbmltcG9ydCB7YWRkV29ya2Zsb3dQZXJmb3JtYW5jZVJlc3VsdH0gZnJvbSAnLi9kYXRhYmFzZS5qcyc7XG5pbXBvcnQge1NwaW5uZXJ9IGZyb20gJy4uLy4uL3V0aWxzL3NwaW5uZXIuanMnO1xuXG5pbnRlcmZhY2UgV29ya2Zsb3dzUGFyYW1zIHtcbiAgY29uZmlnRmlsZTogc3RyaW5nO1xuICBsaXN0OiBib29sZWFuO1xuICBuYW1lPzogc3RyaW5nO1xuICBjb21taXRTaGE/OiBzdHJpbmc7XG59XG5cbi8qKiBCdWlsZHMgdGhlIGNoZWNrb3V0IHB1bGwgcmVxdWVzdCBjb21tYW5kLiAqL1xuZnVuY3Rpb24gYnVpbGRlcih5YXJnczogQXJndikge1xuICByZXR1cm4geWFyZ3NcbiAgICAub3B0aW9uKCdjb25maWctZmlsZScgYXMgJ2NvbmZpZ0ZpbGUnLCB7XG4gICAgICBkZWZhdWx0OiAnLm5nLWRldi9keC1wZXJmLXdvcmtmbG93cy55bWwnLFxuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RoZSBwYXRoIHRvIHRoZSB3b3JrZmxvdyBkZWZpbml0aW9ucyBpbiBhIHltbCBmaWxlJyxcbiAgICB9KVxuICAgIC5vcHRpb24oJ2xpc3QnLCB7XG4gICAgICBkZWZhdWx0OiBmYWxzZSxcbiAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2hldGhlciB0byBnZXQgYmFjayBhIGxpc3Qgb2Ygd29ya2Zsb3dzIHRoYXQgY2FuIGJlIGV4ZWN1dGVkJyxcbiAgICB9KVxuICAgIC5vcHRpb24oJ25hbWUnLCB7XG4gICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQSBzcGVjaWZpYyB3b3JrZmxvdyB0byBydW4gYnkgbmFtZScsXG4gICAgfSlcbiAgICAub3B0aW9uKCdjb21taXQtc2hhJyBhcyAnY29tbWl0U2hhJywge1xuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RoZSBjb21taXQgc2hhIHRvIGFzc29jaWF0ZSB0aGUgbWVhc3VyZW1lbnQgd2l0aCwgdXBsb2FkaW5nIGl0IHRvIG91ciBkYXRhYmFzZScsXG4gICAgfSk7XG59XG5cbi8qKiBIYW5kbGVzIHRoZSBjaGVja291dCBwdWxsIHJlcXVlc3QgY29tbWFuZC4gKi9cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIoe2NvbmZpZ0ZpbGUsIGxpc3QsIG5hbWUsIGNvbW1pdFNoYX06IFdvcmtmbG93c1BhcmFtcykge1xuICBjb25zdCB3b3JrZmxvd3MgPSBhd2FpdCBsb2FkV29ya2Zsb3dzKGpvaW4oZGV0ZXJtaW5lUmVwb0Jhc2VEaXJGcm9tQ3dkKCksIGNvbmZpZ0ZpbGUpKTtcblxuICBpZiAobGlzdCkge1xuICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKEpTT04uc3RyaW5naWZ5KE9iamVjdC5rZXlzKHdvcmtmbG93cykpKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCByZXN1bHRzOiB7bmFtZTogc3RyaW5nOyB2YWx1ZTogbnVtYmVyfVtdID0gW107XG5cbiAgaWYgKG5hbWUpIHtcbiAgICBjb25zdCB7dmFsdWV9ID0gYXdhaXQgbWVhc3VyZVdvcmtmbG93KHdvcmtmbG93c1tuYW1lXSk7XG4gICAgcmVzdWx0cy5wdXNoKHt2YWx1ZSwgbmFtZX0pO1xuICB9IGVsc2Uge1xuICAgIGZvciAoY29uc3Qgd29ya2Zsb3cgb2YgT2JqZWN0LnZhbHVlcyh3b3JrZmxvd3MpKSB7XG4gICAgICBjb25zdCB7bmFtZSwgdmFsdWV9ID0gYXdhaXQgbWVhc3VyZVdvcmtmbG93KHdvcmtmbG93KTtcbiAgICAgIHJlc3VsdHMucHVzaCh7dmFsdWUsIG5hbWV9KTtcbiAgICB9XG4gIH1cblxuICBpZiAoY29tbWl0U2hhKSB7XG4gICAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKCdVcGxvYWRpbmcgcGVyZm9ybWFuY2UgcmVzdWx0cyB0byBkYXRhYmFzZScpO1xuICAgIHRyeSB7XG4gICAgICBmb3IgKGxldCB7dmFsdWUsIG5hbWV9IG9mIHJlc3VsdHMpIHtcbiAgICAgICAgYXdhaXQgYWRkV29ya2Zsb3dQZXJmb3JtYW5jZVJlc3VsdCh7XG4gICAgICAgICAgbmFtZSxcbiAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICBjb21taXRfc2hhOiBjb21taXRTaGEsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICBzcGlubmVyLnN1Y2Nlc3MoJ1VwbG9hZCBjb21wbGV0ZScpO1xuICAgIH1cbiAgfVxufVxuXG4vKiogeWFyZ3MgY29tbWFuZCBtb2R1bGUgZm9yIGNoZWNraW5nIG91dCBhIFBSLiAqL1xuZXhwb3J0IGNvbnN0IFdvcmtmbG93c01vZHVsZTogQ29tbWFuZE1vZHVsZTx7fSwgV29ya2Zsb3dzUGFyYW1zPiA9IHtcbiAgaGFuZGxlcixcbiAgYnVpbGRlcixcbiAgY29tbWFuZDogJ3dvcmtmbG93cycsXG4gIGRlc2NyaWJlOiAnRXZhbHVhdGUgdGhlIHBlcmZvcm1hbmNlIG9mIHRoZSBwcm92aWRlZCB3b3JrZmxvd3MnLFxufTtcbiJdfQ==