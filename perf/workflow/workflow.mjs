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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2Zsb3cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcGVyZi93b3JrZmxvdy93b3JrZmxvdy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0sOEJBQThCLENBQUM7QUFDMUQsT0FBTyxFQUFDLE9BQU8sRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRy9DLE1BQU0sQ0FBQyxLQUFLLFVBQVUsZUFBZSxDQUFDLEVBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFXO0lBQ2hGLE1BQU0sT0FBTyxHQUFHLElBQUksT0FBTyxFQUFFLENBQUM7SUFDOUIsSUFBSSxDQUFDO1FBQ0gsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNaLE9BQU8sQ0FBQyxNQUFNLENBQUMsOENBQThDLENBQUMsQ0FBQztZQUMvRCw2RkFBNkY7WUFDN0YsWUFBWTtZQUNaLE1BQU0sV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzNCLE9BQU8sQ0FBQyxNQUFNLENBQUMsbUNBQW1DLENBQUMsQ0FBQztRQUN0RCxDQUFDO1FBRUQsT0FBTyxDQUFDLE1BQU0sQ0FBQyx1QkFBdUIsSUFBSSxHQUFHLENBQUMsQ0FBQztRQUMvQyxnR0FBZ0c7UUFDaEcsNkJBQTZCO1FBQzdCLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDMUIsTUFBTSxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDNUIsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUV4QixPQUFPLENBQUMsTUFBTSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFFckMsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNaLE9BQU8sQ0FBQyxNQUFNLENBQUMsd0NBQXdDLENBQUMsQ0FBQztZQUN6RCxnR0FBZ0c7WUFDaEcsTUFBTSxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDM0IsT0FBTyxDQUFDLE1BQU0sQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO1FBQ2pELENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFMUQsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLElBQUksS0FBSyxPQUFPLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFN0QsT0FBTyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDMUIsQ0FBQztZQUFTLENBQUM7UUFDVCxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDckIsQ0FBQztBQUNILENBQUM7QUFFRDs7O0dBR0c7QUFDSCxLQUFLLFVBQVUsV0FBVyxDQUFDLFFBQW1CO0lBQzVDLElBQUksQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUN2QyxPQUFPO0lBQ1QsQ0FBQztJQUNELEtBQUssSUFBSSxHQUFHLElBQUksUUFBUSxFQUFFLENBQUM7UUFDekIsTUFBTSxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFDLElBQUksRUFBRSxRQUFRLEVBQUMsQ0FBQyxDQUFDO0lBQ2pELENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtDaGlsZFByb2Nlc3N9IGZyb20gJy4uLy4uL3V0aWxzL2NoaWxkLXByb2Nlc3MuanMnO1xuaW1wb3J0IHtTcGlubmVyfSBmcm9tICcuLi8uLi91dGlscy9zcGlubmVyLmpzJztcbmltcG9ydCB7V29ya2Zsb3d9IGZyb20gJy4vbG9hZGVyLmpzJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1lYXN1cmVXb3JrZmxvdyh7bmFtZSwgd29ya2Zsb3csIHByZXBhcmUsIGNsZWFudXB9OiBXb3JrZmxvdykge1xuICBjb25zdCBzcGlubmVyID0gbmV3IFNwaW5uZXIoKTtcbiAgdHJ5IHtcbiAgICBpZiAocHJlcGFyZSkge1xuICAgICAgc3Bpbm5lci51cGRhdGUoJ1ByZXBhcmluZyBlbnZpcm9ubWVudCBmb3Igd29ya2Zsb3cgZXhlY3V0aW9uJyk7XG4gICAgICAvLyBSdW4gdGhlIGBwcmVwYXJlYCBjb21tYW5kcyB0byBlc3RhYmxpc2ggdGhlIGVudmlyb25tZW50LCBjYWNoaW5nLCBldGMgcHJpb3IgdG8gcnVubmluZyB0aGVcbiAgICAgIC8vIHdvcmtmbG93LlxuICAgICAgYXdhaXQgcnVuQ29tbWFuZHMocHJlcGFyZSk7XG4gICAgICBzcGlubmVyLnVwZGF0ZSgnRW52aXJvbm1lbnQgcHJlcGVyYXRpb24gY29tcGxldGVkJyk7XG4gICAgfVxuXG4gICAgc3Bpbm5lci51cGRhdGUoYEV4ZWN1dGluZyB3b3JrZmxvdyAoJHtuYW1lfSlgKTtcbiAgICAvLyBNYXJrIHRoZSBzdGFydCB0aW1lIG9mIHRoZSB3b3JrZmxvdywgZXhlY3V0ZSBhbGwgb2YgdGhlIGNvbW1hbmRzIHByb3ZpZGVkIGluIHRoZSB3b3JrZmxvdyBhbmRcbiAgICAvLyB0aGVuIG1hcmsgdGhlIGVuZGluZyB0aW1lLlxuICAgIHBlcmZvcm1hbmNlLm1hcmsoJ3N0YXJ0Jyk7XG4gICAgYXdhaXQgcnVuQ29tbWFuZHMod29ya2Zsb3cpO1xuICAgIHBlcmZvcm1hbmNlLm1hcmsoJ2VuZCcpO1xuXG4gICAgc3Bpbm5lci51cGRhdGUoJ1dvcmtmbG93IGNvbXBsZXRlZCcpO1xuXG4gICAgaWYgKGNsZWFudXApIHtcbiAgICAgIHNwaW5uZXIudXBkYXRlKCdDbGVhbmluZyB1cCBlbnZpcm9ubWVudCBhZnRlciB3b3JrZmxvdycpO1xuICAgICAgLy8gUnVuIHRoZSBjbGVhbiB1cCBjb21tYW5kcyB0byByZXNldCB0aGUgZW52aXJvbm1lbnQgYW5kIHVuZG8gY2hhbmdlcyBtYWRlIGR1cmluZyB0aGUgd29ya2Zsb3cuXG4gICAgICBhd2FpdCBydW5Db21tYW5kcyhjbGVhbnVwKTtcbiAgICAgIHNwaW5uZXIudXBkYXRlKCdFbnZpcm9ubWVudCBjbGVhbnVwIGNvbXBsZXRlJyk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0cyA9IHBlcmZvcm1hbmNlLm1lYXN1cmUobmFtZSwgJ3N0YXJ0JywgJ2VuZCcpO1xuXG4gICAgc3Bpbm5lci5zdWNjZXNzKGAke25hbWV9OiAke3Jlc3VsdHMuZHVyYXRpb24udG9GaXhlZCgyKX1tc2ApO1xuXG4gICAgcmV0dXJuIHJlc3VsdHMudG9KU09OKCk7XG4gIH0gZmluYWxseSB7XG4gICAgc3Bpbm5lci5jb21wbGV0ZSgpO1xuICB9XG59XG5cbi8qKlxuICogUnVuIGEgc2V0IG9mIGNvbW1hbmRzIHByb3ZpZGVkIGFzIGEgbXVsdGlsaW5lIHRleHQgYmxvY2suIENvbW1hbmRzIGFyZSBhc3N1bWVkIHRvIGFsd2F5cyBiZVxuICogcHJvdmlkZWQgb24gYSBzaW5nbGUgbGluZS5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcnVuQ29tbWFuZHMoY29tbWFuZHM/OiBzdHJpbmdbXSkge1xuICBpZiAoIWNvbW1hbmRzIHx8IGNvbW1hbmRzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybjtcbiAgfVxuICBmb3IgKGxldCBjbWQgb2YgY29tbWFuZHMpIHtcbiAgICBhd2FpdCBDaGlsZFByb2Nlc3MuZXhlYyhjbWQsIHttb2RlOiAnc2lsZW50J30pO1xuICB9XG59XG4iXX0=