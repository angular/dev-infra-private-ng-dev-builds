import semver from 'semver';
import { NpmDistTag } from '../versioning/index.js';
import { ReleaseBuildJsonStdout } from '../build/cli.js';
import { ReleaseInfoJsonStdout } from '../info/cli.js';
import { BuiltPackageWithInfo } from '../config/index.js';
import { PnpmVersioning } from './pnpm-versioning.js';
export declare abstract class ExternalCommands {
    static invokeSetNpmDist(projectDir: string, npmDistTag: NpmDistTag, version: semver.SemVer, pnpmVersioning: PnpmVersioning, options?: {
        skipExperimentalPackages: boolean;
    }): Promise<void>;
    static invokeDeleteNpmDistTag(projectDir: string, npmDistTag: NpmDistTag, pnpmVersioning: PnpmVersioning): Promise<void>;
    static invokeReleaseBuild(projectDir: string, pnpmVersioning: PnpmVersioning): Promise<ReleaseBuildJsonStdout>;
    static invokeReleaseInfo(projectDir: string, pnpmVersioning: PnpmVersioning): Promise<ReleaseInfoJsonStdout>;
    static invokeReleasePrecheck(projectDir: string, newVersion: semver.SemVer, builtPackagesWithInfo: BuiltPackageWithInfo[], pnpmVersioning: PnpmVersioning): Promise<void>;
    static invokeYarnInstall(projectDir: string): Promise<void>;
    static invokePnpmInstall(projectDir: string, pnpmVersioning: PnpmVersioning): Promise<void>;
    static invokeBazelUpdateAspectLockFiles(projectDir: string): Promise<void>;
    private static _spawnNpmScript;
}
