import { getUserConfig } from '../../utils/config.js';
import { validateFile } from './validate-file.js';
function builder(argv) {
    return argv
        .option('file', {
        type: 'string',
        conflicts: ['file-env-variable'],
        description: 'The path of the commit message file.',
    })
        .option('file-env-variable', {
        type: 'string',
        conflicts: ['file'],
        description: 'The key of the environment variable for the path of the commit message file.',
        coerce: (arg) => {
            if (arg === undefined) {
                return arg;
            }
            const file = process.env[arg];
            if (!file) {
                throw new Error(`Provided environment variable "${arg}" was not found.`);
            }
            return file;
        },
    })
        .option('error', {
        type: 'boolean',
        description: 'Whether invalid commit messages should be treated as failures rather than a warning',
        default: null,
        defaultDescription: '`True` on CI or can be enabled through ng-dev user-config.',
    });
}
async function handler({ error, file, fileEnvVariable }) {
    const isErrorMode = error === null ? await getIsErrorModeDefault() : error;
    const filePath = file || fileEnvVariable || '.git/COMMIT_EDITMSG';
    await validateFile(filePath, isErrorMode);
}
async function getIsErrorModeDefault() {
    return !!process.env['CI'] || !!(await getUserConfig())['commitMessage']?.errorOnInvalidMessage;
}
export const ValidateFileModule = {
    handler,
    builder,
    command: 'pre-commit-validate',
    describe: 'Validate the most recent commit message',
};
//# sourceMappingURL=cli.js.map