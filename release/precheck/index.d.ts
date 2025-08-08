import yargs from 'semver';
import { BuiltPackageWithInfo, ReleaseConfig } from '../config/index.js';
export declare class ReleasePrecheckError extends Error {
}
export declare function assertPassingReleasePrechecks(config: ReleaseConfig, newVersion: yargs.SemVer, builtPackagesWithInfo: BuiltPackageWithInfo[]): Promise<boolean>;
