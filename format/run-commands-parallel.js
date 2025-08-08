import { Bar } from 'cli-progress';
import multimatch from 'multimatch';
import { cpus } from 'os';
import { ChildProcess } from '../utils/child-process.js';
import { Log } from '../utils/logging.js';
import { getActiveFormatters } from './formatters/index.js';
const AVAILABLE_THREADS = Math.max(Math.min(cpus().length, 8) - 1, 1);
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
        const progressBar = new Bar({
            format: `[{bar}] ETA: {eta}s | {value}/{total} files`,
            clearOnComplete: true,
        });
        const threads = new Array(AVAILABLE_THREADS).fill(false);
        function runCommandInThread(thread) {
            const nextCommand = pendingCommands.pop();
            if (nextCommand === undefined) {
                threads[thread] = false;
                return;
            }
            const { file, formatter } = nextCommand;
            const [spawnCmd, ...spawnArgs] = [...formatter.commandFor(action).split(' '), file];
            ChildProcess.spawn(spawnCmd, spawnArgs, {
                suppressErrorOnFailingExitCode: true,
                mode: 'silent',
            }).then(({ stdout, stderr, status }) => {
                const failed = formatter.callbackFor(action)(file, status, stdout, stderr);
                if (failed) {
                    failures.push({ filePath: file, message: stderr });
                }
                progressBar.increment(1);
                if (pendingCommands.length) {
                    return runCommandInThread(thread);
                }
                threads[thread] = false;
                if (threads.every((active) => !active)) {
                    progressBar.stop();
                    resolve(failures);
                }
            });
            threads[thread] = true;
        }
        progressBar.start(pendingCommands.length, 0);
        threads.forEach((_, idx) => runCommandInThread(idx));
    });
}
//# sourceMappingURL=run-commands-parallel.js.map