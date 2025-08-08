import semver from 'semver';
export declare class ReleaseTrain {
    branchName: string;
    version: semver.SemVer;
    isMajor: boolean;
    constructor(branchName: string, version: semver.SemVer);
}
