import semver from 'semver';
import { GithubClient, GithubRepo } from '../../utils/git/github.js';
import { GithubConfig } from '../../utils/config.js';
export declare const exceptionalMinorPackageIndicator: "__ngDevExceptionalMinor__";
export interface ReleaseRepoWithApi extends GithubRepo {
    api: GithubClient;
    nextBranchName: string;
}
export interface VersionBranch {
    name: string;
    parsed: semver.SemVer;
}
export interface VersionInfo {
    version: semver.SemVer;
    isExceptionalMinor: boolean;
}
export type PackageJson = {
    version: string;
    [exceptionalMinorPackageIndicator]?: boolean;
    [otherUnknownFields: string]: unknown;
};
export declare function getNextBranchName(github: GithubConfig): string;
export declare function getVersionInfoForBranch(repo: ReleaseRepoWithApi, branchName: string): Promise<VersionInfo>;
export declare function isVersionBranch(branchName: string): boolean;
export declare function getBranchesForMajorVersions(repo: ReleaseRepoWithApi, majorVersions: number[]): Promise<VersionBranch[]>;
export declare function convertVersionBranchToSemVer(branchName: string): semver.SemVer | null;
