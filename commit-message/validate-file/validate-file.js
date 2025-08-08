import { readFileSync } from 'fs';
import { resolve } from 'path';
import { green, Log, yellow } from '../../utils/logging.js';
import { GitClient } from '../../utils/git/git-client.js';
import { deleteCommitMessageDraft, saveCommitMessageDraft, } from '../restore-commit-message/commit-message-draft.js';
import { printValidationErrors, validateCommitMessage } from '../validate.js';
export async function validateFile(filePath, isErrorMode) {
    const git = await GitClient.get();
    const commitMessage = readFileSync(resolve(git.baseDir, filePath), 'utf8');
    const { valid, errors } = await validateCommitMessage(commitMessage);
    if (valid) {
        Log.info(`${green('✔')}  Valid commit message`);
        deleteCommitMessageDraft(filePath);
        process.exitCode = 0;
        return;
    }
    let printFn = isErrorMode ? Log.error : Log.log;
    printFn(isErrorMode ? '✘ Invalid commit message.' : yellow('! Invalid commit message.'));
    printValidationErrors(errors, printFn);
    if (isErrorMode) {
        printFn('Aborting commit attempt due to invalid commit message.');
        printFn('Commit message aborted as failure rather than warning due to local configuration.');
    }
    else {
        printFn(yellow('Before this commit can be merged into the upstream repository, it must be'));
        printFn(yellow('amended to follow commit message guidelines.'));
    }
    saveCommitMessageDraft(filePath, commitMessage);
    process.exitCode = isErrorMode ? 1 : 0;
}
//# sourceMappingURL=validate-file.js.map