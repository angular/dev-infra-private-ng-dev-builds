import semver from 'semver';
import { ReleaseConfig } from '../config/index.js';
import { LtsNpmDistTag } from './long-term-support.js';
export type NpmDistTag = 'latest' | 'next' | 'do-not-use-exceptional-minor' | LtsNpmDistTag;
export interface NpmPackageInfo {
    'versions': {
        [name: string]: undefined | object;
    };
    'dist-tags': {
        [tagName: string]: string | undefined;
    };
    'time': {
        [name: string]: string;
    };
}
export declare const _npmPackageInfoCache: {
    [pkgName: string]: Promise<NpmPackageInfo>;
};
export declare function fetchProjectNpmPackageInfo(config: ReleaseConfig): Promise<NpmPackageInfo>;
export declare function isVersionPublishedToNpm(version: semver.SemVer, config: ReleaseConfig): Promise<boolean>;
