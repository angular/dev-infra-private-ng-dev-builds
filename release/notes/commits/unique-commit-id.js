const fieldsToIncorporateForId = ['header', 'isFixup', 'isRevert', 'isSquash'];
export function computeUniqueIdFromCommitMessage(commit) {
    return fieldsToIncorporateForId.map((f) => commit[f]).join('ɵɵ');
}
//# sourceMappingURL=unique-commit-id.js.map