import semver from 'semver';
import { GitClient } from '../../utils/git/git-client.js';
export declare const splitMarker = "<!-- CHANGELOG SPLIT MARKER -->";
export declare class Changelog {
    private git;
    static prependEntryToChangelogFile(git: GitClient, entry: string): void;
    static moveEntriesPriorToVersionToArchive(git: GitClient, version: semver.SemVer): void;
    static removePrereleaseEntriesForVersion(git: GitClient, version: semver.SemVer): void;
    static getChangelogFilePaths(git: GitClient): Changelog;
    readonly filePath: string;
    readonly archiveFilePath: string;
    private get entries();
    private _entries;
    private get archiveEntries();
    private _archiveEntries;
    private constructor();
    private prependEntryToChangelogFile;
    private removePrereleaseEntriesForVersion;
    private moveEntriesPriorToVersionToArchive;
    private writeToChangelogArchiveFile;
    private writeToChangelogFile;
    private getEntriesFor;
}
