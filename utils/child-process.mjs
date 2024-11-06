/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import supportsColor from 'supports-color';
import { spawn as _spawn, spawnSync as _spawnSync, exec as _exec, } from 'child_process';
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
            const env = getEnvironmentForNonInteractiveCommand(options.env);
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
        const env = getEnvironmentForNonInteractiveCommand(options.env);
        Log.debug(`Executing command: ${commandText}`);
        const { status: exitCode, signal, stdout, stderr, } = _spawnSync(command, args, { ...options, env, encoding: 'utf8', shell: true, stdio: 'pipe' });
        /** The status of the spawn result. */
        const status = statusFromExitCodeAndSignal(exitCode, signal);
        if (status === 0 || options.suppressErrorOnFailingExitCode) {
            return { status, stdout, stderr };
        }
        throw new Error(stderr);
    }
    static exec(command, options = {}) {
        return new Promise((resolve, reject) => {
            const outputMode = options.mode;
            const env = getEnvironmentForNonInteractiveCommand(options.env);
            Log.debug(`Executing command: ${command}`);
            const childProcess = _exec(command, { ...options, env });
            let logOutput = '';
            let stdout = '';
            let stderr = '';
            // Capture the stdout separately so that it can be passed as resolve value.
            // This is useful if commands return parsable stdout.
            childProcess.stderr?.on('data', (message) => {
                stderr += message;
                logOutput += message;
                // If console output is enabled, print the message directly to the stderr. Note that
                // we intentionally print all output to stderr as stdout should not be polluted.
                if (outputMode === undefined || outputMode === 'enabled') {
                    process.stderr.write(message);
                }
            });
            childProcess.stdout?.on('data', (message) => {
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
                printFn(`Command "${command}" completed with ${exitDescription}.`);
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
function getEnvironmentForNonInteractiveCommand(userProvidedEnv) {
    // Pass through the color level from the TTY/process performing the `spawn` call.
    const forceColorValue = supportsColor.stdout !== false ? supportsColor.stdout.level.toString() : undefined;
    return { FORCE_COLOR: forceColorValue, ...(userProvidedEnv ?? process.env) };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hpbGQtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25nLWRldi91dGlscy9jaGlsZC1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sYUFBYSxNQUFNLGdCQUFnQixDQUFDO0FBQzNDLE9BQU8sRUFDTCxLQUFLLElBQUksTUFBTSxFQUVmLFNBQVMsSUFBSSxVQUFVLEVBR3ZCLElBQUksSUFBSSxLQUFLLEdBQ2QsTUFBTSxlQUFlLENBQUM7QUFDdkIsT0FBTyxFQUFDLEdBQUcsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQXdDakMsNERBQTREO0FBQzVELE1BQU0sT0FBZ0IsWUFBWTtJQUNoQzs7Ozs7T0FLRztJQUNILE1BQU0sQ0FBQyxnQkFBZ0IsQ0FDckIsT0FBZSxFQUNmLElBQWMsRUFDZCxVQUEwQyxFQUFFO1FBRTVDLE9BQU8sSUFBSSxPQUFPLENBQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDM0MsTUFBTSxXQUFXLEdBQUcsR0FBRyxPQUFPLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ25ELEdBQUcsQ0FBQyxLQUFLLENBQUMsc0JBQXNCLFdBQVcsRUFBRSxDQUFDLENBQUM7WUFDL0MsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsRUFBQyxHQUFHLE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUMsQ0FBQyxDQUFDO1lBQ3hGLDJGQUEyRjtZQUMzRiw2RkFBNkY7WUFDN0YsaURBQWlEO1lBQ2pELFlBQVksQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENB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QyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBQyxDQUFDLENBQUM7Z0JBQ3BDLENBQUM7cUJBQU0sQ0FBQztvQkFDTixNQUFNLENBQUMsVUFBVSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDMUQsQ0FBQztZQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFDRDs7Ozs7OztHQU9HO0FBQ0gsU0FBUywyQkFBMkIsQ0FBQyxRQUF1QixFQUFFLE1BQTZCO0lBQ3pGLE9BQU8sUUFBUSxJQUFJLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNsQyxDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsU0FBUyxzQ0FBc0MsQ0FDN0MsZUFBbUM7SUFFbkMsaUZBQWlGO0lBQ2pGLE1BQU0sZUFBZSxHQUNuQixhQUFhLENBQUMsTUFBTSxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUVyRixPQUFPLEVBQUMsV0FBVyxFQUFFLGVBQWUsRUFBRSxHQUFHLENBQUMsZUFBZSxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBQyxDQUFDO0FBQzdFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHN1cHBvcnRzQ29sb3IgZnJvbSAnc3VwcG9ydHMtY29sb3InO1xuaW1wb3J0IHtcbiAgc3Bhd24gYXMgX3NwYXduLFxuICBTcGF3bk9wdGlvbnMgYXMgX1NwYXduT3B0aW9ucyxcbiAgc3Bhd25TeW5jIGFzIF9zcGF3blN5bmMsXG4gIFNwYXduU3luY09wdGlvbnMgYXMgX1NwYXduU3luY09wdGlvbnMsXG4gIEV4ZWNPcHRpb25zIGFzIF9FeGVjT3B0aW9ucyxcbiAgZXhlYyBhcyBfZXhlYyxcbn0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQge0xvZ30gZnJvbSAnLi9sb2dnaW5nLmpzJztcblxuLyoqIEludGVyZmFjZSBkZXNjcmliaW5nIHRoZSBvcHRpb25zIGZvciBzcGF3bmluZyBhIHByb2Nlc3Mgc3luY2hyb25vdXNseS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3Bhd25TeW5jT3B0aW9ucyBleHRlbmRzIE9taXQ8X1NwYXduU3luY09wdGlvbnMsICdzaGVsbCcgfCAnc3RkaW8nPiB7XG4gIC8qKiBXaGV0aGVyIHRvIHByZXZlbnQgZXhpdCBjb2RlcyBiZWluZyB0cmVhdGVkIGFzIGZhaWx1cmVzLiAqL1xuICBzdXBwcmVzc0Vycm9yT25GYWlsaW5nRXhpdENvZGU/OiBib29sZWFuO1xufVxuXG4vKiogSW50ZXJmYWNlIGRlc2NyaWJpbmcgdGhlIG9wdGlvbnMgZm9yIHNwYXduaW5nIGEgcHJvY2Vzcy4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3Bhd25PcHRpb25zIGV4dGVuZHMgT21pdDxfU3Bhd25PcHRpb25zLCAnc2hlbGwnIHwgJ3N0ZGlvJz4ge1xuICAvKiogQ29uc29sZSBvdXRwdXQgbW9kZS4gRGVmYXVsdHMgdG8gXCJlbmFibGVkXCIuICovXG4gIG1vZGU/OiAnZW5hYmxlZCcgfCAnc2lsZW50JyB8ICdvbi1lcnJvcic7XG4gIC8qKiBXaGV0aGVyIHRvIHByZXZlbnQgZXhpdCBjb2RlcyBiZWluZyB0cmVhdGVkIGFzIGZhaWx1cmVzLiAqL1xuICBzdXBwcmVzc0Vycm9yT25GYWlsaW5nRXhpdENvZGU/OiBib29sZWFuO1xuICAvLyBTdGRpbiB0ZXh0IHRvIHByb3ZpZGUgdG8gdGhlIHByb2Nlc3MuIFRoZSByYXcgdGV4dCB3aWxsIGJlIHdyaXR0ZW4gdG8gYHN0ZGluYCBhbmQgdGhlblxuICAvLyB0aGUgc3RyZWFtIGlzIGNsb3NlZC4gVGhpcyBpcyBlcXVpdmFsZW50IHRvIHRoZSBgaW5wdXRgIG9wdGlvbiBmcm9tIGBTcGF3blN5bmNPcHRpb25gLlxuICBpbnB1dD86IHN0cmluZztcbn1cblxuLyoqIEludGVyZmFjZSBkZXNjcmliaW5nIHRoZSBvcHRpb25zIGZvciBleGVjLWluZyBhIHByb2Nlc3MuICovXG5leHBvcnQgaW50ZXJmYWNlIEV4ZWNPcHRpb25zIGV4dGVuZHMgT21pdDxfRXhlY09wdGlvbnMsICdzaGVsbCcgfCAnc3RkaW8nPiB7XG4gIC8qKiBDb25zb2xlIG91dHB1dCBtb2RlLiBEZWZhdWx0cyB0byBcImVuYWJsZWRcIi4gKi9cbiAgbW9kZT86ICdlbmFibGVkJyB8ICdzaWxlbnQnIHwgJ29uLWVycm9yJztcbiAgLyoqIFdoZXRoZXIgdG8gcHJldmVudCBleGl0IGNvZGVzIGJlaW5nIHRyZWF0ZWQgYXMgZmFpbHVyZXMuICovXG4gIHN1cHByZXNzRXJyb3JPbkZhaWxpbmdFeGl0Q29kZT86IGJvb2xlYW47XG59XG5cbi8qKiBJbnRlcmZhY2UgZGVzY3JpYmluZyB0aGUgb3B0aW9ucyBmb3Igc3Bhd25pbmcgYW4gaW50ZXJhY3RpdmUgcHJvY2Vzcy4gKi9cbmV4cG9ydCB0eXBlIFNwYXduSW50ZXJhY3RpdmVDb21tYW5kT3B0aW9ucyA9IE9taXQ8X1NwYXduT3B0aW9ucywgJ3NoZWxsJyB8ICdzdGRpbyc+O1xuXG4vKiogSW50ZXJmYWNlIGRlc2NyaWJpbmcgdGhlIHJlc3VsdCBvZiBhIHNwYXduZWQgcHJvY2Vzcy4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3Bhd25SZXN1bHQge1xuICAvKiogQ2FwdHVyZWQgc3Rkb3V0IGluIHN0cmluZyBmb3JtYXQuICovXG4gIHN0ZG91dDogc3RyaW5nO1xuICAvKiogQ2FwdHVyZWQgc3RkZXJyIGluIHN0cmluZyBmb3JtYXQuICovXG4gIHN0ZGVycjogc3RyaW5nO1xuICAvKiogVGhlIGV4aXQgY29kZSBvciBzaWduYWwgb2YgdGhlIHByb2Nlc3MuICovXG4gIHN0YXR1czogbnVtYmVyIHwgTm9kZUpTLlNpZ25hbHM7XG59XG5cbi8qKiBDbGFzcyBob2xkaW5nIHV0aWxpdGllcyBmb3Igc3Bhd25pbmcgY2hpbGQgcHJvY2Vzc2VzLiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIENoaWxkUHJvY2VzcyB7XG4gIC8qKlxuICAgKiBTcGF3bnMgYSBnaXZlbiBjb21tYW5kIHdpdGggdGhlIHNwZWNpZmllZCBhcmd1bWVudHMgaW5zaWRlIGFuIGludGVyYWN0aXZlIHNoZWxsLiBBbGwgcHJvY2Vzc1xuICAgKiBzdGRpbiwgc3Rkb3V0IGFuZCBzdGRlcnIgb3V0cHV0IGlzIHByaW50ZWQgdG8gdGhlIGN1cnJlbnQgY29uc29sZS5cbiAgICpcbiAgICogQHJldHVybnMgYSBQcm9taXNlIHJlc29sdmluZyBvbiBzdWNjZXNzLCBhbmQgcmVqZWN0aW5nIG9uIGNvbW1hbmQgZmFpbHVyZSB3aXRoIHRoZSBzdGF0dXMgY29kZS5cbiAgICovXG4gIHN0YXRpYyBzcGF3bkludGVyYWN0aXZlKFxuICAgIGNvbW1hbmQ6IHN0cmluZyxcbiAgICBhcmdzOiBzdHJpbmdbXSxcbiAgICBvcHRpb25zOiBTcGF3bkludGVyYWN0aXZlQ29tbWFuZE9wdGlvbnMgPSB7fSxcbiAgKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGNvbW1hbmRUZXh0ID0gYCR7Y29tbWFuZH0gJHthcmdzLmpvaW4oJyAnKX1gO1xuICAgICAgTG9nLmRlYnVnKGBFeGVjdXRpbmcgY29tbWFuZDogJHtjb21tYW5kVGV4dH1gKTtcbiAgICAgIGNvbnN0IGNoaWxkUHJvY2VzcyA9IF9zcGF3bihjb21tYW5kLCBhcmdzLCB7Li4ub3B0aW9ucywgc2hlbGw6IHRydWUsIHN0ZGlvOiAnaW5oZXJpdCd9KTtcbiAgICAgIC8vIFRoZSBgY2xvc2VgIGV2ZW50IGlzIHVzZWQgYmVjYXVzZSB0aGUgcHJvY2VzcyBpcyBndWFyYW50ZWVkIHRvIGhhdmUgY29tcGxldGVkIHdyaXRpbmcgdG9cbiAgICAgIC8vIHN0ZG91dCBhbmQgc3RkZXJyLCB1c2luZyB0aGUgYGV4aXRgIGV2ZW50IGNhbiBjYXVzZSBpbmNvbnNpc3RlbnQgaW5mb3JtYXRpb24gaW4gc3Rkb3V0IGFuZFxuICAgICAgLy8gc3RkZXJyIGR1ZSB0byBhIHJhY2UgY29uZGl0aW9uIGFyb3VuZCBleGl0aW5nLlxuICAgICAgY2hpbGRQcm9jZXNzLm9uKCdjbG9zZScsIChzdGF0dXMpID0+IChzdGF0dXMgPT09IDAgPyByZXNvbHZlKCkgOiByZWplY3Qoc3RhdHVzKSkpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNwYXducyBhIGdpdmVuIGNvbW1hbmQgd2l0aCB0aGUgc3BlY2lmaWVkIGFyZ3VtZW50cyBpbnNpZGUgYSBzaGVsbC4gQWxsIHByb2Nlc3Mgc3Rkb3V0XG4gICAqIG91dHB1dCBpcyBjYXB0dXJlZCBhbmQgcmV0dXJuZWQgYXMgcmVzb2x1dGlvbiBvbiBjb21wbGV0aW9uLiBEZXBlbmRpbmcgb24gdGhlIGNob3NlblxuICAgKiBvdXRwdXQgbW9kZSwgc3Rkb3V0L3N0ZGVyciBvdXRwdXQgaXMgYWxzbyBwcmludGVkIHRvIHRoZSBjb25zb2xlLCBvciBvbmx5IG9uIGVycm9yLlxuICAgKlxuICAgKiBAcmV0dXJucyBhIFByb21pc2UgcmVzb2x2aW5nIHdpdGggY2FwdHVyZWQgc3Rkb3V0IGFuZCBzdGRlcnIgb24gc3VjY2Vzcy4gVGhlIHByb21pc2VcbiAgICogICByZWplY3RzIG9uIGNvbW1hbmQgZmFpbHVyZS5cbiAgICovXG4gIHN0YXRpYyBzcGF3bihjb21tYW5kOiBzdHJpbmcsIGFyZ3M6IHN0cmluZ1tdLCBvcHRpb25zOiBTcGF3bk9wdGlvbnMgPSB7fSk6IFByb21pc2U8U3Bhd25SZXN1bHQ+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgY29tbWFuZFRleHQgPSBgJHtjb21tYW5kfSAke2FyZ3Muam9pbignICcpfWA7XG4gICAgICBjb25zdCBvdXRwdXRNb2RlID0gb3B0aW9ucy5tb2RlO1xuICAgICAgY29uc3QgZW52ID0gZ2V0RW52aXJvbm1lbnRGb3JOb25JbnRlcmFjdGl2ZUNvbW1hbmQob3B0aW9ucy5lbnYpO1xuXG4gICAgICBMb2cuZGVidWcoYEV4ZWN1dGluZyBjb21tYW5kOiAke2NvbW1hbmRUZXh0fWApO1xuXG4gICAgICBjb25zdCBjaGlsZFByb2Nlc3MgPSBfc3Bhd24oY29tbWFuZCwgYXJncywgey4uLm9wdGlvbnMsIGVudiwgc2hlbGw6IHRydWUsIHN0ZGlvOiAncGlwZSd9KTtcbiAgICAgIGxldCBsb2dPdXRwdXQgPSAnJztcbiAgICAgIGxldCBzdGRvdXQgPSAnJztcbiAgICAgIGxldCBzdGRlcnIgPSAnJztcblxuICAgICAgLy8gSWYgcHJvdmlkZWQsIHdyaXRlIGBpbnB1dGAgdGV4dCB0byB0aGUgcHJvY2VzcyBgc3RkaW5gLlxuICAgICAgaWYgKG9wdGlvbnMuaW5wdXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjaGlsZFByb2Nlc3Muc3RkaW4ud3JpdGUob3B0aW9ucy5pbnB1dCk7XG4gICAgICAgIGNoaWxkUHJvY2Vzcy5zdGRpbi5lbmQoKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2FwdHVyZSB0aGUgc3Rkb3V0IHNlcGFyYXRlbHkgc28gdGhhdCBpdCBjYW4gYmUgcGFzc2VkIGFzIHJlc29sdmUgdmFsdWUuXG4gICAgICAvLyBUaGlzIGlzIHVzZWZ1bCBpZiBjb21tYW5kcyByZXR1cm4gcGFyc2FibGUgc3Rkb3V0LlxuICAgICAgY2hpbGRQcm9jZXNzLnN0ZGVyci5vbignZGF0YScsIChtZXNzYWdlKSA9PiB7XG4gICAgICAgIHN0ZGVyciArPSBtZXNzYWdlO1xuICAgICAgICBsb2dPdXRwdXQgKz0gbWVzc2FnZTtcbiAgICAgICAgLy8gSWYgY29uc29sZSBvdXRwdXQgaXMgZW5hYmxlZCwgcHJpbnQgdGhlIG1lc3NhZ2UgZGlyZWN0bHkgdG8gdGhlIHN0ZGVyci4gTm90ZSB0aGF0XG4gICAgICAgIC8vIHdlIGludGVudGlvbmFsbHkgcHJpbnQgYWxsIG91dHB1dCB0byBzdGRlcnIgYXMgc3Rkb3V0IHNob3VsZCBub3QgYmUgcG9sbHV0ZWQuXG4gICAgICAgIGlmIChvdXRwdXRNb2RlID09PSB1bmRlZmluZWQgfHwgb3V0cHV0TW9kZSA9PT0gJ2VuYWJsZWQnKSB7XG4gICAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUobWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBjaGlsZFByb2Nlc3Muc3Rkb3V0Lm9uKCdkYXRhJywgKG1lc3NhZ2UpID0+IHtcbiAgICAgICAgc3Rkb3V0ICs9IG1lc3NhZ2U7XG4gICAgICAgIGxvZ091dHB1dCArPSBtZXNzYWdlO1xuICAgICAgICAvLyBJZiBjb25zb2xlIG91dHB1dCBpcyBlbmFibGVkLCBwcmludCB0aGUgbWVzc2FnZSBkaXJlY3RseSB0byB0aGUgc3RkZXJyLiBOb3RlIHRoYXRcbiAgICAgICAgLy8gd2UgaW50ZW50aW9uYWxseSBwcmludCBhbGwgb3V0cHV0IHRvIHN0ZGVyciBhcyBzdGRvdXQgc2hvdWxkIG5vdCBiZSBwb2xsdXRlZC5cbiAgICAgICAgaWYgKG91dHB1dE1vZGUgPT09IHVuZGVmaW5lZCB8fCBvdXRwdXRNb2RlID09PSAnZW5hYmxlZCcpIHtcbiAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIFRoZSBgY2xvc2VgIGV2ZW50IGlzIHVzZWQgYmVjYXVzZSB0aGUgcHJvY2VzcyBpcyBndWFyYW50ZWVkIHRvIGhhdmUgY29tcGxldGVkIHdyaXRpbmcgdG9cbiAgICAgIC8vIHN0ZG91dCBhbmQgc3RkZXJyLCB1c2luZyB0aGUgYGV4aXRgIGV2ZW50IGNhbiBjYXVzZSBpbmNvbnNpc3RlbnQgaW5mb3JtYXRpb24gaW4gc3Rkb3V0IGFuZFxuICAgICAgLy8gc3RkZXJyIGR1ZSB0byBhIHJhY2UgY29uZGl0aW9uIGFyb3VuZCBleGl0aW5nLlxuICAgICAgY2hpbGRQcm9jZXNzLm9uKCdjbG9zZScsIChleGl0Q29kZSwgc2lnbmFsKSA9PiB7XG4gICAgICAgIGNvbnN0IGV4aXREZXNjcmlwdGlvbiA9XG4gICAgICAgICAgZXhpdENvZGUgIT09IG51bGwgPyBgZXhpdCBjb2RlIFwiJHtleGl0Q29kZX1cImAgOiBgc2lnbmFsIFwiJHtzaWduYWx9XCJgO1xuICAgICAgICBjb25zdCBwcmludEZuID0gb3V0cHV0TW9kZSA9PT0gJ29uLWVycm9yJyA/IExvZy5lcnJvciA6IExvZy5kZWJ1ZztcbiAgICAgICAgY29uc3Qgc3RhdHVzID0gc3RhdHVzRnJvbUV4aXRDb2RlQW5kU2lnbmFsKGV4aXRDb2RlLCBzaWduYWwpO1xuXG4gICAgICAgIHByaW50Rm4oYENvbW1hbmQgXCIke2NvbW1hbmRUZXh0fVwiIGNvbXBsZXRlZCB3aXRoICR7ZXhpdERlc2NyaXB0aW9ufS5gKTtcbiAgICAgICAgcHJpbnRGbihgUHJvY2VzcyBvdXRwdXQ6IFxcbiR7bG9nT3V0cHV0fWApO1xuXG4gICAgICAgIC8vIE9uIHN1Y2Nlc3MsIHJlc29sdmUgdGhlIHByb21pc2UuIE90aGVyd2lzZSByZWplY3Qgd2l0aCB0aGUgY2FwdHVyZWQgc3RkZXJyXG4gICAgICAgIC8vIGFuZCBzdGRvdXQgbG9nIG91dHB1dCBpZiB0aGUgb3V0cHV0IG1vZGUgd2FzIHNldCB0byBgc2lsZW50YC5cbiAgICAgICAgaWYgKHN0YXR1cyA9PT0gMCB8fCBvcHRpb25zLnN1cHByZXNzRXJyb3JPbkZhaWxpbmdFeGl0Q29kZSkge1xuICAgICAgICAgIHJlc29sdmUoe3N0ZG91dCwgc3RkZXJyLCBzdGF0dXN9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZWplY3Qob3V0cHV0TW9kZSA9PT0gJ3NpbGVudCcgPyBsb2dPdXRwdXQgOiB1bmRlZmluZWQpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTcGF3bnMgYSBnaXZlbiBjb21tYW5kIHdpdGggdGhlIHNwZWNpZmllZCBhcmd1bWVudHMgaW5zaWRlIGEgc2hlbGwgc3luY2hyb25vdXNseS5cbiAgICpcbiAgICogQHJldHVybnMgVGhlIGNvbW1hbmQncyBzdGRvdXQgYW5kIHN0ZGVyci5cbiAgICovXG4gIHN0YXRpYyBzcGF3blN5bmMoY29tbWFuZDogc3RyaW5nLCBhcmdzOiBzdHJpbmdbXSwgb3B0aW9uczogU3Bhd25TeW5jT3B0aW9ucyA9IHt9KTogU3Bhd25SZXN1bHQge1xuICAgIGNvbnN0IGNvbW1hbmRUZXh0ID0gYCR7Y29tbWFuZH0gJHthcmdzLmpvaW4oJyAnKX1gO1xuICAgIGNvbnN0IGVudiA9IGdldEVudmlyb25tZW50Rm9yTm9uSW50ZXJhY3RpdmVDb21tYW5kKG9wdGlvbnMuZW52KTtcblxuICAgIExvZy5kZWJ1ZyhgRXhlY3V0aW5nIGNvbW1hbmQ6ICR7Y29tbWFuZFRleHR9YCk7XG5cbiAgICBjb25zdCB7XG4gICAgICBzdGF0dXM6IGV4aXRDb2RlLFxuICAgICAgc2lnbmFsLFxuICAgICAgc3Rkb3V0LFxuICAgICAgc3RkZXJyLFxuICAgIH0gPSBfc3Bhd25TeW5jKGNvbW1hbmQsIGFyZ3MsIHsuLi5vcHRpb25zLCBlbnYsIGVuY29kaW5nOiAndXRmOCcsIHNoZWxsOiB0cnVlLCBzdGRpbzogJ3BpcGUnfSk7XG5cbiAgICAvKiogVGhlIHN0YXR1cyBvZiB0aGUgc3Bhd24gcmVzdWx0LiAqL1xuICAgIGNvbnN0IHN0YXR1cyA9IHN0YXR1c0Zyb21FeGl0Q29kZUFuZFNpZ25hbChleGl0Q29kZSwgc2lnbmFsKTtcblxuICAgIGlmIChzdGF0dXMgPT09IDAgfHwgb3B0aW9ucy5zdXBwcmVzc0Vycm9yT25GYWlsaW5nRXhpdENvZGUpIHtcbiAgICAgIHJldHVybiB7c3RhdHVzLCBzdGRvdXQsIHN0ZGVycn07XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKHN0ZGVycik7XG4gIH1cblxuICBzdGF0aWMgZXhlYyhjb21tYW5kOiBzdHJpbmcsIG9wdGlvbnM6IEV4ZWNPcHRpb25zID0ge30pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3Qgb3V0cHV0TW9kZSA9IG9wdGlvbnMubW9kZTtcbiAgICAgIGNvbnN0IGVudiA9IGdldEVudmlyb25tZW50Rm9yTm9uSW50ZXJhY3RpdmVDb21tYW5kKG9wdGlvbnMuZW52KTtcblxuICAgICAgTG9nLmRlYnVnKGBFeGVjdXRpbmcgY29tbWFuZDogJHtjb21tYW5kfWApO1xuXG4gICAgICBjb25zdCBjaGlsZFByb2Nlc3MgPSBfZXhlYyhjb21tYW5kLCB7Li4ub3B0aW9ucywgZW52fSk7XG4gICAgICBsZXQgbG9nT3V0cHV0ID0gJyc7XG4gICAgICBsZXQgc3Rkb3V0ID0gJyc7XG4gICAgICBsZXQgc3RkZXJyID0gJyc7XG5cbiAgICAgIC8vIENhcHR1cmUgdGhlIHN0ZG91dCBzZXBhcmF0ZWx5IHNvIHRoYXQgaXQgY2FuIGJlIHBhc3NlZCBhcyByZXNvbHZlIHZhbHVlLlxuICAgICAgLy8gVGhpcyBpcyB1c2VmdWwgaWYgY29tbWFuZHMgcmV0dXJuIHBhcnNhYmxlIHN0ZG91dC5cbiAgICAgIGNoaWxkUHJvY2Vzcy5zdGRlcnI/Lm9uKCdkYXRhJywgKG1lc3NhZ2UpID0+IHtcbiAgICAgICAgc3RkZXJyICs9IG1lc3NhZ2U7XG4gICAgICAgIGxvZ091dHB1dCArPSBtZXNzYWdlO1xuICAgICAgICAvLyBJZiBjb25zb2xlIG91dHB1dCBpcyBlbmFibGVkLCBwcmludCB0aGUgbWVzc2FnZSBkaXJlY3RseSB0byB0aGUgc3RkZXJyLiBOb3RlIHRoYXRcbiAgICAgICAgLy8gd2UgaW50ZW50aW9uYWxseSBwcmludCBhbGwgb3V0cHV0IHRvIHN0ZGVyciBhcyBzdGRvdXQgc2hvdWxkIG5vdCBiZSBwb2xsdXRlZC5cbiAgICAgICAgaWYgKG91dHB1dE1vZGUgPT09IHVuZGVmaW5lZCB8fCBvdXRwdXRNb2RlID09PSAnZW5hYmxlZCcpIHtcbiAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGNoaWxkUHJvY2Vzcy5zdGRvdXQ/Lm9uKCdkYXRhJywgKG1lc3NhZ2UpID0+IHtcbiAgICAgICAgc3Rkb3V0ICs9IG1lc3NhZ2U7XG4gICAgICAgIGxvZ091dHB1dCArPSBtZXNzYWdlO1xuICAgICAgICAvLyBJZiBjb25zb2xlIG91dHB1dCBpcyBlbmFibGVkLCBwcmludCB0aGUgbWVzc2FnZSBkaXJlY3RseSB0byB0aGUgc3RkZXJyLiBOb3RlIHRoYXRcbiAgICAgICAgLy8gd2UgaW50ZW50aW9uYWxseSBwcmludCBhbGwgb3V0cHV0IHRvIHN0ZGVyciBhcyBzdGRvdXQgc2hvdWxkIG5vdCBiZSBwb2xsdXRlZC5cbiAgICAgICAgaWYgKG91dHB1dE1vZGUgPT09IHVuZGVmaW5lZCB8fCBvdXRwdXRNb2RlID09PSAnZW5hYmxlZCcpIHtcbiAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShtZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIFRoZSBgY2xvc2VgIGV2ZW50IGlzIHVzZWQgYmVjYXVzZSB0aGUgcHJvY2VzcyBpcyBndWFyYW50ZWVkIHRvIGhhdmUgY29tcGxldGVkIHdyaXRpbmcgdG9cbiAgICAgIC8vIHN0ZG91dCBhbmQgc3RkZXJyLCB1c2luZyB0aGUgYGV4aXRgIGV2ZW50IGNhbiBjYXVzZSBpbmNvbnNpc3RlbnQgaW5mb3JtYXRpb24gaW4gc3Rkb3V0IGFuZFxuICAgICAgLy8gc3RkZXJyIGR1ZSB0byBhIHJhY2UgY29uZGl0aW9uIGFyb3VuZCBleGl0aW5nLlxuICAgICAgY2hpbGRQcm9jZXNzLm9uKCdjbG9zZScsIChleGl0Q29kZSwgc2lnbmFsKSA9PiB7XG4gICAgICAgIGNvbnN0IGV4aXREZXNjcmlwdGlvbiA9XG4gICAgICAgICAgZXhpdENvZGUgIT09IG51bGwgPyBgZXhpdCBjb2RlIFwiJHtleGl0Q29kZX1cImAgOiBgc2lnbmFsIFwiJHtzaWduYWx9XCJgO1xuICAgICAgICBjb25zdCBwcmludEZuID0gb3V0cHV0TW9kZSA9PT0gJ29uLWVycm9yJyA/IExvZy5lcnJvciA6IExvZy5kZWJ1ZztcbiAgICAgICAgY29uc3Qgc3RhdHVzID0gc3RhdHVzRnJvbUV4aXRDb2RlQW5kU2lnbmFsKGV4aXRDb2RlLCBzaWduYWwpO1xuXG4gICAgICAgIHByaW50Rm4oYENvbW1hbmQgXCIke2NvbW1hbmR9XCIgY29tcGxldGVkIHdpdGggJHtleGl0RGVzY3JpcHRpb259LmApO1xuICAgICAgICBwcmludEZuKGBQcm9jZXNzIG91dHB1dDogXFxuJHtsb2dPdXRwdXR9YCk7XG5cbiAgICAgICAgLy8gT24gc3VjY2VzcywgcmVzb2x2ZSB0aGUgcHJvbWlzZS4gT3RoZXJ3aXNlIHJlamVjdCB3aXRoIHRoZSBjYXB0dXJlZCBzdGRlcnJcbiAgICAgICAgLy8gYW5kIHN0ZG91dCBsb2cgb3V0cHV0IGlmIHRoZSBvdXRwdXQgbW9kZSB3YXMgc2V0IHRvIGBzaWxlbnRgLlxuICAgICAgICBpZiAoc3RhdHVzID09PSAwIHx8IG9wdGlvbnMuc3VwcHJlc3NFcnJvck9uRmFpbGluZ0V4aXRDb2RlKSB7XG4gICAgICAgICAgcmVzb2x2ZSh7c3Rkb3V0LCBzdGRlcnIsIHN0YXR1c30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlamVjdChvdXRwdXRNb2RlID09PSAnc2lsZW50JyA/IGxvZ091dHB1dCA6IHVuZGVmaW5lZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG4vKipcbiAqIENvbnZlcnQgdGhlIHByb3ZpZGVkIGV4aXRDb2RlIGFuZCBzaWduYWwgdG8gYSBzaW5nbGUgc3RhdHVzIGNvZGUuXG4gKlxuICogRHVyaW5nIGBleGl0YCBub2RlIHByb3ZpZGVzIGVpdGhlciBhIGBjb2RlYCBvciBgc2lnbmFsYCwgb25lIG9mIHdoaWNoIGlzIGd1YXJhbnRlZWQgdG8gYmVcbiAqIG5vbi1udWxsLlxuICpcbiAqIEZvciBtb3JlIGRldGFpbHMgc2VlOiBodHRwczovL25vZGVqcy5vcmcvYXBpL2NoaWxkX3Byb2Nlc3MuaHRtbCNjaGlsZF9wcm9jZXNzX2V2ZW50X2V4aXRcbiAqL1xuZnVuY3Rpb24gc3RhdHVzRnJvbUV4aXRDb2RlQW5kU2lnbmFsKGV4aXRDb2RlOiBudW1iZXIgfCBudWxsLCBzaWduYWw6IE5vZGVKUy5TaWduYWxzIHwgbnVsbCkge1xuICByZXR1cm4gZXhpdENvZGUgPz8gc2lnbmFsID8/IC0xO1xufVxuXG4vKipcbiAqIEdldHMgYSBwcm9jZXNzIGVudmlyb25tZW50IG9iamVjdCB3aXRoIGRlZmF1bHRzIHRoYXQgY2FuIGJlIHVzZWQgZm9yXG4gKiBzcGF3bmluZyBub24taW50ZXJhY3RpdmUgY2hpbGQgcHJvY2Vzc2VzLlxuICpcbiAqIEN1cnJlbnRseSB3ZSBlbmFibGUgYEZPUkNFX0NPTE9SYCBzaW5jZSBub24taW50ZXJhY3RpdmUgc3Bhd24ncyB3aXRoXG4gKiBub24taW5oZXJpdGVkIGBzdGRpb2Agd2lsbCBub3QgaGF2ZSBjb2xvcnMgZW5hYmxlZCBkdWUgdG8gYSBtaXNzaW5nIFRUWS5cbiAqL1xuZnVuY3Rpb24gZ2V0RW52aXJvbm1lbnRGb3JOb25JbnRlcmFjdGl2ZUNvbW1hbmQoXG4gIHVzZXJQcm92aWRlZEVudj86IE5vZGVKUy5Qcm9jZXNzRW52LFxuKTogTm9kZUpTLlByb2Nlc3NFbnYge1xuICAvLyBQYXNzIHRocm91Z2ggdGhlIGNvbG9yIGxldmVsIGZyb20gdGhlIFRUWS9wcm9jZXNzIHBlcmZvcm1pbmcgdGhlIGBzcGF3bmAgY2FsbC5cbiAgY29uc3QgZm9yY2VDb2xvclZhbHVlID1cbiAgICBzdXBwb3J0c0NvbG9yLnN0ZG91dCAhPT0gZmFsc2UgPyBzdXBwb3J0c0NvbG9yLnN0ZG91dC5sZXZlbC50b1N0cmluZygpIDogdW5kZWZpbmVkO1xuXG4gIHJldHVybiB7Rk9SQ0VfQ09MT1I6IGZvcmNlQ29sb3JWYWx1ZSwgLi4uKHVzZXJQcm92aWRlZEVudiA/PyBwcm9jZXNzLmVudil9O1xufVxuIl19