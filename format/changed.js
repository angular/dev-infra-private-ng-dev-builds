import { GitClient } from '../utils/git/git-client.js';
import { checkFiles, formatFiles } from './format.js';
function builder(argv) {
    return argv
        .option('check', {
        type: 'boolean',
        default: process.env['CI'] ? true : false,
        description: 'Run the formatter to check formatting rather than updating code format',
    })
        .positional('shaOrRef', { type: 'string' });
}
async function handler({ shaOrRef, check }) {
    const git = await GitClient.get();
    const sha = shaOrRef || git.mainBranchName;
    const executionCmd = check ? checkFiles : formatFiles;
    const allChangedFilesSince = git.allChangesFilesSince(sha);
    process.exitCode = await executionCmd(allChangedFilesSince);
}
export const ChangedModule = {
    builder,
    handler,
    command: 'changed [shaOrRef]',
    describe: 'Run the formatter on files changed since the provided sha/ref',
};
//# sourceMappingURL=changed.js.map