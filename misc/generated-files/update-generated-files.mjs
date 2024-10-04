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
    const result = await ChildProcess.spawn(getBazelBin(), ['query', `"kind(nodejs_binary, //...) intersect attr(name, '.update$', //...)"`], { mode: 'silent' });
    if (result.status !== 0) {
        spinner.complete();
        throw Error(`Unexpected error: ${result.stderr}`);
    }
    const targets = result.stdout.trim().split(/\r?\n/);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBkYXRlLWdlbmVyYXRlZC1maWxlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9taXNjL2dlbmVyYXRlZC1maWxlcy91cGRhdGUtZ2VuZXJhdGVkLWZpbGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUMxRCxPQUFPLEVBQUMsT0FBTyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDL0MsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBQ3JELE9BQU8sRUFBQyxLQUFLLEVBQUUsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFFbEQsTUFBTSxDQUFDLEtBQUssVUFBVSwwQkFBMEI7SUFDOUMsTUFBTSxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQUMseUNBQXlDLENBQUMsQ0FBQztJQUV2RSw4Q0FBOEM7SUFDOUMsTUFBTSxNQUFNLEdBQUcsTUFBTSxZQUFZLENBQUMsS0FBSyxDQUNyQyxXQUFXLEVBQUUsRUFDYixDQUFDLE9BQU8sRUFBRSxzRUFBc0UsQ0FBQyxFQUNqRixFQUFDLElBQUksRUFBRSxRQUFRLEVBQUMsQ0FDakIsQ0FBQztJQUVGLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUN4QixPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDbkIsTUFBTSxLQUFLLENBQUMscUJBQXFCLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFFRCxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNwRCxPQUFPLENBQUMsTUFBTSxDQUFDLFNBQVMsT0FBTyxDQUFDLE1BQU0sbUNBQW1DLENBQUMsQ0FBQztJQUUzRSx1REFBdUQ7SUFDdkQsTUFBTSxZQUFZLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFDLElBQUksRUFBRSxRQUFRLEVBQUMsQ0FBQyxDQUFDO0lBRXhGLHNEQUFzRDtJQUN0RCxLQUFLLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDO1FBQzlDLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM1QixPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsT0FBTyxPQUFPLENBQUMsTUFBTSxvQkFBb0IsQ0FBQyxDQUFDO1FBQ3BFLE1BQU0sWUFBWSxHQUFHLE1BQU0sWUFBWSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsRUFBRSxFQUFDLElBQUksRUFBRSxRQUFRLEVBQUMsQ0FBQyxDQUFDO1FBQ2hHLElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUM5QixPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDbkIsTUFBTSxLQUFLLENBQUMsb0NBQW9DLE1BQU0sR0FBRyxDQUFDLENBQUM7UUFDN0QsQ0FBQztJQUNILENBQUM7SUFFRCxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDbkIsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsa0NBQWtDLE9BQU8sQ0FBQyxNQUFNLFdBQVcsQ0FBQyxDQUFDO0FBQ3RGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDaGlsZFByb2Nlc3N9IGZyb20gJy4uLy4uL3V0aWxzL2NoaWxkLXByb2Nlc3MuanMnO1xuaW1wb3J0IHtTcGlubmVyfSBmcm9tICcuLi8uLi91dGlscy9zcGlubmVyLmpzJztcbmltcG9ydCB7Z2V0QmF6ZWxCaW59IGZyb20gJy4uLy4uL3V0aWxzL2JhemVsLWJpbi5qcyc7XG5pbXBvcnQge2dyZWVuLCBMb2d9IGZyb20gJy4uLy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBkYXRlR2VuZXJhdGVkRmlsZVRhcmdldHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHNwaW5uZXIgPSBuZXcgU3Bpbm5lcignUXVlcnlpbmcgZm9yIGFsbCBnZW5lcmF0ZWQgZmlsZSB0YXJnZXRzJyk7XG5cbiAgLy8gUXVlcnkgZm9yIGFsbCBvZiB0aGUgZ2VuZXJhdGVkIGZpbGUgdGFyZ2V0c1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oXG4gICAgZ2V0QmF6ZWxCaW4oKSxcbiAgICBbJ3F1ZXJ5JywgYFwia2luZChub2RlanNfYmluYXJ5LCAvLy4uLikgaW50ZXJzZWN0IGF0dHIobmFtZSwgJy51cGRhdGUkJywgLy8uLi4pXCJgXSxcbiAgICB7bW9kZTogJ3NpbGVudCd9LFxuICApO1xuXG4gIGlmIChyZXN1bHQuc3RhdHVzICE9PSAwKSB7XG4gICAgc3Bpbm5lci5jb21wbGV0ZSgpO1xuICAgIHRocm93IEVycm9yKGBVbmV4cGVjdGVkIGVycm9yOiAke3Jlc3VsdC5zdGRlcnJ9YCk7XG4gIH1cblxuICBjb25zdCB0YXJnZXRzID0gcmVzdWx0LnN0ZG91dC50cmltKCkuc3BsaXQoL1xccj9cXG4vKTtcbiAgc3Bpbm5lci51cGRhdGUoYEZvdW5kICR7dGFyZ2V0cy5sZW5ndGh9IGdlbmVyYXRlZCBmaWxlIHRhcmdldHMgdG8gdXBkYXRlYCk7XG5cbiAgLy8gQnVpbGQgYWxsIG9mIHRoZSBnZW5lcmF0ZWQgZmlsZSB0YXJnZXRzIGluIHBhcmFsbGVsLlxuICBhd2FpdCBDaGlsZFByb2Nlc3Muc3Bhd24oZ2V0QmF6ZWxCaW4oKSwgWydidWlsZCcsIHRhcmdldHMuam9pbignICcpXSwge21vZGU6ICdzaWxlbnQnfSk7XG5cbiAgLy8gSW5kaXZpZHVhbGx5IHJ1biB0aGUgZ2VuZXJhdGVkIGZpbGUgdXBkYXRlIHRhcmdldHMuXG4gIGZvciAobGV0IGlkeCA9IDA7IGlkeCA8IHRhcmdldHMubGVuZ3RoOyBpZHgrKykge1xuICAgIGNvbnN0IHRhcmdldCA9IHRhcmdldHNbaWR4XTtcbiAgICBzcGlubmVyLnVwZGF0ZShgJHtpZHggKyAxfSBvZiAke3RhcmdldHMubGVuZ3RofSB1cGRhdGVzIGNvbXBsZXRlZGApO1xuICAgIGNvbnN0IHVwZGF0ZVJlc3VsdCA9IGF3YWl0IENoaWxkUHJvY2Vzcy5zcGF3bihnZXRCYXplbEJpbigpLCBbJ3J1bicsIHRhcmdldF0sIHttb2RlOiAnc2lsZW50J30pO1xuICAgIGlmICh1cGRhdGVSZXN1bHQuc3RhdHVzICE9PSAwKSB7XG4gICAgICBzcGlubmVyLmNvbXBsZXRlKCk7XG4gICAgICB0aHJvdyBFcnJvcihgVW5leHBlY3RlZCBlcnJvciB3aGlsZSB1cGRhdGluZzogJHt0YXJnZXR9LmApO1xuICAgIH1cbiAgfVxuXG4gIHNwaW5uZXIuY29tcGxldGUoKTtcbiAgTG9nLmluZm8oYCAke2dyZWVuKCfinJQnKX0gIFVwZGF0ZWQgYWxsIGdlbmVyYXRlZCBmaWxlcyAoJHt0YXJnZXRzLmxlbmd0aH0gdGFyZ2V0cylgKTtcbn1cbiJdfQ==