import { ChildProcess } from '../../utils/child-process.js';
import { green } from '../../utils/logging.js';
import { Spinner } from '../../utils/spinner.js';
export async function measureWorkflow({ name, workflow, prepare, cleanup }) {
    const spinner = new Spinner('');
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
        spinner.complete(` ${green('✓')} ${name}: ${results.duration.toFixed(2)}ms`);
        return results.toJSON();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2Zsb3cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcGVyZi93b3JrZmxvdy93b3JrZmxvdy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDMUQsT0FBTyxFQUFDLEtBQUssRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQzdDLE9BQU8sRUFBQyxPQUFPLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUcvQyxNQUFNLENBQUMsS0FBSyxVQUFVLGVBQWUsQ0FBQyxFQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBVztJQUNoRixNQUFNLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNoQyxJQUFJLENBQUM7UUFDSCxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ1osT0FBTyxDQUFDLE1BQU0sQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO1lBQy9ELDZGQUE2RjtZQUM3RixZQUFZO1lBQ1osTUFBTSxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDM0IsT0FBTyxDQUFDLE1BQU0sQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDO1FBQ3RELENBQUM7UUFFRCxPQUFPLENBQUMsTUFBTSxDQUFDLHVCQUF1QixJQUFJLEdBQUcsQ0FBQyxDQUFDO1FBQy9DLGdHQUFnRztRQUNoRyw2QkFBNkI7UUFDN0IsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMxQixNQUFNLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM1QixXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE9BQU8sQ0FBQyxNQUFNLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUVyQyxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ1osT0FBTyxDQUFDLE1BQU0sQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDO1lBQ3pELGdHQUFnRztZQUNoRyxNQUFNLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUMzQixPQUFPLENBQUMsTUFBTSxDQUFDLDhCQUE4QixDQUFDLENBQUM7UUFDakQsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztRQUUxRCxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksS0FBSyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFN0UsT0FBTyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDMUIsQ0FBQztZQUFTLENBQUM7UUFDVCxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDckIsQ0FBQztBQUNILENBQUM7QUFFRDs7O0dBR0c7QUFDSCxLQUFLLFVBQVUsV0FBVyxDQUFDLFFBQW1CO0lBQzVDLElBQUksQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUN2QyxPQUFPO0lBQ1QsQ0FBQztJQUNELEtBQUssSUFBSSxHQUFHLElBQUksUUFBUSxFQUFFLENBQUM7UUFDekIsTUFBTSxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFDLElBQUksRUFBRSxRQUFRLEVBQUMsQ0FBQyxDQUFDO0lBQ2pELENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtDaGlsZFByb2Nlc3N9IGZyb20gJy4uLy4uL3V0aWxzL2NoaWxkLXByb2Nlc3MuanMnO1xuaW1wb3J0IHtncmVlbn0gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge1NwaW5uZXJ9IGZyb20gJy4uLy4uL3V0aWxzL3NwaW5uZXIuanMnO1xuaW1wb3J0IHtXb3JrZmxvd30gZnJvbSAnLi9sb2FkZXIuanMnO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWVhc3VyZVdvcmtmbG93KHtuYW1lLCB3b3JrZmxvdywgcHJlcGFyZSwgY2xlYW51cH06IFdvcmtmbG93KSB7XG4gIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcignJyk7XG4gIHRyeSB7XG4gICAgaWYgKHByZXBhcmUpIHtcbiAgICAgIHNwaW5uZXIudXBkYXRlKCdQcmVwYXJpbmcgZW52aXJvbm1lbnQgZm9yIHdvcmtmbG93IGV4ZWN1dGlvbicpO1xuICAgICAgLy8gUnVuIHRoZSBgcHJlcGFyZWAgY29tbWFuZHMgdG8gZXN0YWJsaXNoIHRoZSBlbnZpcm9ubWVudCwgY2FjaGluZywgZXRjIHByaW9yIHRvIHJ1bm5pbmcgdGhlXG4gICAgICAvLyB3b3JrZmxvdy5cbiAgICAgIGF3YWl0IHJ1bkNvbW1hbmRzKHByZXBhcmUpO1xuICAgICAgc3Bpbm5lci51cGRhdGUoJ0Vudmlyb25tZW50IHByZXBlcmF0aW9uIGNvbXBsZXRlZCcpO1xuICAgIH1cblxuICAgIHNwaW5uZXIudXBkYXRlKGBFeGVjdXRpbmcgd29ya2Zsb3cgKCR7bmFtZX0pYCk7XG4gICAgLy8gTWFyayB0aGUgc3RhcnQgdGltZSBvZiB0aGUgd29ya2Zsb3csIGV4ZWN1dGUgYWxsIG9mIHRoZSBjb21tYW5kcyBwcm92aWRlZCBpbiB0aGUgd29ya2Zsb3cgYW5kXG4gICAgLy8gdGhlbiBtYXJrIHRoZSBlbmRpbmcgdGltZS5cbiAgICBwZXJmb3JtYW5jZS5tYXJrKCdzdGFydCcpO1xuICAgIGF3YWl0IHJ1bkNvbW1hbmRzKHdvcmtmbG93KTtcbiAgICBwZXJmb3JtYW5jZS5tYXJrKCdlbmQnKTtcblxuICAgIHNwaW5uZXIudXBkYXRlKCdXb3JrZmxvdyBjb21wbGV0ZWQnKTtcblxuICAgIGlmIChjbGVhbnVwKSB7XG4gICAgICBzcGlubmVyLnVwZGF0ZSgnQ2xlYW5pbmcgdXAgZW52aXJvbm1lbnQgYWZ0ZXIgd29ya2Zsb3cnKTtcbiAgICAgIC8vIFJ1biB0aGUgY2xlYW4gdXAgY29tbWFuZHMgdG8gcmVzZXQgdGhlIGVudmlyb25tZW50IGFuZCB1bmRvIGNoYW5nZXMgbWFkZSBkdXJpbmcgdGhlIHdvcmtmbG93LlxuICAgICAgYXdhaXQgcnVuQ29tbWFuZHMoY2xlYW51cCk7XG4gICAgICBzcGlubmVyLnVwZGF0ZSgnRW52aXJvbm1lbnQgY2xlYW51cCBjb21wbGV0ZScpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdHMgPSBwZXJmb3JtYW5jZS5tZWFzdXJlKG5hbWUsICdzdGFydCcsICdlbmQnKTtcblxuICAgIHNwaW5uZXIuY29tcGxldGUoYCAke2dyZWVuKCfinJMnKX0gJHtuYW1lfTogJHtyZXN1bHRzLmR1cmF0aW9uLnRvRml4ZWQoMil9bXNgKTtcblxuICAgIHJldHVybiByZXN1bHRzLnRvSlNPTigpO1xuICB9IGZpbmFsbHkge1xuICAgIHNwaW5uZXIuY29tcGxldGUoKTtcbiAgfVxufVxuXG4vKipcbiAqIFJ1biBhIHNldCBvZiBjb21tYW5kcyBwcm92aWRlZCBhcyBhIG11bHRpbGluZSB0ZXh0IGJsb2NrLiBDb21tYW5kcyBhcmUgYXNzdW1lZCB0byBhbHdheXMgYmVcbiAqIHByb3ZpZGVkIG9uIGEgc2luZ2xlIGxpbmUuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJ1bkNvbW1hbmRzKGNvbW1hbmRzPzogc3RyaW5nW10pIHtcbiAgaWYgKCFjb21tYW5kcyB8fCBjb21tYW5kcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm47XG4gIH1cbiAgZm9yIChsZXQgY21kIG9mIGNvbW1hbmRzKSB7XG4gICAgYXdhaXQgQ2hpbGRQcm9jZXNzLmV4ZWMoY21kLCB7bW9kZTogJ3NpbGVudCd9KTtcbiAgfVxufVxuIl19