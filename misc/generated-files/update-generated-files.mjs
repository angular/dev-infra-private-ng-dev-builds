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
    try {
        // Query for all of the generated file targets
        const result = await ChildProcess.spawn(getBazelBin(), [
            'query',
            `"kind(nodejs_binary, //...) intersect attr(name, '.update$', //...)"`,
            '--output',
            'label',
        ], { mode: 'silent' });
        if (result.status !== 0) {
            throw new Error(`Unexpected error: ${result.stderr}`);
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
            const updateResult = await ChildProcess.spawn(getBazelBin(), ['run', target], {
                mode: 'silent',
            });
            if (updateResult.status !== 0) {
                throw new Error(`Unexpected error while updating: ${target}.`);
            }
        }
        spinner.complete();
        Log.info(` ${green('✔')}  Updated all generated files (${targets.length} targets)`);
    }
    catch (e) {
        spinner.failure('An error has occurred.');
        throw e;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBkYXRlLWdlbmVyYXRlZC1maWxlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9taXNjL2dlbmVyYXRlZC1maWxlcy91cGRhdGUtZ2VuZXJhdGVkLWZpbGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUMxRCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBQ3JELE9BQU8sRUFBQyxLQUFLLEVBQUUsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFbEQsTUFBTSxDQUFDLEtBQUssVUFBVSwwQkFBMEI7SUFDOUMsTUFBTSxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQUMseUNBQXlDLENBQUMsQ0FBQztJQUV2RSxJQUFJLENBQUM7UUFDSCw4Q0FBOEM7UUFDOUMsTUFBTSxNQUFNLEdBQUcsTUFBTSxZQUFZLENBQUMsS0FBSyxDQUNyQyxXQUFXLEVBQUUsRUFDYjtZQUNFLE9BQU87WUFDUCxzRUFBc0U7WUFDdEUsVUFBVTtZQUNWLE9BQU87U0FDUixFQUNELEVBQUMsSUFBSSxFQUFFLFFBQVEsRUFBQyxDQUNqQixDQUFDO1FBRUYsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3hCLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ3hELENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVwRCxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ3RDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUMvQyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBRXJCLE9BQU8sQ0FBQyxNQUFNLENBQUMsU0FBUyxPQUFPLENBQUMsTUFBTSxtQ0FBbUMsQ0FBQyxDQUFDO1FBRTNFLHVEQUF1RDtRQUN2RCxNQUFNLFlBQVksQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUMsSUFBSSxFQUFFLFFBQVEsRUFBQyxDQUFDLENBQUM7UUFFeEYsc0RBQXNEO1FBQ3RELEtBQUssSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUM7WUFDOUMsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzVCLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxPQUFPLE9BQU8sQ0FBQyxNQUFNLG9CQUFvQixDQUFDLENBQUM7WUFDcEUsTUFBTSxZQUFZLEdBQUcsTUFBTSxZQUFZLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxFQUFFO2dCQUM1RSxJQUFJLEVBQUUsUUFBUTthQUNmLENBQUMsQ0FBQztZQUNILElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDOUIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQ0FBb0MsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUNqRSxDQUFDO1FBQ0gsQ0FBQztRQUVELE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNuQixHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxrQ0FBa0MsT0FBTyxDQUFDLE1BQU0sV0FBVyxDQUFDLENBQUM7SUFDdEYsQ0FBQztJQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDWCxPQUFPLENBQUMsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFDMUMsTUFBTSxDQUFDLENBQUM7SUFDVixDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0NoaWxkUHJvY2Vzc30gZnJvbSAnLi4vLi4vdXRpbHMvY2hpbGQtcHJvY2Vzcy5qcyc7XG5pbXBvcnQge1NwaW5uZXJ9IGZyb20gJy4uLy4uL3V0aWxzL3NwaW5uZXIuanMnO1xuaW1wb3J0IHtnZXRCYXplbEJpbn0gZnJvbSAnLi4vLi4vdXRpbHMvYmF6ZWwtYmluLmpzJztcbmltcG9ydCB7Z3JlZW4sIExvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB1cGRhdGVHZW5lcmF0ZWRGaWxlVGFyZ2V0cygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgc3Bpbm5lciA9IG5ldyBTcGlubmVyKCdRdWVyeWluZyBmb3IgYWxsIGdlbmVyYXRlZCBmaWxlIHRhcmdldHMnKTtcblxuICB0cnkge1xuICAgIC8vIFF1ZXJ5IGZvciBhbGwgb2YgdGhlIGdlbmVyYXRlZCBmaWxlIHRhcmdldHNcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oXG4gICAgICBnZXRCYXplbEJpbigpLFxuICAgICAgW1xuICAgICAgICAncXVlcnknLFxuICAgICAgICBgXCJraW5kKG5vZGVqc19iaW5hcnksIC8vLi4uKSBpbnRlcnNlY3QgYXR0cihuYW1lLCAnLnVwZGF0ZSQnLCAvLy4uLilcImAsXG4gICAgICAgICctLW91dHB1dCcsXG4gICAgICAgICdsYWJlbCcsXG4gICAgICBdLFxuICAgICAge21vZGU6ICdzaWxlbnQnfSxcbiAgICApO1xuXG4gICAgaWYgKHJlc3VsdC5zdGF0dXMgIT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBlcnJvcjogJHtyZXN1bHQuc3RkZXJyfWApO1xuICAgIH1cblxuICAgIGNvbnN0IHRhcmdldHMgPSByZXN1bHQuc3Rkb3V0LnRyaW0oKS5zcGxpdCgvXFxyP1xcbi8pO1xuXG4gICAgTG9nLmRlYnVnLmdyb3VwKCdEaXNjb3ZlcmVkIFRhcmdldHMnKTtcbiAgICB0YXJnZXRzLmZvckVhY2goKHRhcmdldCkgPT4gTG9nLmRlYnVnKHRhcmdldCkpO1xuICAgIExvZy5kZWJ1Zy5ncm91cEVuZCgpO1xuXG4gICAgc3Bpbm5lci51cGRhdGUoYEZvdW5kICR7dGFyZ2V0cy5sZW5ndGh9IGdlbmVyYXRlZCBmaWxlIHRhcmdldHMgdG8gdXBkYXRlYCk7XG5cbiAgICAvLyBCdWlsZCBhbGwgb2YgdGhlIGdlbmVyYXRlZCBmaWxlIHRhcmdldHMgaW4gcGFyYWxsZWwuXG4gICAgYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKGdldEJhemVsQmluKCksIFsnYnVpbGQnLCB0YXJnZXRzLmpvaW4oJyAnKV0sIHttb2RlOiAnc2lsZW50J30pO1xuXG4gICAgLy8gSW5kaXZpZHVhbGx5IHJ1biB0aGUgZ2VuZXJhdGVkIGZpbGUgdXBkYXRlIHRhcmdldHMuXG4gICAgZm9yIChsZXQgaWR4ID0gMDsgaWR4IDwgdGFyZ2V0cy5sZW5ndGg7IGlkeCsrKSB7XG4gICAgICBjb25zdCB0YXJnZXQgPSB0YXJnZXRzW2lkeF07XG4gICAgICBzcGlubmVyLnVwZGF0ZShgJHtpZHggKyAxfSBvZiAke3RhcmdldHMubGVuZ3RofSB1cGRhdGVzIGNvbXBsZXRlZGApO1xuICAgICAgY29uc3QgdXBkYXRlUmVzdWx0ID0gYXdhaXQgQ2hpbGRQcm9jZXNzLnNwYXduKGdldEJhemVsQmluKCksIFsncnVuJywgdGFyZ2V0XSwge1xuICAgICAgICBtb2RlOiAnc2lsZW50JyxcbiAgICAgIH0pO1xuICAgICAgaWYgKHVwZGF0ZVJlc3VsdC5zdGF0dXMgIT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIGVycm9yIHdoaWxlIHVwZGF0aW5nOiAke3RhcmdldH0uYCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc3Bpbm5lci5jb21wbGV0ZSgpO1xuICAgIExvZy5pbmZvKGAgJHtncmVlbign4pyUJyl9ICBVcGRhdGVkIGFsbCBnZW5lcmF0ZWQgZmlsZXMgKCR7dGFyZ2V0cy5sZW5ndGh9IHRhcmdldHMpYCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBzcGlubmVyLmZhaWx1cmUoJ0FuIGVycm9yIGhhcyBvY2N1cnJlZC4nKTtcbiAgICB0aHJvdyBlO1xuICB9XG59XG4iXX0=