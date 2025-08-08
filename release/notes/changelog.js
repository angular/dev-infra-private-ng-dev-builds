import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import semver from 'semver';
const changelogPath = 'CHANGELOG.md';
const changelogArchivePath = 'CHANGELOG_ARCHIVE.md';
export const splitMarker = '<!-- CHANGELOG SPLIT MARKER -->';
const joinMarker = `\n\n${splitMarker}\n\n`;
const versionAnchorMatcher = new RegExp(`<a name="(.*)"></a>`);
export class Changelog {
    static prependEntryToChangelogFile(git, entry) {
        const changelog = new this(git);
        changelog.prependEntryToChangelogFile(entry);
    }
    static moveEntriesPriorToVersionToArchive(git, version) {
        const changelog = new this(git);
        changelog.moveEntriesPriorToVersionToArchive(version);
    }
    static removePrereleaseEntriesForVersion(git, version) {
        const changelog = new this(git);
        changelog.removePrereleaseEntriesForVersion(version);
    }
    static getChangelogFilePaths(git) {
        return new this(git);
    }
    get entries() {
        if (this._entries === undefined) {
            return (this._entries = this.getEntriesFor(this.filePath));
        }
        return this._entries;
    }
    get archiveEntries() {
        if (this._archiveEntries === undefined) {
            return (this._archiveEntries = this.getEntriesFor(this.archiveFilePath));
        }
        return this._archiveEntries;
    }
    constructor(git) {
        this.git = git;
        this.filePath = join(this.git.baseDir, changelogPath);
        this.archiveFilePath = join(this.git.baseDir, changelogArchivePath);
        this._entries = undefined;
        this._archiveEntries = undefined;
    }
    prependEntryToChangelogFile(entry) {
        this.entries.unshift(parseChangelogEntry(entry));
        this.writeToChangelogFile();
    }
    removePrereleaseEntriesForVersion(version) {
        this._entries = this.entries.filter((entry) => {
            if (entry.version.prerelease.length !== 0) {
                return (version.major !== entry.version.major ||
                    version.minor !== entry.version.minor ||
                    version.patch !== entry.version.patch);
            }
            return true;
        });
        this.writeToChangelogFile();
    }
    moveEntriesPriorToVersionToArchive(version) {
        [...this.entries].reverse().forEach((entry) => {
            if (semver.lt(entry.version, version)) {
                this.archiveEntries.unshift(entry);
                this.entries.splice(this.entries.indexOf(entry), 1);
            }
        });
        this.writeToChangelogFile();
        if (this.archiveEntries.length) {
            this.writeToChangelogArchiveFile();
        }
    }
    writeToChangelogArchiveFile() {
        const changelogArchive = this.archiveEntries.map((entry) => entry.content).join(joinMarker);
        writeFileSync(this.archiveFilePath, changelogArchive);
    }
    writeToChangelogFile() {
        const changelog = this.entries.map((entry) => entry.content).join(joinMarker);
        writeFileSync(this.filePath, changelog, {});
    }
    getEntriesFor(path) {
        if (!existsSync(path)) {
            return [];
        }
        return (readFileSync(path, { encoding: 'utf8' })
            .split(splitMarker)
            .filter((entry) => entry.trim().length !== 0)
            .map(parseChangelogEntry));
    }
}
function parseChangelogEntry(content) {
    const versionMatcherResult = versionAnchorMatcher.exec(content);
    if (versionMatcherResult === null) {
        throw Error(`Unable to determine version for changelog entry: ${content}`);
    }
    const version = semver.parse(versionMatcherResult[1]);
    if (version === null) {
        throw Error(`Unable to determine version for changelog entry, with tag: ${versionMatcherResult[1]}`);
    }
    return {
        content: content.trim(),
        version,
    };
}
//# sourceMappingURL=changelog.js.map