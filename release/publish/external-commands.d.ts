import semver from 'semver';
import { NpmDistTag } from '../versioning/index.js';
import { ReleaseBuildJsonStdout } from '../build/cli.js';
import { ReleaseInfoJsonStdout } from '../info/cli.js';
import { BuiltPackageWithInfo } from '../config/index.js';
export declare abstract class ExternalCommands {
    static invokeSetNpmDist(projectDir: string, npmDistTag: NpmDistTag, version: semver.SemVer, options?: {
        skipExperimentalPackages: boolean;
    }): Promise<void>;
    static invokeDeleteNpmDistTag(projectDir: string, npmDistTag: NpmDistTag): Promise<void>;
    static invokeReleaseBuild(projectDir: string): Promise<ReleaseBuildJsonStdout>;
    static invokeReleaseInfo(projectDir: string): Promise<ReleaseInfoJsonStdout>;
    static invokeReleasePrecheck(projectDir: string, newVersion: semver.SemVer, builtPackagesWithInfo: BuiltPackageWithInfo[]): Promise<void>;
    static invokeNvmInstall(projectDir: string): Promise<void>;
    static invokeNvmInstall(projectDir: string, quiet: boolean): Promise<void>;
    static invokeYarnInstall(projectDir: string): Promise<void>;
    static invokePnpmInstall(projectDir: string): Promise<void>;
    private static _spawnNpmScript;
    static invokeBazelUpdateAspectLockFiles(projectDir: string): Promise<void>;
}
