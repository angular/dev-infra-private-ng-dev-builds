/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import semver from 'semver';
import { GithubClient, GithubRepo } from '../../utils/git/github.js';
import { GithubConfig } from '../../utils/config.js';
/** Field in `package.json` that is used to indicate an in-progress exceptional minor. */
export declare const exceptionalMinorPackageIndicator: "__ngDevExceptionalMinor__";
/** Object describing a repository that can be released, together with an API client. */
export interface ReleaseRepoWithApi extends GithubRepo {
    /** API client that can access the repository. */
    api: GithubClient;
    /** Name of the next branch. */
    nextBranchName: string;
}
/** Type describing a version-branch. */
export interface VersionBranch {
    /** Name of the branch in Git. e.g. `10.0.x`. */
    name: string;
    /**
     * Parsed SemVer version for the version-branch. Version branches technically do
     * not follow the SemVer format, but we can have representative SemVer versions
     * that can be used for comparisons, sorting and other checks.
     */
    parsed: semver.SemVer;
}
/** Describes the concrete version of a version branch. */
export interface VersionInfo {
    version: semver.SemVer;
    isExceptionalMinor: boolean;
}
/** Type describing the parsed contents of a `package.json`. */
export type PackageJson = {
    version: string;
    [exceptionalMinorPackageIndicator]?: boolean;
    [otherUnknownFields: string]: unknown;
};
/**
 * Gets the name of the next branch from the Github configuration.
 *
 * Note that there is a clear separation between the main branch of the
 * upstream remote repository and the `next` release-train branch.
 */
export declare function getNextBranchName(github: GithubConfig): string;
/** Gets the version info for a branch by reading the `package.json` upstream. */
export declare function getVersionInfoForBranch(repo: ReleaseRepoWithApi, branchName: string): Promise<VersionInfo>;
/** Whether the given branch corresponds to a version branch. */
export declare function isVersionBranch(branchName: string): boolean;
/**
 * Gets the version branches for the specified major versions in descending
 * order. i.e. latest version branches first.
 */
export declare function getBranchesForMajorVersions(repo: ReleaseRepoWithApi, majorVersions: number[]): Promise<VersionBranch[]>;
/**
 * Converts a given version-branch into a SemVer version that can be used with SemVer
 * utilities. e.g. to determine semantic order, extract major digit, compare.
 *
 * For example `10.0.x` will become `10.0.0` in SemVer. The patch digit is not
 * relevant but needed for parsing. SemVer does not allow `x` as patch digit.
 */
export declare function convertVersionBranchToSemVer(branchName: string): semver.SemVer | null;
