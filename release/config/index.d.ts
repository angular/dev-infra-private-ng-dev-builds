import { CommitFromGitLog } from '../../commit-message/parse.js';
import { NgDevConfig } from '../../utils/config.js';
export interface BuiltPackage {
    name: string;
    outputPath: string;
}
export interface NpmPackage {
    name: string;
    experimental?: boolean;
}
export interface ReleaseConfig {
    publishRegistry?: string;
    representativeNpmPackage: string;
    npmPackages: NpmPackage[];
    buildPackages: () => Promise<BuiltPackage[] | null>;
    releasePrLabels?: string[];
    releaseNotes?: ReleaseNotesConfig;
    prereleaseCheck?: (newVersion: string, builtPackagesWithInfo: BuiltPackageWithInfo[]) => Promise<void>;
}
export interface BuiltPackageWithInfo extends BuiltPackage, NpmPackage {
    hash: string;
}
export interface ReleaseNotesConfig {
    useReleaseTitle?: boolean;
    hiddenScopes?: string[];
    categorizeCommit?: (commit: CommitFromGitLog) => {
        groupName?: string;
        description?: string;
    };
    groupOrder?: string[];
}
export type DevInfraReleaseConfig = {
    release: ReleaseConfig;
};
export declare function assertValidReleaseConfig<T extends NgDevConfig>(config: T & Partial<DevInfraReleaseConfig>): asserts config is T & DevInfraReleaseConfig;
