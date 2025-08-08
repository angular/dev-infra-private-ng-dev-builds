import { ChildProcess } from './child-process.js';
export function determineRepoBaseDirFromCwd() {
    const { stdout, stderr, status } = ChildProcess.spawnSync('git', ['rev-parse --show-toplevel']);
    if (status !== 0) {
        throw Error(`Unable to find the path to the base directory of the repository.\n` +
            `Was the command run from inside of the repo?\n\n` +
            `${stderr}`);
    }
    return stdout.trim();
}
//# sourceMappingURL=repo-directory.js.map