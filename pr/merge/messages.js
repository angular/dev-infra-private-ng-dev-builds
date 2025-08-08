import { red, bold } from '../../utils/logging.js';
export function getCaretakerNotePromptMessage(pullRequest) {
    return (red('Pull request has a caretaker note applied. Please make sure you read it.') +
        `\nQuick link to PR: ${pullRequest.url}\nDo you want to proceed merging?`);
}
export function getTargetedBranchesConfirmationPromptMessage() {
    return `Do you want to proceed merging?`;
}
export function getTargetedBranchesMessage(pullRequest) {
    const targetBranchListAsString = pullRequest.targetBranches
        .map((b) => `  - ${bold(b)}`)
        .join('\n');
    return `Pull Request #${pullRequest.prNumber} will merge into:\n${targetBranchListAsString}`;
}
//# sourceMappingURL=messages.js.map