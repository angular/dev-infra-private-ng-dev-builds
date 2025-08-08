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
    const allFiles = git.allFiles();
    process.exitCode = await executionCmd(allFiles);
}
export const AllFilesModule = {
    builder,
    handler,
    command: 'all',
    describe: 'Run the formatter on all files in the repository',
};
//# sourceMappingURL=all.js.map