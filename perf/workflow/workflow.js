import { ChildProcess } from '../../utils/child-process.js';
import { Spinner } from '../../utils/spinner.js';
export async function measureWorkflow({ name, workflow, prepare, cleanup }) {
    const spinner = new Spinner();
    try {
        if (prepare) {
            spinner.update('Preparing environment for workflow execution');
            // Run the `prepare` commands to establish the environment, caching, etc prior to running the
            // workflow.
            await runCommands(prepare);
            spinner.update('Environment preperation completed');
        }
        spinner.update(`Executing workflow (${name})`);
        // Mark the start time of the workflow, execute all of the commands provided in the workflow and
        // then mark the ending time.
        performance.mark('start');
        await runCommands(workflow);
        performance.mark('end');
        spinner.update('Workflow completed');
        if (cleanup) {
            spinner.update('Cleaning up environment after workflow');
            // Run the clean up commands to reset the environment and undo changes made during the workflow.
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
/**
 * Run a set of commands provided as a multiline text block. Commands are assumed to always be
 * provided on a single line.
 */
async function runCommands(commands) {
    if (!commands || commands.length === 0) {
        return;
    }
    for (let cmd of commands) {
        await ChildProcess.exec(cmd, { mode: 'silent' });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2Zsb3cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcGVyZi93b3JrZmxvdy93b3JrZmxvdy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDMUQsT0FBTyxFQUFDLE9BQU8sRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRy9DLE1BQU0sQ0FBQyxLQUFLLFVBQVUsZUFBZSxDQUFDLEVBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFXO0lBQ2hGLE1BQU0sT0FBTyxHQUFHLElBQUksT0FBTyxFQUFFLENBQUM7SUFDOUIsSUFBSSxDQUFDO1FBQ0gsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNaLE9BQU8sQ0FBQyxNQUFNLENBQUMsOENBQThDLENBQUMsQ0FBQztZQUMvRCw2RkFBNkY7WUFDN0YsWUFBWTtZQUNaLE1BQU0sV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzNCLE9BQU8sQ0FBQyxNQUFNLENBQUMsbUNBQW1DLENBQUMsQ0FBQztRQUN0RCxDQUFDO1FBRUQsT0FBTyxDQUFDLE1BQU0sQ0FBQyx1QkFBdUIsSUFBSSxHQUFHLENBQUMsQ0FBQztRQUMvQyxnR0FBZ0c7UUFDaEcsNkJBQTZCO1FBQzdCLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDMUIsTUFBTSxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDNUIsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUV4QixPQUFPLENBQUMsTUFBTSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFFckMsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNaLE9BQU8sQ0FBQyxNQUFNLENBQUMsd0NBQXdDLENBQUMsQ0FBQztZQUN6RCxnR0FBZ0c7WUFDaEcsTUFBTSxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDM0IsT0FBTyxDQUFDLE1BQU0sQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO1FBQ2pELENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFMUQsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLElBQUksS0FBSyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFN0QsT0FBTztZQUNMLElBQUk7WUFDSixLQUFLLEVBQUUsT0FBTyxDQUFDLFFBQVE7U0FDeEIsQ0FBQztJQUNKLENBQUM7WUFBUyxDQUFDO1FBQ1QsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ3JCLENBQUM7QUFDSCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsS0FBSyxVQUFVLFdBQVcsQ0FBQyxRQUFtQjtJQUM1QyxJQUFJLENBQUMsUUFBUSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDdkMsT0FBTztJQUNULENBQUM7SUFDRCxLQUFLLElBQUksR0FBRyxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBQ3pCLE1BQU0sWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBQyxJQUFJLEVBQUUsUUFBUSxFQUFDLENBQUMsQ0FBQztJQUNqRCxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7Q2hpbGRQcm9jZXNzfSBmcm9tICcuLi8uLi91dGlscy9jaGlsZC1wcm9jZXNzLmpzJztcbmltcG9ydCB7U3Bpbm5lcn0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lci5qcyc7XG5pbXBvcnQge1dvcmtmbG93fSBmcm9tICcuL2xvYWRlci5qcyc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBtZWFzdXJlV29ya2Zsb3coe25hbWUsIHdvcmtmbG93LCBwcmVwYXJlLCBjbGVhbnVwfTogV29ya2Zsb3cpIHtcbiAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKCk7XG4gIHRyeSB7XG4gICAgaWYgKHByZXBhcmUpIHtcbiAgICAgIHNwaW5uZXIudXBkYXRlKCdQcmVwYXJpbmcgZW52aXJvbm1lbnQgZm9yIHdvcmtmbG93IGV4ZWN1dGlvbicpO1xuICAgICAgLy8gUnVuIHRoZSBgcHJlcGFyZWAgY29tbWFuZHMgdG8gZXN0YWJsaXNoIHRoZSBlbnZpcm9ubWVudCwgY2FjaGluZywgZXRjIHByaW9yIHRvIHJ1bm5pbmcgdGhlXG4gICAgICAvLyB3b3JrZmxvdy5cbiAgICAgIGF3YWl0IHJ1bkNvbW1hbmRzKHByZXBhcmUpO1xuICAgICAgc3Bpbm5lci51cGRhdGUoJ0Vudmlyb25tZW50IHByZXBlcmF0aW9uIGNvbXBsZXRlZCcpO1xuICAgIH1cblxuICAgIHNwaW5uZXIudXBkYXRlKGBFeGVjdXRpbmcgd29ya2Zsb3cgKCR7bmFtZX0pYCk7XG4gICAgLy8gTWFyayB0aGUgc3RhcnQgdGltZSBvZiB0aGUgd29ya2Zsb3csIGV4ZWN1dGUgYWxsIG9mIHRoZSBjb21tYW5kcyBwcm92aWRlZCBpbiB0aGUgd29ya2Zsb3cgYW5kXG4gICAgLy8gdGhlbiBtYXJrIHRoZSBlbmRpbmcgdGltZS5cbiAgICBwZXJmb3JtYW5jZS5tYXJrKCdzdGFydCcpO1xuICAgIGF3YWl0IHJ1bkNvbW1hbmRzKHdvcmtmbG93KTtcbiAgICBwZXJmb3JtYW5jZS5tYXJrKCdlbmQnKTtcblxuICAgIHNwaW5uZXIudXBkYXRlKCdXb3JrZmxvdyBjb21wbGV0ZWQnKTtcblxuICAgIGlmIChjbGVhbnVwKSB7XG4gICAgICBzcGlubmVyLnVwZGF0ZSgnQ2xlYW5pbmcgdXAgZW52aXJvbm1lbnQgYWZ0ZXIgd29ya2Zsb3cnKTtcbiAgICAgIC8vIFJ1biB0aGUgY2xlYW4gdXAgY29tbWFuZHMgdG8gcmVzZXQgdGhlIGVudmlyb25tZW50IGFuZCB1bmRvIGNoYW5nZXMgbWFkZSBkdXJpbmcgdGhlIHdvcmtmbG93LlxuICAgICAgYXdhaXQgcnVuQ29tbWFuZHMoY2xlYW51cCk7XG4gICAgICBzcGlubmVyLnVwZGF0ZSgnRW52aXJvbm1lbnQgY2xlYW51cCBjb21wbGV0ZScpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdHMgPSBwZXJmb3JtYW5jZS5tZWFzdXJlKG5hbWUsICdzdGFydCcsICdlbmQnKTtcblxuICAgIHNwaW5uZXIuc3VjY2VzcyhgJHtuYW1lfTogJHtyZXN1bHRzLmR1cmF0aW9uLnRvRml4ZWQoMil9bXNgKTtcblxuICAgIHJldHVybiB7XG4gICAgICBuYW1lLFxuICAgICAgdmFsdWU6IHJlc3VsdHMuZHVyYXRpb24sXG4gICAgfTtcbiAgfSBmaW5hbGx5IHtcbiAgICBzcGlubmVyLmNvbXBsZXRlKCk7XG4gIH1cbn1cblxuLyoqXG4gKiBSdW4gYSBzZXQgb2YgY29tbWFuZHMgcHJvdmlkZWQgYXMgYSBtdWx0aWxpbmUgdGV4dCBibG9jay4gQ29tbWFuZHMgYXJlIGFzc3VtZWQgdG8gYWx3YXlzIGJlXG4gKiBwcm92aWRlZCBvbiBhIHNpbmdsZSBsaW5lLlxuICovXG5hc3luYyBmdW5jdGlvbiBydW5Db21tYW5kcyhjb21tYW5kcz86IHN0cmluZ1tdKSB7XG4gIGlmICghY29tbWFuZHMgfHwgY29tbWFuZHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGZvciAobGV0IGNtZCBvZiBjb21tYW5kcykge1xuICAgIGF3YWl0IENoaWxkUHJvY2Vzcy5leGVjKGNtZCwge21vZGU6ICdzaWxlbnQnfSk7XG4gIH1cbn1cbiJdfQ==