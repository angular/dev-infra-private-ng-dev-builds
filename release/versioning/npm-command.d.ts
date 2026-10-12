import semver from 'semver';
import { NpmDistTag } from './npm-registry.js';
export declare abstract class NpmCommand {
    static publish(packagePath: string, distTag: NpmDistTag, registryUrl: string | undefined, cwd?: string): Promise<void>;
    static checkVersionExists(packageName: string, version: string, registryUrl: string | undefined, cwd?: string): Promise<boolean>;
    static deprecate(packageName: string, version: string, message: string, registryUrl: string | undefined, cwd?: string): Promise<void>;
    static setDistTagForPackage(packageName: string, distTag: string, version: semver.SemVer, registryUrl: string | undefined): Promise<void>;
    static deleteDistTagForPackage(packageName: string, distTag: string, registryUrl: string | undefined): Promise<void>;
    static checkIsLoggedIn(registryUrl: string | undefined): Promise<boolean>;
    static startInteractiveLogin(registryUrl: string | undefined): Promise<void>;
    static logout(registryUrl: string | undefined): Promise<boolean>;
}
