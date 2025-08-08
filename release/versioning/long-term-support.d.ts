import semver from 'semver';
import { ReleaseConfig } from '../config/index.js';
export type LtsNpmDistTag = `v${number}-lts`;
export interface LtsBranches {
    active: LtsBranch[];
    inactive: LtsBranch[];
}
export interface LtsBranch {
    name: string;
    version: semver.SemVer;
    npmDistTag: LtsNpmDistTag;
}
export declare function fetchLongTermSupportBranchesFromNpm(config: ReleaseConfig): Promise<LtsBranches>;
export declare function isLtsDistTag(tagName: string): tagName is LtsNpmDistTag;
export declare function computeLtsEndDateOfMajor(majorReleaseDate: Date): Date;
export declare function getLtsNpmDistTagOfMajor(major: number): LtsNpmDistTag;
