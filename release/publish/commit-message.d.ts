import semver from 'semver';
export declare function getCommitMessageForRelease(newVersion: semver.SemVer): string;
export declare function getCommitMessageForExceptionalNextVersionBump(newVersion: semver.SemVer): string;
export declare function getCommitMessageForNextBranchMajorSwitch(newVersion: semver.SemVer): string;
export declare function getReleaseNoteCherryPickCommitMessage(newVersion: semver.SemVer): string;
