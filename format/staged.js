import { GitClient } from '../utils/git/git-client.js';
import { checkFiles, formatFiles } from './format.js';
function builder(argv) {
    return argv.option('check', {
        type: 'boolean',
        default: process.env['CI'] ? true : false,
        description: 'Run the formatter to check formatting rather than updating code format',
    });
}
async function handler({ check }) {
    const git = await GitClient.get();
    const executionCmd = check ? checkFiles : formatFiles;
    const allStagedFiles = git.allStagedFiles();
    process.exitCode = await executionCmd(allStagedFiles);
    if (!check && process.exitCode === 0) {
        git.runGraceful(['add', ...allStagedFiles]);
    }
}
export const StagedModule = {
    builder,
    handler,
    command: 'staged',
    describe: 'Run the formatter on all staged files',
};
//# sourceMappingURL=staged.js.map