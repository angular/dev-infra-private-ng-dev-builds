import { checkFiles, formatFiles } from './format.js';
import glob from 'fast-glob';
function builder(argv) {
    return argv
        .option('check', {
        type: 'boolean',
        default: process.env['CI'] ? true : false,
        description: 'Run the formatter to check formatting rather than updating code format',
    })
        .positional('files', { array: true, type: 'string', demandOption: true });
}
async function handler({ files, check }) {
    const expandedFiles = glob.sync(files.map((file) => file.replace(/\/...$/, '/**/*')), { onlyFiles: true });
    const executionCmd = check ? checkFiles : formatFiles;
    process.exitCode = await executionCmd(expandedFiles);
}
export const FilesModule = {
    builder,
    handler,
    command: 'files <files..>',
    describe: 'Run the formatter on provided files',
};
//# sourceMappingURL=files.js.map