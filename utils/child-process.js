import supportsColor from 'supports-color';
import { spawn as _spawn, spawnSync as _spawnSync, exec as _exec, } from 'child_process';
import { Log } from './logging.js';
import assert from 'assert';
export class ChildProcess {
    static spawnInteractive(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const commandText = `${command} ${args.join(' ')}`;
            Log.debug(`Executing command: ${commandText}`);
            const childProcess = _spawn(command, args, { ...options, shell: true, stdio: 'inherit' });
            childProcess.on('close', (status) => (status === 0 ? resolve() : reject(status)));
        });
    }
    static spawnSync(command, args, options = {}) {
        const commandText = `${command} ${args.join(' ')}`;
        const env = getEnvironmentForNonInteractiveCommand(options.env);
        Log.debug(`Executing command: ${commandText}`);
        const { status: exitCode, signal, stdout, stderr, } = _spawnSync(command, args, { ...options, env, encoding: 'utf8', shell: true, stdio: 'pipe' });
        const status = statusFromExitCodeAndSignal(exitCode, signal);
        if (status === 0 || options.suppressErrorOnFailingExitCode) {
            return { status, stdout, stderr };
        }
        throw new Error(stderr);
    }
    static spawn(command, args, options = {}) {
        const commandText = `${command} ${args.join(' ')}`;
        const env = getEnvironmentForNonInteractiveCommand(options.env);
        return processAsyncCmd(commandText, options, _spawn(command, args, { ...options, env, shell: true, stdio: 'pipe' }));
    }
    static exec(command, options = {}) {
        const env = getEnvironmentForNonInteractiveCommand(options.env);
        return processAsyncCmd(command, options, _exec(command, { ...options, env }));
    }
}
function statusFromExitCodeAndSignal(exitCode, signal) {
    return exitCode ?? signal ?? -1;
}
function getEnvironmentForNonInteractiveCommand(userProvidedEnv) {
    const forceColorValue = supportsColor.stdout !== false ? supportsColor.stdout.level.toString() : undefined;
    return { FORCE_COLOR: forceColorValue, ...(userProvidedEnv ?? process.env) };
}
function processAsyncCmd(command, options, childProcess) {
    return new Promise((resolve, reject) => {
        let logOutput = '';
        let stdout = '';
        let stderr = '';
        Log.debug(`Executing command: ${command}`);
        if (options.input !== undefined) {
            assert(childProcess.stdin, 'Cannot write process `input` if there is no pipe `stdin` channel.');
            childProcess.stdin.write(options.input);
            childProcess.stdin.end();
        }
        childProcess.stderr?.on('data', (message) => {
            stderr += message;
            logOutput += message;
            if (options.mode === undefined || options.mode === 'enabled') {
                process.stderr.write(message);
            }
        });
        childProcess.stdout?.on('data', (message) => {
            stdout += message;
            logOutput += message;
            if (options.mode === undefined || options.mode === 'enabled') {
                process.stderr.write(message);
            }
        });
        childProcess.on('close', (exitCode, signal) => {
            const exitDescription = exitCode !== null ? `exit code "${exitCode}"` : `signal "${signal}"`;
            const printFn = options.mode === 'on-error' ? Log.error : Log.debug;
            const status = statusFromExitCodeAndSignal(exitCode, signal);
            printFn(`Command "${command}" completed with ${exitDescription}.`);
            printFn(`Process output: \n${logOutput}`);
            if (status === 0 || options.suppressErrorOnFailingExitCode) {
                resolve({ stdout, stderr, status });
            }
            else {
                reject(options.mode === 'silent' ? logOutput : undefined);
            }
        });
    });
}
//# sourceMappingURL=child-process.js.map