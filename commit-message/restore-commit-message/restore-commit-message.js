import { writeFileSync } from 'fs';
import { Log } from '../../utils/logging.js';
import { loadCommitMessageDraft } from './commit-message-draft.js';
export function restoreCommitMessage(filePath, source) {
    if (!!source) {
        if (source === 'message') {
            Log.debug('A commit message was already provided via the command with a -m or -F flag');
        }
        if (source === 'template') {
            Log.debug('A commit message was already provided via the -t flag or config.template setting');
        }
        if (source === 'squash') {
            Log.debug('A commit message was already provided as a merge action or via .git/MERGE_MSG');
        }
        if (source === 'commit') {
            Log.debug('A commit message was already provided through a revision specified via --fixup, -c,');
            Log.debug('-C or --amend flag');
        }
        process.exit(0);
    }
    const commitMessage = loadCommitMessageDraft(filePath);
    if (commitMessage) {
        writeFileSync(filePath, commitMessage);
    }
    process.exit(0);
}
//# sourceMappingURL=restore-commit-message.js.map