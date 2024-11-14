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
import assert from 'assert';
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
    /**
     * Spawns a given command with the specified arguments inside a shell. All process stdout
     * output is captured and returned as resolution on completion. Depending on the chosen
     * output mode, stdout/stderr output is also printed to the console, or only on error.
     *
     * @returns a Promise resolving with captured stdout and stderr on success. The promise
     *   rejects on command failure.
     */
    static spawn(command, args, options = {}) {
        const commandText = `${command} ${args.join(' ')}`;
        const env = getEnvironmentForNonInteractiveCommand(options.env);
        return processAsyncCmd(commandText, options, _spawn(command, args, { ...options, env, shell: true, stdio: 'pipe' }));
    }
    /**
     * Execs a given command with the specified arguments inside a shell. All process stdout
     * output is captured and returned as resolution on completion. Depending on the chosen
     * output mode, stdout/stderr output is also printed to the console, or only on error.
     *
     * @returns a Promise resolving with captured stdout and stderr on success. The promise
     *   rejects on command failure.
     */
    static exec(command, options = {}) {
        const env = getEnvironmentForNonInteractiveCommand(options.env);
        return processAsyncCmd(command, options, _exec(command, { ...options, env }));
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
/**
 * Process the ChildProcess object created by an async command.
 */
function processAsyncCmd(command, options, childProcess) {
    return new Promise((resolve, reject) => {
        let logOutput = '';
        let stdout = '';
        let stderr = '';
        Log.debug(`Executing command: ${command}`);
        // If provided, write `input` text to the process `stdin`.
        if (options.input !== undefined) {
            assert(childProcess.stdin, 'Cannot write process `input` if there is no pipe `stdin` channel.');
            childProcess.stdin.write(options.input);
            childProcess.stdin.end();
        }
        // Capture the stdout separately so that it can be passed as resolve value.
        // This is useful if commands return parsable stdout.
        childProcess.stderr?.on('data', (message) => {
            stderr += message;
            logOutput += message;
            // If console output is enabled, print the message directly to the stderr. Note that
            // we intentionally print all output to stderr as stdout should not be polluted.
            if (options.mode === undefined || options.mode === 'enabled') {
                process.stderr.write(message);
            }
        });
        childProcess.stdout?.on('data', (message) => {
            stdout += message;
            logOutput += message;
            // If console output is enabled, print the message directly to the stderr. Note that
            // we intentionally print all output to stderr as stdout should not be polluted.
            if (options.mode === undefined || options.mode === 'enabled') {
                process.stderr.write(message);
            }
        });
        // The `close` event is used because the process is guaranteed to have completed writing to
        // stdout and stderr, using the `exit` event can cause inconsistent information in stdout and
        // stderr due to a race condition around exiting.
        childProcess.on('close', (exitCode, signal) => {
            const exitDescription = exitCode !== null ? `exit code "${exitCode}"` : `signal "${signal}"`;
            const printFn = options.mode === 'on-error' ? Log.error : Log.debug;
            const status = statusFromExitCodeAndSignal(exitCode, signal);
            printFn(`Command "${command}" completed with ${exitDescription}.`);
            printFn(`Process output: \n${logOutput}`);
            // On success, resolve the promise. Otherwise reject with the captured stderr
            // and stdout log output if the output mode was set to `silent`.
            if (status === 0 || options.suppressErrorOnFailingExitCode) {
                resolve({ stdout, stderr, status });
            }
            else {
                reject(options.mode === 'silent' ? logOutput : undefined);
            }
        });
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hpbGQtcHJvY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25nLWRldi91dGlscy9jaGlsZC1wcm9jZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sYUFBYSxNQUFNLGdCQUFnQixDQUFDO0FBQzNDLE9BQU8sRUFDTCxLQUFLLElBQUksTUFBTSxFQUVmLFNBQVMsSUFBSSxVQUFVLEVBR3ZCLElBQUksSUFBSSxLQUFLLEdBRWQsTUFBTSxlQUFlLENBQUM7QUFDdkIsT0FBTyxFQUFDLEdBQUcsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUNqQyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUF1QzVCLDREQUE0RDtBQUM1RCxNQUFNLE9BQWdCLFlBQVk7SUFDaEM7Ozs7O09BS0c7SUFDSCxNQUFNLENBQUMsZ0JBQWdCLENBQ3JCLE9BQWUsRUFDZixJQUFjLEVBQ2QsVUFBMEMsRUFBRTtRQUU1QyxPQUFPLElBQUksT0FBTyxDQUFPLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQzNDLE1BQU0sV0FBVyxHQUFHLEdBQUcsT0FBTyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNuRCxHQUFHLENBQUMsS0FBSyxDQUFDLHNCQUFzQixXQUFXLEVBQUUsQ0FBQyxDQUFDO1lBQy9DLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLEVBQUMsR0FBRyxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFDLENBQUMsQ0FBQztZQUN4RiwyRkFBMkY7WUFDM0YsNkZBQTZGO1lBQzdGLGlEQUFpRDtZQUNqRCxZQUFZLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxP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LENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzVELENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgc3VwcG9ydHNDb2xvciBmcm9tICdzdXBwb3J0cy1jb2xvcic7XG5pbXBvcnQge1xuICBzcGF3biBhcyBfc3Bhd24sXG4gIFNwYXduT3B0aW9ucyBhcyBfU3Bhd25PcHRpb25zLFxuICBzcGF3blN5bmMgYXMgX3NwYXduU3luYyxcbiAgU3Bhd25TeW5jT3B0aW9ucyBhcyBfU3Bhd25TeW5jT3B0aW9ucyxcbiAgRXhlY09wdGlvbnMgYXMgX0V4ZWNPcHRpb25zLFxuICBleGVjIGFzIF9leGVjLFxuICBDaGlsZFByb2Nlc3MgYXMgX0NoaWxkUHJvY2Vzcyxcbn0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQge0xvZ30gZnJvbSAnLi9sb2dnaW5nLmpzJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcblxuZXhwb3J0IGludGVyZmFjZSBDb21tb25DbWRPcHRzIHtcbiAgLy8gU3RkaW4gdGV4dCB0byBwcm92aWRlIHRvIHRoZSBwcm9jZXNzLiBUaGUgcmF3IHRleHQgd2lsbCBiZSB3cml0dGVuIHRvIGBzdGRpbmAgYW5kIHRoZW5cbiAgLy8gdGhlIHN0cmVhbSBpcyBjbG9zZWQuIFRoaXMgaXMgZXF1aXZhbGVudCB0byB0aGUgYGlucHV0YCBvcHRpb24gZnJvbSBgU3Bhd25TeW5jT3B0aW9uYC5cbiAgaW5wdXQ/OiBzdHJpbmc7XG4gIC8qKiBDb25zb2xlIG91dHB1dCBtb2RlLiBEZWZhdWx0cyB0byBcImVuYWJsZWRcIi4gKi9cbiAgbW9kZT86ICdlbmFibGVkJyB8ICdzaWxlbnQnIHwgJ29uLWVycm9yJztcbiAgLyoqIFdoZXRoZXIgdG8gcHJldmVudCBleGl0IGNvZGVzIGJlaW5nIHRyZWF0ZWQgYXMgZmFpbHVyZXMuICovXG4gIHN1cHByZXNzRXJyb3JPbkZhaWxpbmdFeGl0Q29kZT86IGJvb2xlYW47XG59XG5cbi8qKiBJbnRlcmZhY2UgZGVzY3JpYmluZyB0aGUgb3B0aW9ucyBmb3Igc3Bhd25pbmcgYSBwcm9jZXNzIHN5bmNocm9ub3VzbHkuICovXG5leHBvcnQgaW50ZXJmYWNlIFNwYXduU3luY09wdGlvbnNcbiAgZXh0ZW5kcyBDb21tb25DbWRPcHRzLFxuICAgIE9taXQ8X1NwYXduU3luY09wdGlvbnMsICdzaGVsbCcgfCAnc3RkaW8nIHwgJ2lucHV0Jz4ge31cblxuLyoqIEludGVyZmFjZSBkZXNjcmliaW5nIHRoZSBvcHRpb25zIGZvciBzcGF3bmluZyBhIHByb2Nlc3MuICovXG5leHBvcnQgaW50ZXJmYWNlIFNwYXduT3B0aW9ucyBleHRlbmRzIENvbW1vbkNtZE9wdHMsIE9taXQ8X1NwYXduT3B0aW9ucywgJ3NoZWxsJyB8ICdzdGRpbyc+IHt9XG5cbi8qKiBJbnRlcmZhY2UgZGVzY3JpYmluZyB0aGUgb3B0aW9ucyBmb3IgZXhlYy1pbmcgYSBwcm9jZXNzLiAqL1xuZXhwb3J0IGludGVyZmFjZSBFeGVjT3B0aW9ucyBleHRlbmRzIENvbW1vbkNtZE9wdHMsIE9taXQ8X0V4ZWNPcHRpb25zLCAnc2hlbGwnIHwgJ3N0ZGlvJz4ge31cblxuLyoqIEludGVyZmFjZSBkZXNjcmliaW5nIHRoZSBvcHRpb25zIGZvciBzcGF3bmluZyBhbiBpbnRlcmFjdGl2ZSBwcm9jZXNzLiAqL1xuZXhwb3J0IGludGVyZmFjZSBTcGF3bkludGVyYWN0aXZlQ29tbWFuZE9wdGlvbnMgZXh0ZW5kcyBPbWl0PF9TcGF3bk9wdGlvbnMsICdzaGVsbCcgfCAnc3RkaW8nPiB7fVxuXG4vKiogSW50ZXJmYWNlIGRlc2NyaWJpbmcgdGhlIHJlc3VsdCBvZiBhIHNwYXduZWQgcHJvY2Vzcy4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3Bhd25SZXN1bHQge1xuICAvKiogQ2FwdHVyZWQgc3Rkb3V0IGluIHN0cmluZyBmb3JtYXQuICovXG4gIHN0ZG91dDogc3RyaW5nO1xuICAvKiogQ2FwdHVyZWQgc3RkZXJyIGluIHN0cmluZyBmb3JtYXQuICovXG4gIHN0ZGVycjogc3RyaW5nO1xuICAvKiogVGhlIGV4aXQgY29kZSBvciBzaWduYWwgb2YgdGhlIHByb2Nlc3MuICovXG4gIHN0YXR1czogbnVtYmVyIHwgTm9kZUpTLlNpZ25hbHM7XG59XG5cbi8qKiBJbnRlcmZhY2UgZGVzY3JpYmluZyB0aGUgcmVzdWx0IG9mIGFuIGV4ZWMgcHJvY2Vzcy4gKi9cbmV4cG9ydCB0eXBlIEV4ZWNSZXN1bHQgPSBTcGF3blJlc3VsdDtcblxuLyoqIENsYXNzIGhvbGRpbmcgdXRpbGl0aWVzIGZvciBzcGF3bmluZyBjaGlsZCBwcm9jZXNzZXMuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQ2hpbGRQcm9jZXNzIHtcbiAgLyoqXG4gICAqIFNwYXducyBhIGdpdmVuIGNvbW1hbmQgd2l0aCB0aGUgc3BlY2lmaWVkIGFyZ3VtZW50cyBpbnNpZGUgYW4gaW50ZXJhY3RpdmUgc2hlbGwuIEFsbCBwcm9jZXNzXG4gICAqIHN0ZGluLCBzdGRvdXQgYW5kIHN0ZGVyciBvdXRwdXQgaXMgcHJpbnRlZCB0byB0aGUgY3VycmVudCBjb25zb2xlLlxuICAgKlxuICAgKiBAcmV0dXJucyBhIFByb21pc2UgcmVzb2x2aW5nIG9uIHN1Y2Nlc3MsIGFuZCByZWplY3Rpbmcgb24gY29tbWFuZCBmYWlsdXJlIHdpdGggdGhlIHN0YXR1cyBjb2RlLlxuICAgKi9cbiAgc3RhdGljIHNwYXduSW50ZXJhY3RpdmUoXG4gICAgY29tbWFuZDogc3RyaW5nLFxuICAgIGFyZ3M6IHN0cmluZ1tdLFxuICAgIG9wdGlvbnM6IFNwYXduSW50ZXJhY3RpdmVDb21tYW5kT3B0aW9ucyA9IHt9LFxuICApIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgY29tbWFuZFRleHQgPSBgJHtjb21tYW5kfSAke2FyZ3Muam9pbignICcpfWA7XG4gICAgICBMb2cuZGVidWcoYEV4ZWN1dGluZyBjb21tYW5kOiAke2NvbW1hbmRUZXh0fWApO1xuICAgICAgY29uc3QgY2hpbGRQcm9jZXNzID0gX3NwYXduKGNvbW1hbmQsIGFyZ3MsIHsuLi5vcHRpb25zLCBzaGVsbDogdHJ1ZSwgc3RkaW86ICdpbmhlcml0J30pO1xuICAgICAgLy8gVGhlIGBjbG9zZWAgZXZlbnQgaXMgdXNlZCBiZWNhdXNlIHRoZSBwcm9jZXNzIGlzIGd1YXJhbnRlZWQgdG8gaGF2ZSBjb21wbGV0ZWQgd3JpdGluZyB0b1xuICAgICAgLy8gc3Rkb3V0IGFuZCBzdGRlcnIsIHVzaW5nIHRoZSBgZXhpdGAgZXZlbnQgY2FuIGNhdXNlIGluY29uc2lzdGVudCBpbmZvcm1hdGlvbiBpbiBzdGRvdXQgYW5kXG4gICAgICAvLyBzdGRlcnIgZHVlIHRvIGEgcmFjZSBjb25kaXRpb24gYXJvdW5kIGV4aXRpbmcuXG4gICAgICBjaGlsZFByb2Nlc3Mub24oJ2Nsb3NlJywgKHN0YXR1cykgPT4gKHN0YXR1cyA9PT0gMCA/IHJlc29sdmUoKSA6IHJlamVjdChzdGF0dXMpKSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogU3Bhd25zIGEgZ2l2ZW4gY29tbWFuZCB3aXRoIHRoZSBzcGVjaWZpZWQgYXJndW1lbnRzIGluc2lkZSBhIHNoZWxsIHN5bmNocm9ub3VzbHkuXG4gICAqXG4gICAqIEByZXR1cm5zIFRoZSBjb21tYW5kJ3Mgc3Rkb3V0IGFuZCBzdGRlcnIuXG4gICAqL1xuICBzdGF0aWMgc3Bhd25TeW5jKGNvbW1hbmQ6IHN0cmluZywgYXJnczogc3RyaW5nW10sIG9wdGlvbnM6IFNwYXduU3luY09wdGlvbnMgPSB7fSk6IFNwYXduUmVzdWx0IHtcbiAgICBjb25zdCBjb21tYW5kVGV4dCA9IGAke2NvbW1hbmR9ICR7YXJncy5qb2luKCcgJyl9YDtcbiAgICBjb25zdCBlbnYgPSBnZXRFbnZpcm9ubWVudEZvck5vbkludGVyYWN0aXZlQ29tbWFuZChvcHRpb25zLmVudik7XG5cbiAgICBMb2cuZGVidWcoYEV4ZWN1dGluZyBjb21tYW5kOiAke2NvbW1hbmRUZXh0fWApO1xuXG4gICAgY29uc3Qge1xuICAgICAgc3RhdHVzOiBleGl0Q29kZSxcbiAgICAgIHNpZ25hbCxcbiAgICAgIHN0ZG91dCxcbiAgICAgIHN0ZGVycixcbiAgICB9ID0gX3NwYXduU3luYyhjb21tYW5kLCBhcmdzLCB7Li4ub3B0aW9ucywgZW52LCBlbmNvZGluZzogJ3V0ZjgnLCBzaGVsbDogdHJ1ZSwgc3RkaW86ICdwaXBlJ30pO1xuXG4gICAgLyoqIFRoZSBzdGF0dXMgb2YgdGhlIHNwYXduIHJlc3VsdC4gKi9cbiAgICBjb25zdCBzdGF0dXMgPSBzdGF0dXNGcm9tRXhpdENvZGVBbmRTaWduYWwoZXhpdENvZGUsIHNpZ25hbCk7XG5cbiAgICBpZiAoc3RhdHVzID09PSAwIHx8IG9wdGlvbnMuc3VwcHJlc3NFcnJvck9uRmFpbGluZ0V4aXRDb2RlKSB7XG4gICAgICByZXR1cm4ge3N0YXR1cywgc3Rkb3V0LCBzdGRlcnJ9O1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihzdGRlcnIpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNwYXducyBhIGdpdmVuIGNvbW1hbmQgd2l0aCB0aGUgc3BlY2lmaWVkIGFyZ3VtZW50cyBpbnNpZGUgYSBzaGVsbC4gQWxsIHByb2Nlc3Mgc3Rkb3V0XG4gICAqIG91dHB1dCBpcyBjYXB0dXJlZCBhbmQgcmV0dXJuZWQgYXMgcmVzb2x1dGlvbiBvbiBjb21wbGV0aW9uLiBEZXBlbmRpbmcgb24gdGhlIGNob3NlblxuICAgKiBvdXRwdXQgbW9kZSwgc3Rkb3V0L3N0ZGVyciBvdXRwdXQgaXMgYWxzbyBwcmludGVkIHRvIHRoZSBjb25zb2xlLCBvciBvbmx5IG9uIGVycm9yLlxuICAgKlxuICAgKiBAcmV0dXJucyBhIFByb21pc2UgcmVzb2x2aW5nIHdpdGggY2FwdHVyZWQgc3Rkb3V0IGFuZCBzdGRlcnIgb24gc3VjY2Vzcy4gVGhlIHByb21pc2VcbiAgICogICByZWplY3RzIG9uIGNvbW1hbmQgZmFpbHVyZS5cbiAgICovXG4gIHN0YXRpYyBzcGF3bihjb21tYW5kOiBzdHJpbmcsIGFyZ3M6IHN0cmluZ1tdLCBvcHRpb25zOiBTcGF3bk9wdGlvbnMgPSB7fSk6IFByb21pc2U8U3Bhd25SZXN1bHQ+IHtcbiAgICBjb25zdCBjb21tYW5kVGV4dCA9IGAke2NvbW1hbmR9ICR7YXJncy5qb2luKCcgJyl9YDtcbiAgICBjb25zdCBlbnYgPSBnZXRFbnZpcm9ubWVudEZvck5vbkludGVyYWN0aXZlQ29tbWFuZChvcHRpb25zLmVudik7XG5cbiAgICByZXR1cm4gcHJvY2Vzc0FzeW5jQ21kKFxuICAgICAgY29tbWFuZFRleHQsXG4gICAgICBvcHRpb25zLFxuICAgICAgX3NwYXduKGNvbW1hbmQsIGFyZ3MsIHsuLi5vcHRpb25zLCBlbnYsIHNoZWxsOiB0cnVlLCBzdGRpbzogJ3BpcGUnfSksXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjcyBhIGdpdmVuIGNvbW1hbmQgd2l0aCB0aGUgc3BlY2lmaWVkIGFyZ3VtZW50cyBpbnNpZGUgYSBzaGVsbC4gQWxsIHByb2Nlc3Mgc3Rkb3V0XG4gICAqIG91dHB1dCBpcyBjYXB0dXJlZCBhbmQgcmV0dXJuZWQgYXMgcmVzb2x1dGlvbiBvbiBjb21wbGV0aW9uLiBEZXBlbmRpbmcgb24gdGhlIGNob3NlblxuICAgKiBvdXRwdXQgbW9kZSwgc3Rkb3V0L3N0ZGVyciBvdXRwdXQgaXMgYWxzbyBwcmludGVkIHRvIHRoZSBjb25zb2xlLCBvciBvbmx5IG9uIGVycm9yLlxuICAgKlxuICAgKiBAcmV0dXJucyBhIFByb21pc2UgcmVzb2x2aW5nIHdpdGggY2FwdHVyZWQgc3Rkb3V0IGFuZCBzdGRlcnIgb24gc3VjY2Vzcy4gVGhlIHByb21pc2VcbiAgICogICByZWplY3RzIG9uIGNvbW1hbmQgZmFpbHVyZS5cbiAgICovXG4gIHN0YXRpYyBleGVjKGNvbW1hbmQ6IHN0cmluZywgb3B0aW9uczogRXhlY09wdGlvbnMgPSB7fSk6IFByb21pc2U8U3Bhd25SZXN1bHQ+IHtcbiAgICBjb25zdCBlbnYgPSBnZXRFbnZpcm9ubWVudEZvck5vbkludGVyYWN0aXZlQ29tbWFuZChvcHRpb25zLmVudik7XG4gICAgcmV0dXJuIHByb2Nlc3NBc3luY0NtZChjb21tYW5kLCBvcHRpb25zLCBfZXhlYyhjb21tYW5kLCB7Li4ub3B0aW9ucywgZW52fSkpO1xuICB9XG59XG5cbi8qKlxuICogQ29udmVydCB0aGUgcHJvdmlkZWQgZXhpdENvZGUgYW5kIHNpZ25hbCB0byBhIHNpbmdsZSBzdGF0dXMgY29kZS5cbiAqXG4gKiBEdXJpbmcgYGV4aXRgIG5vZGUgcHJvdmlkZXMgZWl0aGVyIGEgYGNvZGVgIG9yIGBzaWduYWxgLCBvbmUgb2Ygd2hpY2ggaXMgZ3VhcmFudGVlZCB0byBiZVxuICogbm9uLW51bGwuXG4gKlxuICogRm9yIG1vcmUgZGV0YWlscyBzZWU6IGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvY2hpbGRfcHJvY2Vzcy5odG1sI2NoaWxkX3Byb2Nlc3NfZXZlbnRfZXhpdFxuICovXG5mdW5jdGlvbiBzdGF0dXNGcm9tRXhpdENvZGVBbmRTaWduYWwoZXhpdENvZGU6IG51bWJlciB8IG51bGwsIHNpZ25hbDogTm9kZUpTLlNpZ25hbHMgfCBudWxsKSB7XG4gIHJldHVybiBleGl0Q29kZSA/PyBzaWduYWwgPz8gLTE7XG59XG5cbi8qKlxuICogR2V0cyBhIHByb2Nlc3MgZW52aXJvbm1lbnQgb2JqZWN0IHdpdGggZGVmYXVsdHMgdGhhdCBjYW4gYmUgdXNlZCBmb3JcbiAqIHNwYXduaW5nIG5vbi1pbnRlcmFjdGl2ZSBjaGlsZCBwcm9jZXNzZXMuXG4gKlxuICogQ3VycmVudGx5IHdlIGVuYWJsZSBgRk9SQ0VfQ09MT1JgIHNpbmNlIG5vbi1pbnRlcmFjdGl2ZSBzcGF3bidzIHdpdGhcbiAqIG5vbi1pbmhlcml0ZWQgYHN0ZGlvYCB3aWxsIG5vdCBoYXZlIGNvbG9ycyBlbmFibGVkIGR1ZSB0byBhIG1pc3NpbmcgVFRZLlxuICovXG5mdW5jdGlvbiBnZXRFbnZpcm9ubWVudEZvck5vbkludGVyYWN0aXZlQ29tbWFuZChcbiAgdXNlclByb3ZpZGVkRW52PzogTm9kZUpTLlByb2Nlc3NFbnYsXG4pOiBOb2RlSlMuUHJvY2Vzc0VudiB7XG4gIC8vIFBhc3MgdGhyb3VnaCB0aGUgY29sb3IgbGV2ZWwgZnJvbSB0aGUgVFRZL3Byb2Nlc3MgcGVyZm9ybWluZyB0aGUgYHNwYXduYCBjYWxsLlxuICBjb25zdCBmb3JjZUNvbG9yVmFsdWUgPVxuICAgIHN1cHBvcnRzQ29sb3Iuc3Rkb3V0ICE9PSBmYWxzZSA/IHN1cHBvcnRzQ29sb3Iuc3Rkb3V0LmxldmVsLnRvU3RyaW5nKCkgOiB1bmRlZmluZWQ7XG5cbiAgcmV0dXJuIHtGT1JDRV9DT0xPUjogZm9yY2VDb2xvclZhbHVlLCAuLi4odXNlclByb3ZpZGVkRW52ID8/IHByb2Nlc3MuZW52KX07XG59XG5cbi8qKlxuICogUHJvY2VzcyB0aGUgQ2hpbGRQcm9jZXNzIG9iamVjdCBjcmVhdGVkIGJ5IGFuIGFzeW5jIGNvbW1hbmQuXG4gKi9cbmZ1bmN0aW9uIHByb2Nlc3NBc3luY0NtZChcbiAgY29tbWFuZDogc3RyaW5nLFxuICBvcHRpb25zOiBDb21tb25DbWRPcHRzLFxuICBjaGlsZFByb2Nlc3M6IF9DaGlsZFByb2Nlc3MsXG4pOiBQcm9taXNlPFNwYXduUmVzdWx0PiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgbGV0IGxvZ091dHB1dCA9ICcnO1xuICAgIGxldCBzdGRvdXQgPSAnJztcbiAgICBsZXQgc3RkZXJyID0gJyc7XG5cbiAgICBMb2cuZGVidWcoYEV4ZWN1dGluZyBjb21tYW5kOiAke2NvbW1hbmR9YCk7XG5cbiAgICAvLyBJZiBwcm92aWRlZCwgd3JpdGUgYGlucHV0YCB0ZXh0IHRvIHRoZSBwcm9jZXNzIGBzdGRpbmAuXG4gICAgaWYgKG9wdGlvbnMuaW5wdXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgYXNzZXJ0KFxuICAgICAgICBjaGlsZFByb2Nlc3Muc3RkaW4sXG4gICAgICAgICdDYW5ub3Qgd3JpdGUgcHJvY2VzcyBgaW5wdXRgIGlmIHRoZXJlIGlzIG5vIHBpcGUgYHN0ZGluYCBjaGFubmVsLicsXG4gICAgICApO1xuICAgICAgY2hpbGRQcm9jZXNzLnN0ZGluLndyaXRlKG9wdGlvbnMuaW5wdXQpO1xuICAgICAgY2hpbGRQcm9jZXNzLnN0ZGluLmVuZCgpO1xuICAgIH1cblxuICAgIC8vIENhcHR1cmUgdGhlIHN0ZG91dCBzZXBhcmF0ZWx5IHNvIHRoYXQgaXQgY2FuIGJlIHBhc3NlZCBhcyByZXNvbHZlIHZhbHVlLlxuICAgIC8vIFRoaXMgaXMgdXNlZnVsIGlmIGNvbW1hbmRzIHJldHVybiBwYXJzYWJsZSBzdGRvdXQuXG4gICAgY2hpbGRQcm9jZXNzLnN0ZGVycj8ub24oJ2RhdGEnLCAobWVzc2FnZSkgPT4ge1xuICAgICAgc3RkZXJyICs9IG1lc3NhZ2U7XG4gICAgICBsb2dPdXRwdXQgKz0gbWVzc2FnZTtcbiAgICAgIC8vIElmIGNvbnNvbGUgb3V0cHV0IGlzIGVuYWJsZWQsIHByaW50IHRoZSBtZXNzYWdlIGRpcmVjdGx5IHRvIHRoZSBzdGRlcnIuIE5vdGUgdGhhdFxuICAgICAgLy8gd2UgaW50ZW50aW9uYWxseSBwcmludCBhbGwgb3V0cHV0IHRvIHN0ZGVyciBhcyBzdGRvdXQgc2hvdWxkIG5vdCBiZSBwb2xsdXRlZC5cbiAgICAgIGlmIChvcHRpb25zLm1vZGUgPT09IHVuZGVmaW5lZCB8fCBvcHRpb25zLm1vZGUgPT09ICdlbmFibGVkJykge1xuICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShtZXNzYWdlKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNoaWxkUHJvY2Vzcy5zdGRvdXQ/Lm9uKCdkYXRhJywgKG1lc3NhZ2UpID0+IHtcbiAgICAgIHN0ZG91dCArPSBtZXNzYWdlO1xuICAgICAgbG9nT3V0cHV0ICs9IG1lc3NhZ2U7XG4gICAgICAvLyBJZiBjb25zb2xlIG91dHB1dCBpcyBlbmFibGVkLCBwcmludCB0aGUgbWVzc2FnZSBkaXJlY3RseSB0byB0aGUgc3RkZXJyLiBOb3RlIHRoYXRcbiAgICAgIC8vIHdlIGludGVudGlvbmFsbHkgcHJpbnQgYWxsIG91dHB1dCB0byBzdGRlcnIgYXMgc3Rkb3V0IHNob3VsZCBub3QgYmUgcG9sbHV0ZWQuXG4gICAgICBpZiAob3B0aW9ucy5tb2RlID09PSB1bmRlZmluZWQgfHwgb3B0aW9ucy5tb2RlID09PSAnZW5hYmxlZCcpIHtcbiAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUobWVzc2FnZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBUaGUgYGNsb3NlYCBldmVudCBpcyB1c2VkIGJlY2F1c2UgdGhlIHByb2Nlc3MgaXMgZ3VhcmFudGVlZCB0byBoYXZlIGNvbXBsZXRlZCB3cml0aW5nIHRvXG4gICAgLy8gc3Rkb3V0IGFuZCBzdGRlcnIsIHVzaW5nIHRoZSBgZXhpdGAgZXZlbnQgY2FuIGNhdXNlIGluY29uc2lzdGVudCBpbmZvcm1hdGlvbiBpbiBzdGRvdXQgYW5kXG4gICAgLy8gc3RkZXJyIGR1ZSB0byBhIHJhY2UgY29uZGl0aW9uIGFyb3VuZCBleGl0aW5nLlxuICAgIGNoaWxkUHJvY2Vzcy5vbignY2xvc2UnLCAoZXhpdENvZGUsIHNpZ25hbCkgPT4ge1xuICAgICAgY29uc3QgZXhpdERlc2NyaXB0aW9uID0gZXhpdENvZGUgIT09IG51bGwgPyBgZXhpdCBjb2RlIFwiJHtleGl0Q29kZX1cImAgOiBgc2lnbmFsIFwiJHtzaWduYWx9XCJgO1xuICAgICAgY29uc3QgcHJpbnRGbiA9IG9wdGlvbnMubW9kZSA9PT0gJ29uLWVycm9yJyA/IExvZy5lcnJvciA6IExvZy5kZWJ1ZztcbiAgICAgIGNvbnN0IHN0YXR1cyA9IHN0YXR1c0Zyb21FeGl0Q29kZUFuZFNpZ25hbChleGl0Q29kZSwgc2lnbmFsKTtcblxuICAgICAgcHJpbnRGbihgQ29tbWFuZCBcIiR7Y29tbWFuZH1cIiBjb21wbGV0ZWQgd2l0aCAke2V4aXREZXNjcmlwdGlvbn0uYCk7XG4gICAgICBwcmludEZuKGBQcm9jZXNzIG91dHB1dDogXFxuJHtsb2dPdXRwdXR9YCk7XG5cbiAgICAgIC8vIE9uIHN1Y2Nlc3MsIHJlc29sdmUgdGhlIHByb21pc2UuIE90aGVyd2lzZSByZWplY3Qgd2l0aCB0aGUgY2FwdHVyZWQgc3RkZXJyXG4gICAgICAvLyBhbmQgc3Rkb3V0IGxvZyBvdXRwdXQgaWYgdGhlIG91dHB1dCBtb2RlIHdhcyBzZXQgdG8gYHNpbGVudGAuXG4gICAgICBpZiAoc3RhdHVzID09PSAwIHx8IG9wdGlvbnMuc3VwcHJlc3NFcnJvck9uRmFpbGluZ0V4aXRDb2RlKSB7XG4gICAgICAgIHJlc29sdmUoe3N0ZG91dCwgc3RkZXJyLCBzdGF0dXN9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlamVjdChvcHRpb25zLm1vZGUgPT09ICdzaWxlbnQnID8gbG9nT3V0cHV0IDogdW5kZWZpbmVkKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG59XG4iXX0=