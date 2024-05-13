/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import supportsColor from 'supports-color';
import { spawn as _spawn, spawnSync as _spawnSync, } from 'child_process';
import { Log } from './logging.js';
/** Class holding utilities for spawning child processes. */
export class ChildProcess {
    /**
     * Spawns a given command with the specified arguments inside an interactive shell. All process
     * stdin, stdout and stderr output is printed to the current console.
     *
     * @returns a Promise resolving on success, and rejecting on command failure with the status code.
     */
    static spawnInteractive(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const commandText = `${command} ${args.join(' ')}`;
            Log.debug(`Executing command: ${commandText}`);
            const childProcess = _spawn(command, args, { ...options, shell: true, stdio: 'inherit' });
            // The `close` event is used because the process is guaranteed to have completed writing to
            // stdout and stderr, using the `exit` event can cause inconsistent information in stdout and
            // stderr due to a race condition around exiting.
            childProcess.on('close', (status) => (status === 0 ? resolve() : reject(status)));
        });
    }
    /**
     * Spawns a given command with the specified arguments inside a shell. All process stdout
     * output is captured and returned as resolution on completion. Depending on the chosen
     * output mode, stdout/stderr output is also printed to the console, or only on error.
     *
     * @returns a Promise resolving with captured stdout and stderr on success. The promise
     *   rejects on command failure.
     */
    static spawn(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const commandText = `${command} ${args.join(' ')}`;
            const outputMode = options.mode;
            const env = getEnvironmentForNonInteractiveSpawn(options.env);
            Log.debug(`Executing command: ${commandText}`);
            const childProcess = _spawn(command, args, { ...options, env, shell: true, stdio: 'pipe' });
            let logOutput = '';
            let stdout = '';
            let stderr = '';
            // If provided, write `input` text to the process `stdin`.
            if (options.input !== undefined) {
                childProcess.stdin.write(options.input);
                childProcess.stdin.end();
            }
            // Capture the stdout separately so that it can be passed as resolve value.
            // This is useful if commands return parsable stdout.
            childProcess.stderr.on('data', (message) => {
                stderr += message;
                logOutput += message;
                // If console output is enabled, print the message directly to the stderr. Note that
                // we intentionally print all output to stderr as stdout should not be polluted.
                if (outputMode === undefined || outputMode === 'enabled') {
                    process.stderr.write(message);
                }
            });
            childProcess.stdout.on('data', (message) => {
                stdout += message;
                logOutput += message;
                // If console output is enabled, print the message directly to the stderr. Note that
                // we intentionally print all output to stderr as stdout should not be polluted.
                if (outputMode === undefined || outputMode === 'enabled') {
                    process.stderr.write(message);
                }
            });
            // The `close` event is used because the process is guaranteed to have completed writing to
            // stdout and stderr, using the `exit` event can cause inconsistent information in stdout and
            // stderr due to a race condition around exiting.
            childProcess.on('close', (exitCode, signal) => {
                const exitDescription = exitCode !== null ? `exit code "${exitCode}"` : `signal "${signal}"`;
                const printFn = outputMode === 'on-error' ? Log.error : Log.debug;
                const status = statusFromExitCodeAndSignal(exitCode, signal);
                printFn(`Command "${commandText}" completed with ${exitDescription}.`);
                printFn(`Process output: \n${logOutput}`);
                // On success, resolve the promise. Otherwise reject with the captured stderr
                // and stdout log output if the output mode was set to `silent`.
                if (status === 0 || options.suppressErrorOnFailingExitCode) {
                    resolve({ stdout, stderr, status });
                }
                else {
                    reject(outputMode === 'silent' ? logOutput : undefined);
                }
            });
        });
    }
    /**
     * Spawns a given command with the specified arguments inside a shell synchronously.
     *
     * @returns The command's stdout and stderr.
     */
    static spawnSync(command, args, options = {}) {
        const commandText = `${command} ${args.join(' ')}`;
        const env = getEnvironmentForNonInteractiveSpawn(options.env);
        Log.debug(`Executing command: ${commandText}`);
        const { status: exitCode, signal, stdout, stderr, } = _spawnSync(command, args, { ...options, env, encoding: 'utf8', shell: true, stdio: 'pipe' });
        /** The status of the spawn result. */
        const status = statusFromExitCodeAndSignal(exitCode, signal);
        if (status === 0 || options.suppressErrorOnFailingExitCode) {
            return { status, stdout, stderr };
        }
        throw new Error(stderr);
    }
}
/**
 * Convert the provided exitCode and signal to a single status code.
 *
 * During `exit` node provides either a `code` or `signal`, one of which is guaranteed to be
 * non-null.
 *
 * For more details see: https://nodejs.org/api/child_process.html#child_process_event_exit
 */
function statusFromExitCodeAndSignal(exitCode, signal) {
    return exitCode ?? signal ?? -1;
}
/**
 * Gets a process environment object with defaults that can be used for
 * spawning non-interactive child processes.
 *
 * Currently we enable `FORCE_COLOR` since non-interactive spawn's with
 * non-inherited `stdio` will not have colors enabled due to a missing TTY.
 */
function getEnvironmentForNonInteractiveSpawn(userProvidedEnv) {
    // Pass through the color level from the TTY/process performing the `spawn` call.
    const forceColorValue = supportsColor.stdout !== false ? supportsColor.stdout.level.toString() : undefined;
    return { FORCE_COLOR: forceColorValue, ...(userProvidedEnv ?? process.env) };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hpbGQtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25nLWRldi91dGlscy9jaGlsZC1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sYUFBYSxNQUFNLGdCQUFnQixDQUFDO0FBQzNDLE9BQU8sRUFDTCxLQUFLLElBQUksTUFBTSxFQUVmLFNBQVMsSUFBSSxVQUFVLEdBRXhCLE1BQU0sZUFBZSxDQUFDO0FBQ3ZCLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFnQ2pDLDREQUE0RDtBQUM1RCxNQUFNLE9BQWdCLFlBQVk7SUFDaEM7Ozs7O09BS0c7SUFDSCxNQUFNLENBQUMsZ0JBQWdCLENBQ3JCLE9BQWUsRUFDZixJQUFjLEVBQ2QsVUFBMEMsRUFBRTtRQUU1QyxPQUFPLElBQUksT0FBTyxDQUFPLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQzNDLE1BQU0sV0FBVyxHQUFHLEdBQUcsT0FBTyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNuRCxHQUFHLENBQUMsS0FBSyxDQUFDLHNCQUFzQixXQUFXLEVBQUUsQ0FBQyxDQUFDO1lBQy9DLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLEVBQUMsR0FBRyxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDLENBQUMsQ0FBQztZQUN4RiwyRkFBMkY7WUFDM0YsNkZBQTZGO1lBQzdGLGlEQUFpRDtZQUNqRCxZQUFZLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0gsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFlLEVBQUUsSUFBYyxFQUFFLFVBQXdCLEVBQUU7UUFDdEUsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUNyQyxNQUFNLFdBQVcsR0FBRyxHQUFHLE9BQU8sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDbkQsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQztZQUNoQyxNQUFNLEdBQUcsR0FBRyxvQ0FBb0MsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7WUFFOUQsR0FBRyxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsV0FBVyxFQUFFLENBQUMsQ0FBQztZQUUvQyxNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxFQUFDLEdBQUcsT0FBTyxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUMsQ0FBQyxDQUFDO1lBQzFGLElBQUksU0FBUyxHQUFHLEVBQUUsQ0FBQztZQUNuQixJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7WUFDaEIsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO1lBRWhCLDBEQUEwRDtZQUMxRCxJQUFJLE9BQU8sQ0FBQyxLQUFLLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQ2hDLFlBQVksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDeEMsWUFBWSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUMzQixDQUFDO1lBRUQsMkVBQTJFO1lBQzNFLHFEQUFxRDtZQUNyRCxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRTtnQkFDekMsTUFBTSxJQUFJLE9BQU8sQ0FBQztnQkFDbEIsU0FBUyxJQUFJLE9BQU8sQ0FBQztnQkFDckIsb0ZBQW9GO2dCQUNwRixnRkFBZ0Y7Z0JBQ2hGLElBQUksVUFBVSxLQUFLLFNBQVMsSUFBSSxVQUFVLEtBQUssU0FBUyxFQUFFLENBQUM7b0JBQ3pELE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNoQyxDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxZQUFZLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRTtnQkFDekMsTUFBTSxJQUFJLE9BQU8sQ0FBQztnQkFDbEIsU0FBUyxJQUFJLE9BQU8sQ0FBQztnQkFDckIsb0ZBQW9GO2dCQUNwRixnRkFBZ0Y7Z0JBQ2hGLElBQUksVUFBVSxLQUFLLFNBQVMsSUFBSSxVQUFVLEtBQUssU0FBUyxFQUFFLENBQUM7b0JBQ3pELE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNoQyxDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCwyRkFBMkY7WUFDM0YsNkZBQTZGO1lBQzdGLGlEQUFpRDtZQUNqRCxZQUFZLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUUsRUFBRTtnQkFDNUMsTUFBTSxlQUFlLEdBQ25CLFFBQVEsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLGNBQWMsUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDLFdBQVcsTUFBTSxHQUFHLENBQUM7Z0JBQ3ZFLE1BQU0sT0FBTyxHQUFHLFVBQVUsS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUM7Z0JBQ2xFLE1BQU0sTUFBTSxHQUFHLDJCQUEyQixDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFFN0QsT0FBTyxDQUFDLFlBQVksV0FBVyxvQkFBb0IsZUFBZSxHQUFHLENBQUMsQ0FBQztnQkFDdkUsT0FBTyxDQUFDLHFCQUFxQixTQUFTLEVBQUUsQ0FBQyxDQUFDO2dCQUUxQyw2RUFBNkU7Z0JBQzdFLGdFQUFnRTtnQkFDaEUsSUFBSSxNQUFNLEtBQUssQ0FBQyxJQUFJLE9BQU8sQ0FBQyw4QkFBOEIsRUFBRSxDQUFDO29CQUMzRCxPQUFPLENBQUMsRUFBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBQyxDQUFDLENBQUM7Z0JBQ3BDLENBQUM7cUJBQU0sQ0FBQztvQkFDTixNQUFNLENBQUMsVUFBVSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDMUQsQ0FBQztZQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBZSxFQUFFLElBQWMsRUFBRSxVQUE0QixFQUFFO1FBQzlFLE1BQU0sV0FBVyxHQUFHLEdBQUcsT0FBTyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztRQUNuRCxNQUFNLEdBQUcsR0FBRyxvQ0FBb0MsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFOUQsR0FBRyxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUUvQyxNQUFNLEVBQ0osTUFBTSxFQUFFLFFBQVEsRUFDaEIsTUFBTSxFQUNOLE1BQU0sRUFDTixNQUFNLEdBQ1AsR0FBRyxVQUFVLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxFQUFDLEdBQUcsT0FBTyxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBQyxDQUFDLENBQUM7UUFFL0Ysc0NBQXNDO1FBQ3RDLE1BQU0sTUFBTSxHQUFHLDJCQUEyQixDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUU3RCxJQUFJLE1BQU0sS0FBSyxDQUFDLElBQUksT0FBTyxDQUFDLDhCQUE4QixFQUFFLENBQUM7WUFDM0QsT0FBTyxFQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFDLENBQUM7UUFDbEMsQ0FBQztRQUVELE1BQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDMUIsQ0FBQztDQUNGO0FBQ0Q7Ozs7Ozs7R0FPRztBQUNILFNBQVMsMkJBQTJCLENBQUMsUUFBdUIsRUFBRSxNQUE2QjtJQUN6RixPQUFPLFFBQVEsSUFBSSxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDbEMsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILFNBQVMsb0NBQW9DLENBQzNDLGVBQW1DO0lBRW5DLGlGQUFpRjtJQUNqRixNQUFNLGVBQWUsR0FDbkIsYUFBYSxDQUFDLE1BQU0sS0FBSyxLQUFLLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFFckYsT0FBTyxFQUFDLFdBQVcsRUFBRSxlQUFlLEVBQUUsR0FBRyxDQUFDLGVBQWUsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUMsQ0FBQztBQUM3RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBzdXBwb3J0c0NvbG9yIGZyb20gJ3N1cHBvcnRzLWNvbG9yJztcbmltcG9ydCB7XG4gIHNwYXduIGFzIF9zcGF3bixcbiAgU3Bhd25PcHRpb25zIGFzIF9TcGF3bk9wdGlvbnMsXG4gIHNwYXduU3luYyBhcyBfc3Bhd25TeW5jLFxuICBTcGF3blN5bmNPcHRpb25zIGFzIF9TcGF3blN5bmNPcHRpb25zLFxufSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7TG9nfSBmcm9tICcuL2xvZ2dpbmcuanMnO1xuXG4vKiogSW50ZXJmYWNlIGRlc2NyaWJpbmcgdGhlIG9wdGlvbnMgZm9yIHNwYXduaW5nIGEgcHJvY2VzcyBzeW5jaHJvbm91c2x5LiAqL1xuZXhwb3J0IGludGVyZmFjZSBTcGF3blN5bmNPcHRpb25zIGV4dGVuZHMgT21pdDxfU3Bhd25TeW5jT3B0aW9ucywgJ3NoZWxsJyB8ICdzdGRpbyc+IHtcbiAgLyoqIFdoZXRoZXIgdG8gcHJldmVudCBleGl0IGNvZGVzIGJlaW5nIHRyZWF0ZWQgYXMgZmFpbHVyZXMuICovXG4gIHN1cHByZXNzRXJyb3JPbkZhaWxpbmdFeGl0Q29kZT86IGJvb2xlYW47XG59XG5cbi8qKiBJbnRlcmZhY2UgZGVzY3JpYmluZyB0aGUgb3B0aW9ucyBmb3Igc3Bhd25pbmcgYSBwcm9jZXNzLiAqL1xuZXhwb3J0IGludGVyZmFjZSBTcGF3bk9wdGlvbnMgZXh0ZW5kcyBPbWl0PF9TcGF3bk9wdGlvbnMsICdzaGVsbCcgfCAnc3RkaW8nPiB7XG4gIC8qKiBDb25zb2xlIG91dHB1dCBtb2RlLiBEZWZhdWx0cyB0byBcImVuYWJsZWRcIi4gKi9cbiAgbW9kZT86ICdlbmFibGVkJyB8ICdzaWxlbnQnIHwgJ29uLWVycm9yJztcbiAgLyoqIFdoZXRoZXIgdG8gcHJldmVudCBleGl0IGNvZGVzIGJlaW5nIHRyZWF0ZWQgYXMgZmFpbHVyZXMuICovXG4gIHN1cHByZXNzRXJyb3JPbkZhaWxpbmdFeGl0Q29kZT86IGJvb2xlYW47XG4gIC8vIFN0ZGluIHRleHQgdG8gcHJvdmlkZSB0byB0aGUgcHJvY2Vzcy4gVGhlIHJhdyB0ZXh0IHdpbGwgYmUgd3JpdHRlbiB0byBgc3RkaW5gIGFuZCB0aGVuXG4gIC8vIHRoZSBzdHJlYW0gaXMgY2xvc2VkLiBUaGlzIGlzIGVxdWl2YWxlbnQgdG8gdGhlIGBpbnB1dGAgb3B0aW9uIGZyb20gYFNwYXduU3luY09wdGlvbmAuXG4gIGlucHV0Pzogc3RyaW5nO1xufVxuXG4vKiogSW50ZXJmYWNlIGRlc2NyaWJpbmcgdGhlIG9wdGlvbnMgZm9yIHNwYXduaW5nIGFuIGludGVyYWN0aXZlIHByb2Nlc3MuICovXG5leHBvcnQgdHlwZSBTcGF3bkludGVyYWN0aXZlQ29tbWFuZE9wdGlvbnMgPSBPbWl0PF9TcGF3bk9wdGlvbnMsICdzaGVsbCcgfCAnc3RkaW8nPjtcblxuLyoqIEludGVyZmFjZSBkZXNjcmliaW5nIHRoZSByZXN1bHQgb2YgYSBzcGF3bmVkIHByb2Nlc3MuICovXG5leHBvcnQgaW50ZXJmYWNlIFNwYXduUmVzdWx0IHtcbiAgLyoqIENhcHR1cmVkIHN0ZG91dCBpbiBzdHJpbmcgZm9ybWF0LiAqL1xuICBzdGRvdXQ6IHN0cmluZztcbiAgLyoqIENhcHR1cmVkIHN0ZGVyciBpbiBzdHJpbmcgZm9ybWF0LiAqL1xuICBzdGRlcnI6IHN0cmluZztcbiAgLyoqIFRoZSBleGl0IGNvZGUgb3Igc2lnbmFsIG9mIHRoZSBwcm9jZXNzLiAqL1xuICBzdGF0dXM6IG51bWJlciB8IE5vZGVKUy5TaWduYWxzO1xufVxuXG4vKiogQ2xhc3MgaG9sZGluZyB1dGlsaXRpZXMgZm9yIHNwYXduaW5nIGNoaWxkIHByb2Nlc3Nlcy4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBDaGlsZFByb2Nlc3Mge1xuICAvKipcbiAgICogU3Bhd25zIGEgZ2l2ZW4gY29tbWFuZCB3aXRoIHRoZSBzcGVjaWZpZWQgYXJndW1lbnRzIGluc2lkZSBhbiBpbnRlcmFjdGl2ZSBzaGVsbC4gQWxsIHByb2Nlc3NcbiAgICogc3RkaW4sIHN0ZG91dCBhbmQgc3RkZXJyIG91dHB1dCBpcyBwcmludGVkIHRvIHRoZSBjdXJyZW50IGNvbnNvbGUuXG4gICAqXG4gICAqIEByZXR1cm5zIGEgUHJvbWlzZSByZXNvbHZpbmcgb24gc3VjY2VzcywgYW5kIHJlamVjdGluZyBvbiBjb21tYW5kIGZhaWx1cmUgd2l0aCB0aGUgc3RhdHVzIGNvZGUuXG4gICAqL1xuICBzdGF0aWMgc3Bhd25JbnRlcmFjdGl2ZShcbiAgICBjb21tYW5kOiBzdHJpbmcsXG4gICAgYXJnczogc3RyaW5nW10sXG4gICAgb3B0aW9uczogU3Bhd25JbnRlcmFjdGl2ZUNvbW1hbmRPcHRpb25zID0ge30sXG4gICkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCBjb21tYW5kVGV4dCA9IGAke2NvbW1hbmR9ICR7YXJncy5qb2luKCcgJyl9YDtcbiAgICAgIExvZy5kZWJ1ZyhgRXhlY3V0aW5nIGNvbW1hbmQ6ICR7Y29tbWFuZFRleHR9YCk7XG4gICAgICBjb25zdCBjaGlsZFByb2Nlc3MgPSBfc3Bhd24oY29tbWFuZCwgYXJncywgey4uLm9wdGlvbnMsIHNoZWxsOiB0cnVlLCBzdGRpbzogJ2luaGVyaXQnfSk7XG4gICAgICAvLyBUaGUgYGNsb3NlYCBldmVudCBpcyB1c2VkIGJlY2F1c2UgdGhlIHByb2Nlc3MgaXMgZ3VhcmFudGVlZCB0byBoYXZlIGNvbXBsZXRlZCB3cml0aW5nIHRvXG4gICAgICAvLyBzdGRvdXQgYW5kIHN0ZGVyciwgdXNpbmcgdGhlIGBleGl0YCBldmVudCBjYW4gY2F1c2UgaW5jb25zaXN0ZW50IGluZm9ybWF0aW9uIGluIHN0ZG91dCBhbmRcbiAgICAgIC8vIHN0ZGVyciBkdWUgdG8gYSByYWNlIGNvbmRpdGlvbiBhcm91bmQgZXhpdGluZy5cbiAgICAgIGNoaWxkUHJvY2Vzcy5vbignY2xvc2UnLCAoc3RhdHVzKSA9PiAoc3RhdHVzID09PSAwID8gcmVzb2x2ZSgpIDogcmVqZWN0KHN0YXR1cykpKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTcGF3bnMgYSBnaXZlbiBjb21tYW5kIHdpdGggdGhlIHNwZWNpZmllZCBhcmd1bWVudHMgaW5zaWRlIGEgc2hlbGwuIEFsbCBwcm9jZXNzIHN0ZG91dFxuICAgKiBvdXRwdXQgaXMgY2FwdHVyZWQgYW5kIHJldHVybmVkIGFzIHJlc29sdXRpb24gb24gY29tcGxldGlvbi4gRGVwZW5kaW5nIG9uIHRoZSBjaG9zZW5cbiAgICogb3V0cHV0IG1vZGUsIHN0ZG91dC9zdGRlcnIgb3V0cHV0IGlzIGFsc28gcHJpbnRlZCB0byB0aGUgY29uc29sZSwgb3Igb25seSBvbiBlcnJvci5cbiAgICpcbiAgICogQHJldHVybnMgYSBQcm9taXNlIHJlc29sdmluZyB3aXRoIGNhcHR1cmVkIHN0ZG91dCBhbmQgc3RkZXJyIG9uIHN1Y2Nlc3MuIFRoZSBwcm9taXNlXG4gICAqICAgcmVqZWN0cyBvbiBjb21tYW5kIGZhaWx1cmUuXG4gICAqL1xuICBzdGF0aWMgc3Bhd24oY29tbWFuZDogc3RyaW5nLCBhcmdzOiBzdHJpbmdbXSwgb3B0aW9uczogU3Bhd25PcHRpb25zID0ge30pOiBQcm9taXNlPFNwYXduUmVzdWx0PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGNvbW1hbmRUZXh0ID0gYCR7Y29tbWFuZH0gJHthcmdzLmpvaW4oJyAnKX1gO1xuICAgICAgY29uc3Qgb3V0cHV0TW9kZSA9IG9wdGlvbnMubW9kZTtcbiAgICAgIGNvbnN0IGVudiA9IGdldEVudmlyb25tZW50Rm9yTm9uSW50ZXJhY3RpdmVTcGF3bihvcHRpb25zLmVudik7XG5cbiAgICAgIExvZy5kZWJ1ZyhgRXhlY3V0aW5nIGNvbW1hbmQ6ICR7Y29tbWFuZFRleHR9YCk7XG5cbiAgICAgIGNvbnN0IGNoaWxkUHJvY2VzcyA9IF9zcGF3bihjb21tYW5kLCBhcmdzLCB7Li4ub3B0aW9ucywgZW52LCBzaGVsbDogdHJ1ZSwgc3RkaW86ICdwaXBlJ30pO1xuICAgICAgbGV0IGxvZ091dHB1dCA9ICcnO1xuICAgICAgbGV0IHN0ZG91dCA9ICcnO1xuICAgICAgbGV0IHN0ZGVyciA9ICcnO1xuXG4gICAgICAvLyBJZiBwcm92aWRlZCwgd3JpdGUgYGlucHV0YCB0ZXh0IHRvIHRoZSBwcm9jZXNzIGBzdGRpbmAuXG4gICAgICBpZiAob3B0aW9ucy5pbnB1dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5zdGRpbi53cml0ZShvcHRpb25zLmlucHV0KTtcbiAgICAgICAgY2hpbGRQcm9jZXNzLnN0ZGluLmVuZCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBDYXB0dXJlIHRoZSBzdGRvdXQgc2VwYXJhdGVseSBzbyB0aGF0IGl0IGNhbiBiZSBwYXNzZWQgYXMgcmVzb2x2ZSB2YWx1ZS5cbiAgICAgIC8vIFRoaXMgaXMgdXNlZnVsIGlmIGNvbW1hbmRzIHJldHVybiBwYXJzYWJsZSBzdGRvdXQuXG4gICAgICBjaGlsZFByb2Nlc3Muc3RkZXJyLm9uKCdkYXRhJywgKG1lc3NhZ2UpID0+IHtcbiAgICAgICAgc3RkZXJyICs9IG1lc3NhZ2U7XG4gICAgICAgIGxvZ091dHB1dCArPSBtZXNzYWdlO1xuICAgICAgICAvLyBJZiBjb25zb2xlIG91dHB1dCBpcyBlbmFibGVkLCBwcmludCB0aGUgbWVzc2FnZSBkaXJlY3RseSB0byB0aGUgc3RkZXJyLiBOb3RlIHRoYXRcbiAgICAgICAgLy8gd2UgaW50ZW50aW9uYWxseSBwcmludCBhbGwgb3V0cHV0IHRvIHN0ZGVyciBhcyBzdGRvdXQgc2hvdWxkIG5vdCBiZSBwb2xsdXRlZC5cbiAgICAgICAgaWYgKG91dHB1dE1vZGUgPT09IHVuZGVmaW5lZCB8fCBvdXRwdXRNb2RlID09PSAnZW5hYmxlZCcpIHtcbiAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGNoaWxkUHJvY2Vzcy5zdGRvdXQub24oJ2RhdGEnLCAobWVzc2FnZSkgPT4ge1xuICAgICAgICBzdGRvdXQgKz0gbWVzc2FnZTtcbiAgICAgICAgbG9nT3V0cHV0ICs9IG1lc3NhZ2U7XG4gICAgICAgIC8vIElmIGNvbnNvbGUgb3V0cHV0IGlzIGVuYWJsZWQsIHByaW50IHRoZSBtZXNzYWdlIGRpcmVjdGx5IHRvIHRoZSBzdGRlcnIuIE5vdGUgdGhhdFxuICAgICAgICAvLyB3ZSBpbnRlbnRpb25hbGx5IHByaW50IGFsbCBvdXRwdXQgdG8gc3RkZXJyIGFzIHN0ZG91dCBzaG91bGQgbm90IGJlIHBvbGx1dGVkLlxuICAgICAgICBpZiAob3V0cHV0TW9kZSA9PT0gdW5kZWZpbmVkIHx8IG91dHB1dE1vZGUgPT09ICdlbmFibGVkJykge1xuICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKG1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gVGhlIGBjbG9zZWAgZXZlbnQgaXMgdXNlZCBiZWNhdXNlIHRoZSBwcm9jZXNzIGlzIGd1YXJhbnRlZWQgdG8gaGF2ZSBjb21wbGV0ZWQgd3JpdGluZyB0b1xuICAgICAgLy8gc3Rkb3V0IGFuZCBzdGRlcnIsIHVzaW5nIHRoZSBgZXhpdGAgZXZlbnQgY2FuIGNhdXNlIGluY29uc2lzdGVudCBpbmZvcm1hdGlvbiBpbiBzdGRvdXQgYW5kXG4gICAgICAvLyBzdGRlcnIgZHVlIHRvIGEgcmFjZSBjb25kaXRpb24gYXJvdW5kIGV4aXRpbmcuXG4gICAgICBjaGlsZFByb2Nlc3Mub24oJ2Nsb3NlJywgKGV4aXRDb2RlLCBzaWduYWwpID0+IHtcbiAgICAgICAgY29uc3QgZXhpdERlc2NyaXB0aW9uID1cbiAgICAgICAgICBleGl0Q29kZSAhPT0gbnVsbCA/IGBleGl0IGNvZGUgXCIke2V4aXRDb2RlfVwiYCA6IGBzaWduYWwgXCIke3NpZ25hbH1cImA7XG4gICAgICAgIGNvbnN0IHByaW50Rm4gPSBvdXRwdXRNb2RlID09PSAnb24tZXJyb3InID8gTG9nLmVycm9yIDogTG9nLmRlYnVnO1xuICAgICAgICBjb25zdCBzdGF0dXMgPSBzdGF0dXNGcm9tRXhpdENvZGVBbmRTaWduYWwoZXhpdENvZGUsIHNpZ25hbCk7XG5cbiAgICAgICAgcHJpbnRGbihgQ29tbWFuZCBcIiR7Y29tbWFuZFRleHR9XCIgY29tcGxldGVkIHdpdGggJHtleGl0RGVzY3JpcHRpb259LmApO1xuICAgICAgICBwcmludEZuKGBQcm9jZXNzIG91dHB1dDogXFxuJHtsb2dPdXRwdXR9YCk7XG5cbiAgICAgICAgLy8gT24gc3VjY2VzcywgcmVzb2x2ZSB0aGUgcHJvbWlzZS4gT3RoZXJ3aXNlIHJlamVjdCB3aXRoIHRoZSBjYXB0dXJlZCBzdGRlcnJcbiAgICAgICAgLy8gYW5kIHN0ZG91dCBsb2cgb3V0cHV0IGlmIHRoZSBvdXRwdXQgbW9kZSB3YXMgc2V0IHRvIGBzaWxlbnRgLlxuICAgICAgICBpZiAoc3RhdHVzID09PSAwIHx8IG9wdGlvbnMuc3VwcHJlc3NFcnJvck9uRmFpbGluZ0V4aXRDb2RlKSB7XG4gICAgICAgICAgcmVzb2x2ZSh7c3Rkb3V0LCBzdGRlcnIsIHN0YXR1c30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlamVjdChvdXRwdXRNb2RlID09PSAnc2lsZW50JyA/IGxvZ091dHB1dCA6IHVuZGVmaW5lZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNwYXducyBhIGdpdmVuIGNvbW1hbmQgd2l0aCB0aGUgc3BlY2lmaWVkIGFyZ3VtZW50cyBpbnNpZGUgYSBzaGVsbCBzeW5jaHJvbm91c2x5LlxuICAgKlxuICAgKiBAcmV0dXJucyBUaGUgY29tbWFuZCdzIHN0ZG91dCBhbmQgc3RkZXJyLlxuICAgKi9cbiAgc3RhdGljIHNwYXduU3luYyhjb21tYW5kOiBzdHJpbmcsIGFyZ3M6IHN0cmluZ1tdLCBvcHRpb25zOiBTcGF3blN5bmNPcHRpb25zID0ge30pOiBTcGF3blJlc3VsdCB7XG4gICAgY29uc3QgY29tbWFuZFRleHQgPSBgJHtjb21tYW5kfSAke2FyZ3Muam9pbignICcpfWA7XG4gICAgY29uc3QgZW52ID0gZ2V0RW52aXJvbm1lbnRGb3JOb25JbnRlcmFjdGl2ZVNwYXduKG9wdGlvbnMuZW52KTtcblxuICAgIExvZy5kZWJ1ZyhgRXhlY3V0aW5nIGNvbW1hbmQ6ICR7Y29tbWFuZFRleHR9YCk7XG5cbiAgICBjb25zdCB7XG4gICAgICBzdGF0dXM6IGV4aXRDb2RlLFxuICAgICAgc2lnbmFsLFxuICAgICAgc3Rkb3V0LFxuICAgICAgc3RkZXJyLFxuICAgIH0gPSBfc3Bhd25TeW5jKGNvbW1hbmQsIGFyZ3MsIHsuLi5vcHRpb25zLCBlbnYsIGVuY29kaW5nOiAndXRmOCcsIHNoZWxsOiB0cnVlLCBzdGRpbzogJ3BpcGUnfSk7XG5cbiAgICAvKiogVGhlIHN0YXR1cyBvZiB0aGUgc3Bhd24gcmVzdWx0LiAqL1xuICAgIGNvbnN0IHN0YXR1cyA9IHN0YXR1c0Zyb21FeGl0Q29kZUFuZFNpZ25hbChleGl0Q29kZSwgc2lnbmFsKTtcblxuICAgIGlmIChzdGF0dXMgPT09IDAgfHwgb3B0aW9ucy5zdXBwcmVzc0Vycm9yT25GYWlsaW5nRXhpdENvZGUpIHtcbiAgICAgIHJldHVybiB7c3RhdHVzLCBzdGRvdXQsIHN0ZGVycn07XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKHN0ZGVycik7XG4gIH1cbn1cbi8qKlxuICogQ29udmVydCB0aGUgcHJvdmlkZWQgZXhpdENvZGUgYW5kIHNpZ25hbCB0byBhIHNpbmdsZSBzdGF0dXMgY29kZS5cbiAqXG4gKiBEdXJpbmcgYGV4aXRgIG5vZGUgcHJvdmlkZXMgZWl0aGVyIGEgYGNvZGVgIG9yIGBzaWduYWxgLCBvbmUgb2Ygd2hpY2ggaXMgZ3VhcmFudGVlZCB0byBiZVxuICogbm9uLW51bGwuXG4gKlxuICogRm9yIG1vcmUgZGV0YWlscyBzZWU6IGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvY2hpbGRfcHJvY2Vzcy5odG1sI2NoaWxkX3Byb2Nlc3NfZXZlbnRfZXhpdFxuICovXG5mdW5jdGlvbiBzdGF0dXNGcm9tRXhpdENvZGVBbmRTaWduYWwoZXhpdENvZGU6IG51bWJlciB8IG51bGwsIHNpZ25hbDogTm9kZUpTLlNpZ25hbHMgfCBudWxsKSB7XG4gIHJldHVybiBleGl0Q29kZSA/PyBzaWduYWwgPz8gLTE7XG59XG5cbi8qKlxuICogR2V0cyBhIHByb2Nlc3MgZW52aXJvbm1lbnQgb2JqZWN0IHdpdGggZGVmYXVsdHMgdGhhdCBjYW4gYmUgdXNlZCBmb3JcbiAqIHNwYXduaW5nIG5vbi1pbnRlcmFjdGl2ZSBjaGlsZCBwcm9jZXNzZXMuXG4gKlxuICogQ3VycmVudGx5IHdlIGVuYWJsZSBgRk9SQ0VfQ09MT1JgIHNpbmNlIG5vbi1pbnRlcmFjdGl2ZSBzcGF3bidzIHdpdGhcbiAqIG5vbi1pbmhlcml0ZWQgYHN0ZGlvYCB3aWxsIG5vdCBoYXZlIGNvbG9ycyBlbmFibGVkIGR1ZSB0byBhIG1pc3NpbmcgVFRZLlxuICovXG5mdW5jdGlvbiBnZXRFbnZpcm9ubWVudEZvck5vbkludGVyYWN0aXZlU3Bhd24oXG4gIHVzZXJQcm92aWRlZEVudj86IE5vZGVKUy5Qcm9jZXNzRW52LFxuKTogTm9kZUpTLlByb2Nlc3NFbnYge1xuICAvLyBQYXNzIHRocm91Z2ggdGhlIGNvbG9yIGxldmVsIGZyb20gdGhlIFRUWS9wcm9jZXNzIHBlcmZvcm1pbmcgdGhlIGBzcGF3bmAgY2FsbC5cbiAgY29uc3QgZm9yY2VDb2xvclZhbHVlID1cbiAgICBzdXBwb3J0c0NvbG9yLnN0ZG91dCAhPT0gZmFsc2UgPyBzdXBwb3J0c0NvbG9yLnN0ZG91dC5sZXZlbC50b1N0cmluZygpIDogdW5kZWZpbmVkO1xuXG4gIHJldHVybiB7Rk9SQ0VfQ09MT1I6IGZvcmNlQ29sb3JWYWx1ZSwgLi4uKHVzZXJQcm92aWRlZEVudiA/PyBwcm9jZXNzLmVudil9O1xufVxuIl19