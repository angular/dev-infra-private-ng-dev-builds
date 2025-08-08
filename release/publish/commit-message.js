export function getCommitMessageForRelease(newVersion) {
    return `release: cut the v${newVersion} release`;
}
export function getCommitMessageForExceptionalNextVersionBump(newVersion) {
    return `release: bump the next branch to v${newVersion}`;
}
export function getCommitMessageForNextBranchMajorSwitch(newVersion) {
    return `release: switch the next branch to v${newVersion}`;
}
export function getReleaseNoteCherryPickCommitMessage(newVersion) {
    return `docs: release notes for the v${newVersion} release`;
}
//# sourceMappingURL=commit-message.js.map