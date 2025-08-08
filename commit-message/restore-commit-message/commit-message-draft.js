import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
export function loadCommitMessageDraft(basePath) {
    const commitMessageDraftPath = `${basePath}.ngDevSave`;
    if (existsSync(commitMessageDraftPath)) {
        return readFileSync(commitMessageDraftPath).toString();
    }
    return '';
}
export function deleteCommitMessageDraft(basePath) {
    const commitMessageDraftPath = `${basePath}.ngDevSave`;
    if (existsSync(commitMessageDraftPath)) {
        unlinkSync(commitMessageDraftPath);
    }
}
export function saveCommitMessageDraft(basePath, commitMessage) {
    writeFileSync(`${basePath}.ngDevSave`, commitMessage);
}
//# sourceMappingURL=commit-message-draft.js.map