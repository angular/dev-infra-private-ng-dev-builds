/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Bar } from 'cli-progress';
import multimatch from 'multimatch';
import { cpus } from 'os';
import { ChildProcess } from '../utils/child-process.js';
import { Log } from '../utils/logging.js';
import { getActiveFormatters } from './formatters/index.js';
// Some environments, like CircleCI which use Docker report a number of CPUs by the host and not the count of available.
// This causes the task to be killed when formatting a large number of files due lack of resources.
// https://github.com/nodejs/node/issues/28762
const AVAILABLE_THREADS = Math.max(Math.min(cpus().length, 8) - 1, 1);
/**
 * Run the provided commands in parallel for each provided file.
 *
 * Running the formatter is split across (number of available cpu threads - 1) processess.
 * The task is done in multiple processess to speed up the overall time of the task, as running
 * across entire repositories takes a large amount of time.
 * As a data point for illustration, using 8 process rather than 1 cut the execution
 * time from 276 seconds to 39 seconds for the same 2700 files.
 *
 * A promise is returned, completed when the command has completed running for each file.
 * The promise resolves with a list of failures, or `false` if no formatters have matched.
 */
export function runFormatterInParallel(allFiles, action) {
    return new Promise(async (resolve) => {
        const formatters = await getActiveFormatters();
        const failures = [];
        const pendingCommands = [];
        for (const formatter of formatters) {
            pendingCommands.push(...multimatch
                .call(undefined, allFiles, formatter.getFileMatcher(), { dot: true })
                .map((file) => ({ formatter, file })));
        }
        // If no commands are generated, resolve the promise as `false` as no files
        // were run against the any formatters.
        if (pendingCommands.length === 0) {
            return resolve(false);
        }
        switch (action) {
            case 'format':
                Log.info(`Formatting ${pendingCommands.length} file(s)`);
                break;
            case 'check':
                Log.info(`Checking format of ${pendingCommands.length} file(s)`);
                break;
            default:
                throw Error(`Invalid format action "${action}": allowed actions are "format" and "check"`);
        }
        // The progress bar instance to use for progress tracking.
        const progressBar = new Bar({
            format: `[{bar}] ETA: {eta}s | {value}/{total} files`,
            clearOnComplete: true,
        });
        // A local copy of the files to run the command on.
        // An array to represent the current usage state of each of the threads for parallelization.
        const threads = new Array(AVAILABLE_THREADS).fill(false);
        // Recursively run the command on the next available file from the list using the provided
        // thread.
        function runCommandInThread(thread) {
            const nextCommand = pendingCommands.pop();
            // If no file was pulled from the array, return as there are no more files to run against.
            if (nextCommand === undefined) {
                threads[thread] = false;
                return;
            }
            // Get the file and formatter for the next command.
            const { file, formatter } = nextCommand;
            const [spawnCmd, ...spawnArgs] = [...formatter.commandFor(action).split(' '), file];
            ChildProcess.spawn(spawnCmd, spawnArgs, {
                suppressErrorOnFailingExitCode: true,
                mode: 'silent',
            }).then(({ stdout, stderr, status }) => {
                // Run the provided callback function.
                const failed = formatter.callbackFor(action)(file, status, stdout, stderr);
                if (failed) {
                    failures.push({ filePath: file, message: stderr });
                }
                // Note in the progress bar another file being completed.
                progressBar.increment(1);
                // If more files exist in the list, run again to work on the next file,
                // using the same slot.
                if (pendingCommands.length) {
                    return runCommandInThread(thread);
                }
                // If not more files are available, mark the thread as unused.
                threads[thread] = false;
                // If all of the threads are false, as they are unused, mark the progress bar
                // completed and resolve the promise.
                if (threads.every((active) => !active)) {
                    progressBar.stop();
                    resolve(failures);
                }
            });
            // Mark the thread as in use as the command execution has been started.
            threads[thread] = true;
        }
        // Start the progress bar
        progressBar.start(pendingCommands.length, 0);
        // Start running the command on files from the least in each available thread.
        threads.forEach((_, idx) => runCommandInThread(idx));
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVuLWNvbW1hbmRzLXBhcmFsbGVsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbmctZGV2L2Zvcm1hdC9ydW4tY29tbWFuZHMtcGFyYWxsZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLEdBQUcsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUNqQyxPQUFPLFVBQVUsTUFBTSxZQUFZLENBQUM7QUFDcEMsT0FBTyxFQUFDLElBQUksRUFBQyxNQUFNLElBQUksQ0FBQztBQUV4QixPQUFPLEVBQUMsWUFBWSxFQUFjLE1BQU0sMkJBQTJCLENBQUM7QUFDcEUsT0FBTyxFQUFDLEdBQUcsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBRXhDLE9BQU8sRUFBNkIsbUJBQW1CLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUV0Rix3SEFBd0g7QUFDeEgsbUdBQW1HO0FBQ25HLDhDQUE4QztBQUM5QyxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBVXRFOzs7Ozs7Ozs7OztHQVdHO0FBQ0gsTUFBTSxVQUFVLHNCQUFzQixDQUFDLFFBQWtCLEVBQUUsTUFBdUI7SUFDaEYsT0FBTyxJQUFJLE9BQU8sQ0FBMEIsS0FBSyxFQUFFLE9BQU8sRUFBRSxFQUFFO1FBQzVELE1BQU0sVUFBVSxHQUFHLE1BQU0sbUJBQW1CLEVBQUUsQ0FBQztRQUMvQyxNQUFNLFFBQVEsR0FBb0IsRUFBRSxDQUFDO1FBQ3JDLE1BQU0sZUFBZSxHQUEyQyxFQUFFLENBQUM7UUFFbkUsS0FBSyxNQUFNLFNBQVMsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUNuQyxlQUFlLENBQUMsSUFBSSxDQUNsQixHQUFHLFVBQVU7aUJBQ1YsSUFBSSxDQUFDLFNB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SyxDQUFDO2dCQUN4Qiw2RUFBNkU7Z0JBQzdFLHFDQUFxQztnQkFDckMsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7b0JBQ3ZDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDbkIsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUNwQixDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFDSCx1RUFBdUU7WUFDdkUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQztRQUN6QixDQUFDO1FBRUQseUJBQXlCO1FBQ3pCLFdBQVcsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM3Qyw4RUFBOEU7UUFDOUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDdkQsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QmFyfSBmcm9tICdjbGktcHJvZ3Jlc3MnO1xuaW1wb3J0IG11bHRpbWF0Y2ggZnJvbSAnbXVsdGltYXRjaCc7XG5pbXBvcnQge2NwdXN9IGZyb20gJ29zJztcblxuaW1wb3J0IHtDaGlsZFByb2Nlc3MsIFNwYXduUmVzdWx0fSBmcm9tICcuLi91dGlscy9jaGlsZC1wcm9jZXNzLmpzJztcbmltcG9ydCB7TG9nfSBmcm9tICcuLi91dGlscy9sb2dnaW5nLmpzJztcblxuaW1wb3J0IHtGb3JtYXR0ZXIsIEZvcm1hdHRlckFjdGlvbiwgZ2V0QWN0aXZlRm9ybWF0dGVyc30gZnJvbSAnLi9mb3JtYXR0ZXJzL2luZGV4LmpzJztcblxuLy8gU29tZSBlbnZpcm9ubWVudHMsIGxpa2UgQ2lyY2xlQ0kgd2hpY2ggdXNlIERvY2tlciByZXBvcnQgYSBudW1iZXIgb2YgQ1BVcyBieSB0aGUgaG9zdCBhbmQgbm90IHRoZSBjb3VudCBvZiBhdmFpbGFibGUuXG4vLyBUaGlzIGNhdXNlcyB0aGUgdGFzayB0byBiZSBraWxsZWQgd2hlbiBmb3JtYXR0aW5nIGEgbGFyZ2UgbnVtYmVyIG9mIGZpbGVzIGR1ZSBsYWNrIG9mIHJlc291cmNlcy5cbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9pc3N1ZXMvMjg3NjJcbmNvbnN0IEFWQUlMQUJMRV9USFJFQURTID0gTWF0aC5tYXgoTWF0aC5taW4oY3B1cygpLmxlbmd0aCwgOCkgLSAxLCAxKTtcblxuLyoqIEludGVyZmFjZSBkZXNjcmliaW5nIGEgZmFpbHVyZSBvY2N1cnJlZCBkdXJpbmcgZm9ybWF0dGluZyBvZiBhIGZpbGUuICovXG5leHBvcnQgaW50ZXJmYWNlIEZvcm1hdEZhaWx1cmUge1xuICAvKiogUGF0aCB0byB0aGUgZmlsZSB0aGF0IGZhaWxlZC4gKi9cbiAgZmlsZVBhdGg6IHN0cmluZztcbiAgLyoqIEVycm9yIG1lc3NhZ2UgcmVwb3J0ZWQgYnkgdGhlIGZvcm1hdHRlci4gKi9cbiAgbWVzc2FnZTogc3RyaW5nO1xufVxuXG4vKipcbiAqIFJ1biB0aGUgcHJvdmlkZWQgY29tbWFuZHMgaW4gcGFyYWxsZWwgZm9yIGVhY2ggcHJvdmlkZWQgZmlsZS5cbiAqXG4gKiBSdW5uaW5nIHRoZSBmb3JtYXR0ZXIgaXMgc3BsaXQgYWNyb3NzIChudW1iZXIgb2YgYXZhaWxhYmxlIGNwdSB0aHJlYWRzIC0gMSkgcHJvY2Vzc2Vzcy5cbiAqIFRoZSB0YXNrIGlzIGRvbmUgaW4gbXVsdGlwbGUgcHJvY2Vzc2VzcyB0byBzcGVlZCB1cCB0aGUgb3ZlcmFsbCB0aW1lIG9mIHRoZSB0YXNrLCBhcyBydW5uaW5nXG4gKiBhY3Jvc3MgZW50aXJlIHJlcG9zaXRvcmllcyB0YWtlcyBhIGxhcmdlIGFtb3VudCBvZiB0aW1lLlxuICogQXMgYSBkYXRhIHBvaW50IGZvciBpbGx1c3RyYXRpb24sIHVzaW5nIDggcHJvY2VzcyByYXRoZXIgdGhhbiAxIGN1dCB0aGUgZXhlY3V0aW9uXG4gKiB0aW1lIGZyb20gMjc2IHNlY29uZHMgdG8gMzkgc2Vjb25kcyBmb3IgdGhlIHNhbWUgMjcwMCBmaWxlcy5cbiAqXG4gKiBBIHByb21pc2UgaXMgcmV0dXJuZWQsIGNvbXBsZXRlZCB3aGVuIHRoZSBjb21tYW5kIGhhcyBjb21wbGV0ZWQgcnVubmluZyBmb3IgZWFjaCBmaWxlLlxuICogVGhlIHByb21pc2UgcmVzb2x2ZXMgd2l0aCBhIGxpc3Qgb2YgZmFpbHVyZXMsIG9yIGBmYWxzZWAgaWYgbm8gZm9ybWF0dGVycyBoYXZlIG1hdGNoZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBydW5Gb3JtYXR0ZXJJblBhcmFsbGVsKGFsbEZpbGVzOiBzdHJpbmdbXSwgYWN0aW9uOiBGb3JtYXR0ZXJBY3Rpb24pIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlPGZhbHNlIHwgRm9ybWF0RmFpbHVyZVtdPihhc3luYyAocmVzb2x2ZSkgPT4ge1xuICAgIGNvbnN0IGZvcm1hdHRlcnMgPSBhd2FpdCBnZXRBY3RpdmVGb3JtYXR0ZXJzKCk7XG4gICAgY29uc3QgZmFpbHVyZXM6IEZvcm1hdEZhaWx1cmVbXSA9IFtdO1xuICAgIGNvbnN0IHBlbmRpbmdDb21tYW5kczoge2Zvcm1hdHRlcjogRm9ybWF0dGVyOyBmaWxlOiBzdHJpbmd9W10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgZm9ybWF0dGVyIG9mIGZvcm1hdHRlcnMpIHtcbiAgICAgIHBlbmRpbmdDb21tYW5kcy5wdXNoKFxuICAgICAgICAuLi5tdWx0aW1hdGNoXG4gICAgICAgICAgLmNhbGwodW5kZWZpbmVkLCBhbGxGaWxlcywgZm9ybWF0dGVyLmdldEZpbGVNYXRjaGVyKCksIHtkb3Q6IHRydWV9KVxuICAgICAgICAgIC5tYXAoKGZpbGUpID0+ICh7Zm9ybWF0dGVyLCBmaWxlfSkpLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBJZiBubyBjb21tYW5kcyBhcmUgZ2VuZXJhdGVkLCByZXNvbHZlIHRoZSBwcm9taXNlIGFzIGBmYWxzZWAgYXMgbm8gZmlsZXNcbiAgICAvLyB3ZXJlIHJ1biBhZ2FpbnN0IHRoZSBhbnkgZm9ybWF0dGVycy5cbiAgICBpZiAocGVuZGluZ0NvbW1hbmRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHJlc29sdmUoZmFsc2UpO1xuICAgIH1cblxuICAgIHN3aXRjaCAoYWN0aW9uKSB7XG4gICAgICBjYXNlICdmb3JtYXQnOlxuICAgICAgICBMb2cuaW5mbyhgRm9ybWF0dGluZyAke3BlbmRpbmdDb21tYW5kcy5sZW5ndGh9IGZpbGUocylgKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdjaGVjayc6XG4gICAgICAgIExvZy5pbmZvKGBDaGVja2luZyBmb3JtYXQgb2YgJHtwZW5kaW5nQ29tbWFuZHMubGVuZ3RofSBmaWxlKHMpYCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgRXJyb3IoYEludmFsaWQgZm9ybWF0IGFjdGlvbiBcIiR7YWN0aW9ufVwiOiBhbGxvd2VkIGFjdGlvbnMgYXJlIFwiZm9ybWF0XCIgYW5kIFwiY2hlY2tcImApO1xuICAgIH1cblxuICAgIC8vIFRoZSBwcm9ncmVzcyBiYXIgaW5zdGFuY2UgdG8gdXNlIGZvciBwcm9ncmVzcyB0cmFja2luZy5cbiAgICBjb25zdCBwcm9ncmVzc0JhciA9IG5ldyBCYXIoe1xuICAgICAgZm9ybWF0OiBgW3tiYXJ9XSBFVEE6IHtldGF9cyB8IHt2YWx1ZX0ve3RvdGFsfSBmaWxlc2AsXG4gICAgICBjbGVhck9uQ29tcGxldGU6IHRydWUsXG4gICAgfSk7XG4gICAgLy8gQSBsb2NhbCBjb3B5IG9mIHRoZSBmaWxlcyB0byBydW4gdGhlIGNvbW1hbmQgb24uXG4gICAgLy8gQW4gYXJyYXkgdG8gcmVwcmVzZW50IHRoZSBjdXJyZW50IHVzYWdlIHN0YXRlIG9mIGVhY2ggb2YgdGhlIHRocmVhZHMgZm9yIHBhcmFsbGVsaXphdGlvbi5cbiAgICBjb25zdCB0aHJlYWRzID0gbmV3IEFycmF5PGJvb2xlYW4+KEFWQUlMQUJMRV9USFJFQURTKS5maWxsKGZhbHNlKTtcblxuICAgIC8vIFJlY3Vyc2l2ZWx5IHJ1biB0aGUgY29tbWFuZCBvbiB0aGUgbmV4dCBhdmFpbGFibGUgZmlsZSBmcm9tIHRoZSBsaXN0IHVzaW5nIHRoZSBwcm92aWRlZFxuICAgIC8vIHRocmVhZC5cbiAgICBmdW5jdGlvbiBydW5Db21tYW5kSW5UaHJlYWQodGhyZWFkOiBudW1iZXIpIHtcbiAgICAgIGNvbnN0IG5leHRDb21tYW5kID0gcGVuZGluZ0NvbW1hbmRzLnBvcCgpO1xuICAgICAgLy8gSWYgbm8gZmlsZSB3YXMgcHVsbGVkIGZyb20gdGhlIGFycmF5LCByZXR1cm4gYXMgdGhlcmUgYXJlIG5vIG1vcmUgZmlsZXMgdG8gcnVuIGFnYWluc3QuXG4gICAgICBpZiAobmV4dENvbW1hbmQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJlYWRzW3RocmVhZF0gPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBHZXQgdGhlIGZpbGUgYW5kIGZvcm1hdHRlciBmb3IgdGhlIG5leHQgY29tbWFuZC5cbiAgICAgIGNvbnN0IHtmaWxlLCBmb3JtYXR0ZXJ9ID0gbmV4dENvbW1hbmQ7XG5cbiAgICAgIGNvbnN0IFtzcGF3bkNtZCwgLi4uc3Bhd25BcmdzXSA9IFsuLi5mb3JtYXR0ZXIuY29tbWFuZEZvcihhY3Rpb24pLnNwbGl0KCcgJyksIGZpbGVdO1xuXG4gICAgICBDaGlsZFByb2Nlc3Muc3Bhd24oc3Bhd25DbWQsIHNwYXduQXJncywge1xuICAgICAgICBzdXBwcmVzc0Vycm9yT25GYWlsaW5nRXhpdENvZGU6IHRydWUsXG4gICAgICAgIG1vZGU6ICdzaWxlbnQnLFxuICAgICAgfSkudGhlbigoe3N0ZG91dCwgc3RkZXJyLCBzdGF0dXN9OiBTcGF3blJlc3VsdCkgPT4ge1xuICAgICAgICAvLyBSdW4gdGhlIHByb3ZpZGVkIGNhbGxiYWNrIGZ1bmN0aW9uLlxuICAgICAgICBjb25zdCBmYWlsZWQgPSBmb3JtYXR0ZXIuY2FsbGJhY2tGb3IoYWN0aW9uKShmaWxlLCBzdGF0dXMsIHN0ZG91dCwgc3RkZXJyKTtcbiAgICAgICAgaWYgKGZhaWxlZCkge1xuICAgICAgICAgIGZhaWx1cmVzLnB1c2goe2ZpbGVQYXRoOiBmaWxlLCBtZXNzYWdlOiBzdGRlcnJ9KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBOb3RlIGluIHRoZSBwcm9ncmVzcyBiYXIgYW5vdGhlciBmaWxlIGJlaW5nIGNvbXBsZXRlZC5cbiAgICAgICAgcHJvZ3Jlc3NCYXIuaW5jcmVtZW50KDEpO1xuICAgICAgICAvLyBJZiBtb3JlIGZpbGVzIGV4aXN0IGluIHRoZSBsaXN0LCBydW4gYWdhaW4gdG8gd29yayBvbiB0aGUgbmV4dCBmaWxlLFxuICAgICAgICAvLyB1c2luZyB0aGUgc2FtZSBzbG90LlxuICAgICAgICBpZiAocGVuZGluZ0NvbW1hbmRzLmxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiBydW5Db21tYW5kSW5UaHJlYWQodGhyZWFkKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBJZiBub3QgbW9yZSBmaWxlcyBhcmUgYXZhaWxhYmxlLCBtYXJrIHRoZSB0aHJlYWQgYXMgdW51c2VkLlxuICAgICAgICB0aHJlYWRzW3RocmVhZF0gPSBmYWxzZTtcbiAgICAgICAgLy8gSWYgYWxsIG9mIHRoZSB0aHJlYWRzIGFyZSBmYWxzZSwgYXMgdGhleSBhcmUgdW51c2VkLCBtYXJrIHRoZSBwcm9ncmVzcyBiYXJcbiAgICAgICAgLy8gY29tcGxldGVkIGFuZCByZXNvbHZlIHRoZSBwcm9taXNlLlxuICAgICAgICBpZiAodGhyZWFkcy5ldmVyeSgoYWN0aXZlKSA9PiAhYWN0aXZlKSkge1xuICAgICAgICAgIHByb2dyZXNzQmFyLnN0b3AoKTtcbiAgICAgICAgICByZXNvbHZlKGZhaWx1cmVzKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICAvLyBNYXJrIHRoZSB0aHJlYWQgYXMgaW4gdXNlIGFzIHRoZSBjb21tYW5kIGV4ZWN1dGlvbiBoYXMgYmVlbiBzdGFydGVkLlxuICAgICAgdGhyZWFkc1t0aHJlYWRdID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBTdGFydCB0aGUgcHJvZ3Jlc3MgYmFyXG4gICAgcHJvZ3Jlc3NCYXIuc3RhcnQocGVuZGluZ0NvbW1hbmRzLmxlbmd0aCwgMCk7XG4gICAgLy8gU3RhcnQgcnVubmluZyB0aGUgY29tbWFuZCBvbiBmaWxlcyBmcm9tIHRoZSBsZWFzdCBpbiBlYWNoIGF2YWlsYWJsZSB0aHJlYWQuXG4gICAgdGhyZWFkcy5mb3JFYWNoKChfLCBpZHgpID0+IHJ1bkNvbW1hbmRJblRocmVhZChpZHgpKTtcbiAgfSk7XG59XG4iXX0=