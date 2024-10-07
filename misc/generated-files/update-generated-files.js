/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ChildProcess } from '../../utils/child-process.js';
import { Spinner } from '../../utils/spinner.js';
import { getBazelBin } from '../../utils/bazel-bin.js';
import { green, Log } from '../../utils/logging.js';
export async function updateGeneratedFileTargets() {
    const spinner = new Spinner('Querying for all generated file targets');
    // Query for all of the generated file targets
    const result = await ChildProcess.spawn(getBazelBin(), [
        'query',
        `"kind(nodejs_binary, //...) intersect attr(name, '.update$', //...)"`,
        '--output',
        'label',
    ], { mode: 'silent' });
    if (result.status !== 0) {
        spinner.complete();
        throw Error(`Unexpected error: ${result.stderr}`);
    }
    const targets = result.stdout.trim().split(/\r?\n/);
    Log.debug.group('Discovered Targets');
    targets.forEach((target) => Log.debug(target));
    Log.debug.groupEnd();
    spinner.update(`Found ${targets.length} generated file targets to update`);
    // Build all of the generated file targets in parallel.
    await ChildProcess.spawn(getBazelBin(), ['build', targets.join(' ')], { mode: 'silent' });
    // Individually run the generated file update targets.
    for (let idx = 0; idx < targets.length; idx++) {
        const target = targets[idx];
        spinner.update(`${idx + 1} of ${targets.length} updates completed`);
        const updateResult = await ChildProcess.spawn(getBazelBin(), ['run', target], { mode: 'silent' });
        if (updateResult.status !== 0) {
            spinner.complete();
            throw Error(`Unexpected error while updating: ${target}.`);
        }
    }
    spinner.complete();
    Log.info(` ${green('✔')}  Updated all generated files (${targets.length} targets)`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBkYXRlLWdlbmVyYXRlZC1maWxlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9taXNjL2dlbmVyYXRlZC1maWxlcy91cGRhdGUtZ2VuZXJhdGVkLWZpbGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUMxRCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBQ3JELE9BQU8sRUFBQyxLQUFLLEVBQUUsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFbEQsTUFBTSxDQUFDLEtBQUssVUFBVSwwQkFBMEI7SUFDOUMsTUFBTSxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQUMseUNBQXlDLENBQUMsQ0FBQztJQUV2RSw4Q0FBOEM7SUFDOUMsTUFBTSxNQUFNLEdBQUcsTUFBTSxZQUFZLENBQUMsS0FBSyxDQUNyQyxXQUFXLEVBQUUsRUFDYjtRQUNFLE9BQU87UUFDUCxzRUFBc0U7UUFDdEUsVUFBVTtRQUNWLE9BQU87S0FDUixFQUNELEVBQUMsSUFBSSxFQUFFLFFBQVEsRUFBQyxDQUNqQixDQUFDO0lBRUYsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ3hCLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNuQixNQUFNLEtBQUssQ0FBQyxxQkFBcUIsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRXBELEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLG9CQUFvQixDQUFDLENBQUM7SUFDdEMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQy9DLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUM7SUFFckIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxTQUFTLE9BQU8sQ0FBQyxNQUFNLG1DQUFtQyxDQUFDLENBQUM7SUFFM0UsdURBQXVEO0lBQ3ZELE1BQU0sWUFBWSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBQyxJQUFJLEVBQUUsUUFBUSxFQUFDLENBQUMsQ0FBQztJQUV4RixzREFBc0Q7SUFDdEQsS0FBSyxJQUFJLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQztRQUM5QyxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDNUIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLE9BQU8sT0FBTyxDQUFDLE1BQU0sb0JBQW9CLENBQUMsQ0FBQztRQUNwRSxNQUFNLFlBQVksR0FBRyxNQUFNLFlBQVksQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLEVBQUUsRUFBQyxJQUFJLEVBQUUsUUFBUSxFQUFDLENBQUMsQ0FBQztRQUNoRyxJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDOUIsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ25CLE1BQU0sS0FBSyxDQUFDLG9DQUFvQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBQzdELENBQUM7SUFDSCxDQUFDO0lBRUQsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ25CLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLGtDQUFrQyxPQUFPLENBQUMsTUFBTSxXQUFXLENBQUMsQ0FBQztBQUN0RixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Q2hpbGRQcm9jZXNzfSBmcm9tICcuLi8uLi91dGlscy9jaGlsZC1wcm9jZXNzLmpzJztcbmltcG9ydCB7U3Bpbm5lcn0gZnJvbSAnLi4vLi4vdXRpbHMvc3Bpbm5lci5qcyc7XG5pbXBvcnQge2dldEJhemVsQmlufSBmcm9tICcuLi8uLi91dGlscy9iYXplbC1iaW4uanMnO1xuaW1wb3J0IHtncmVlbiwgTG9nfSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUdlbmVyYXRlZEZpbGVUYXJnZXRzKCk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBzcGlubmVyID0gbmV3IFNwaW5uZXIoJ1F1ZXJ5aW5nIGZvciBhbGwgZ2VuZXJhdGVkIGZpbGUgdGFyZ2V0cycpO1xuXG4gIC8vIFF1ZXJ5IGZvciBhbGwgb2YgdGhlIGdlbmVyYXRlZCBmaWxlIHRhcmdldHNcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKFxuICAgIGdldEJhemVsQmluKCksXG4gICAgW1xuICAgICAgJ3F1ZXJ5JyxcbiAgICAgIGBcImtpbmQobm9kZWpzX2JpbmFyeSwgLy8uLi4pIGludGVyc2VjdCBhdHRyKG5hbWUsICcudXBkYXRlJCcsIC8vLi4uKVwiYCxcbiAgICAgICctLW91dHB1dCcsXG4gICAgICAnbGFiZWwnLFxuICAgIF0sXG4gICAge21vZGU6ICdzaWxlbnQnfSxcbiAgKTtcblxuICBpZiAocmVzdWx0LnN0YXR1cyAhPT0gMCkge1xuICAgIHNwaW5uZXIuY29tcGxldGUoKTtcbiAgICB0aHJvdyBFcnJvcihgVW5leHBlY3RlZCBlcnJvcjogJHtyZXN1bHQuc3RkZXJyfWApO1xuICB9XG5cbiAgY29uc3QgdGFyZ2V0cyA9IHJlc3VsdC5zdGRvdXQudHJpbSgpLnNwbGl0KC9cXHI/XFxuLyk7XG5cbiAgTG9nLmRlYnVnLmdyb3VwKCdEaXNjb3ZlcmVkIFRhcmdldHMnKTtcbiAgdGFyZ2V0cy5mb3JFYWNoKCh0YXJnZXQpID0+IExvZy5kZWJ1Zyh0YXJnZXQpKTtcbiAgTG9nLmRlYnVnLmdyb3VwRW5kKCk7XG5cbiAgc3Bpbm5lci51cGRhdGUoYEZvdW5kICR7dGFyZ2V0cy5sZW5ndGh9IGdlbmVyYXRlZCBmaWxlIHRhcmdldHMgdG8gdXBkYXRlYCk7XG5cbiAgLy8gQnVpbGQgYWxsIG9mIHRoZSBnZW5lcmF0ZWQgZmlsZSB0YXJnZXRzIGluIHBhcmFsbGVsLlxuICBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oZ2V0QmF6ZWxCaW4oKSwgWydidWlsZCcsIHRhcmdldHMuam9pbignICcpXSwge21vZGU6ICdzaWxlbnQnfSk7XG5cbiAgLy8gSW5kaXZpZHVhbGx5IHJ1biB0aGUgZ2VuZXJhdGVkIGZpbGUgdXBkYXRlIHRhcmdldHMuXG4gIGZvciAobGV0IGlkeCA9IDA7IGlkeCA8IHRhcmdldHMubGVuZ3RoOyBpZHgrKykge1xuICAgIGNvbnN0IHRhcmdldCA9IHRhcmdldHNbaWR4XTtcbiAgICBzcGlubmVyLnVwZGF0ZShgJHtpZHggKyAxfSBvZiAke3RhcmdldHMubGVuZ3RofSB1cGRhdGVzIGNvbXBsZXRlZGApO1xuICAgIGNvbnN0IHVwZGF0ZVJlc3VsdCA9IGF3YWl0IENoaWxkUHJvY2Vzcy5zcGF3bihnZXRCYXplbEJpbigpLCBbJ3J1bicsIHRhcmdldF0sIHttb2RlOiAnc2lsZW50J30pO1xuICAgIGlmICh1cGRhdGVSZXN1bHQuc3RhdHVzICE9PSAwKSB7XG4gICAgICBzcGlubmVyLmNvbXBsZXRlKCk7XG4gICAgICB0aHJvdyBFcnJvcihgVW5leHBlY3RlZCBlcnJvciB3aGlsZSB1cGRhdGluZzogJHt0YXJnZXR9LmApO1xuICAgIH1cbiAgfVxuXG4gIHNwaW5uZXIuY29tcGxldGUoKTtcbiAgTG9nLmluZm8oYCAke2dyZWVuKCfinJQnKX0gIFVwZGF0ZWQgYWxsIGdlbmVyYXRlZCBmaWxlcyAoJHt0YXJnZXRzLmxlbmd0aH0gdGFyZ2V0cylgKTtcbn1cbiJdfQ==