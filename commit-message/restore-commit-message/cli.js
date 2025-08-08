import { restoreCommitMessage } from './restore-commit-message.js';
function builder(argv) {
    return argv
        .option('file-env-variable', {
        type: 'string',
        description: 'The key for the environment variable which holds the arguments for the\n' +
            'prepare-commit-msg hook as described here:\n' +
            'https://git-scm.com/docs/githooks#_prepare_commit_msg',
    })
        .positional('file', { type: 'string' })
        .positional('source', { type: 'string' });
}
async function handler({ fileEnvVariable, file, source }) {
    if (file !== undefined) {
        restoreCommitMessage(file, source);
        return;
    }
    if (fileEnvVariable !== undefined) {
        const [fileFromEnv, sourceFromEnv] = (process.env[fileEnvVariable] || '').split(' ');
        if (!fileFromEnv) {
            throw new Error(`Provided environment variable "${fileEnvVariable}" was not found.`);
        }
        restoreCommitMessage(fileFromEnv, sourceFromEnv);
        return;
    }
    throw new Error('No file path and commit message source provide. Provide values via positional command ' +
        'arguments, or via the --file-env-variable flag');
}
export const RestoreCommitMessageModule = {
    handler,
    builder,
    command: 'restore-commit-message-draft [file] [source]',
    describe: false,
};
//# sourceMappingURL=cli.js.map