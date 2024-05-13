import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import semver from 'semver';
/** Project-relative path for the changelog file. */
const changelogPath = 'CHANGELOG.md';
/** Project-relative path for the changelog archive file. */
const changelogArchivePath = 'CHANGELOG_ARCHIVE.md';
/** A marker used to split a CHANGELOG.md file into individual entries. */
export const splitMarker = '<!-- CHANGELOG SPLIT MARKER -->';
/**
 * A string to use between each changelog entry when joining them together.
 *
 * Since all every changelog entry's content is trimmed, when joining back together, two new lines
 * must be placed around the splitMarker to create a one line buffer around the comment in the
 * markdown.
 * i.e.
 * <changelog entry content>
 *
 * <!-- CHANGELOG SPLIT MARKER -->
 *
 * <changelog entry content>
 */
const joinMarker = `\n\n${splitMarker}\n\n`;
/** A RegExp matcher to extract the version of a changelog entry from the entry content. */
const versionAnchorMatcher = new RegExp(`<a name="(.*)"></a>`);
export class Changelog {
    /** Prepend a changelog entry to the current changelog file. */
    static prependEntryToChangelogFile(git, entry) {
        const changelog = new this(git);
        changelog.prependEntryToChangelogFile(entry);
    }
    /**
     * Move all changelog entries from the CHANGELOG.md file for versions prior to the provided
     * version to the changelog archive.
     *
     * Versions should be used to determine which entries are moved to archive as versions are the
     * most accurate piece of context found within a changelog entry to determine its relationship to
     * other changelog entries.  This allows for example, moving all changelog entries out of the
     * main changelog when a version moves out of support.
     */
    static moveEntriesPriorToVersionToArchive(git, version) {
        const changelog = new this(git);
        changelog.moveEntriesPriorToVersionToArchive(version);
    }
    /**
     * Remove all changelog entries from the CHANGELOG.md file for versions which are prereleases
     * for the provided version. This is expected to be done on each major and minor release to remove
     * the changelog entries which will be made redundant by the first major/minor changelog for a
     * version.
     */
    static removePrereleaseEntriesForVersion(git, version) {
        const changelog = new this(git);
        changelog.removePrereleaseEntriesForVersion(version);
    }
    // TODO(josephperrott): Remove this after it is unused.
    /** Retrieve the file paths for the changelog files. */
    static getChangelogFilePaths(git) {
        return new this(git);
    }
    /**
     * The changelog entries in the CHANGELOG.md file.
     * Delays reading the CHANGELOG.md file until it is actually used.
     */
    get entries() {
        if (this._entries === undefined) {
            return (this._entries = this.getEntriesFor(this.filePath));
        }
        return this._entries;
    }
    /**
     * The changelog entries in the CHANGELOG_ARCHIVE.md file.
     * Delays reading the CHANGELOG_ARCHIVE.md file until it is actually used.
     */
    get archiveEntries() {
        if (this._archiveEntries === undefined) {
            return (this._archiveEntries = this.getEntriesFor(this.archiveFilePath));
        }
        return this._archiveEntries;
    }
    constructor(git) {
        this.git = git;
        /** The absolute path to the changelog file. */
        this.filePath = join(this.git.baseDir, changelogPath);
        /** The absolute path to the changelog archive file. */
        this.archiveFilePath = join(this.git.baseDir, changelogArchivePath);
        this._entries = undefined;
        this._archiveEntries = undefined;
    }
    /** Prepend a changelog entry to the changelog. */
    prependEntryToChangelogFile(entry) {
        this.entries.unshift(parseChangelogEntry(entry));
        this.writeToChangelogFile();
    }
    /**
     * Remove all changelog entries from the CHANGELOG.md file for versions which are prereleases
     * for the provided version. This is expected to be done on each major and minor release to remove
     * the changelog entries which will be made redundant by the first major/minor changelog for a
     * version.
     */
    removePrereleaseEntriesForVersion(version) {
        this._entries = this.entries.filter((entry) => {
            // For entries which are a prerelease, ensure that at least one segment of the version is
            // divergent from the version we are checking against.
            if (entry.version.prerelease.length !== 0) {
                return (version.major !== entry.version.major ||
                    version.minor !== entry.version.minor ||
                    version.patch !== entry.version.patch);
            }
            return true;
        });
        this.writeToChangelogFile();
    }
    /**
     * Move all changelog entries from the CHANGELOG.md file for versions prior to the provided
     * version to the changelog archive.
     *
     * Versions should be used to determine which entries are moved to archive as versions are the
     * most accurate piece of context found within a changelog entry to determine its relationship to
     * other changelog entries.  This allows for example, moving all changelog entries out of the
     * main changelog when a version moves out of support.
     */
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
    /** Update the changelog archive file with the known changelog archive entries. */
    writeToChangelogArchiveFile() {
        const changelogArchive = this.archiveEntries.map((entry) => entry.content).join(joinMarker);
        writeFileSync(this.archiveFilePath, changelogArchive);
    }
    /** Update the changelog file with the known changelog entries. */
    writeToChangelogFile() {
        const changelog = this.entries.map((entry) => entry.content).join(joinMarker);
        writeFileSync(this.filePath, changelog);
    }
    /**
     * Retrieve the changelog entries for the provide changelog path, if the file does not exist an
     * empty array is returned.
     */
    getEntriesFor(path) {
        if (!existsSync(path)) {
            return [];
        }
        return (readFileSync(path, { encoding: 'utf8' })
            // Use the versionMarker as the separator for .split().
            .split(splitMarker)
            // If the `split()` method finds the separator at the beginning or end of a string, it
            // includes an empty string at the respective locaiton, so we filter to remove all of these
            // potential empty strings.
            .filter((entry) => entry.trim().length !== 0)
            // Create a ChangelogEntry for each of the string entry.
            .map(parseChangelogEntry));
    }
}
/** Parse the provided string into a ChangelogEntry object. */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhbmdlbG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3JlbGVhc2Uvbm90ZXMvY2hhbmdlbG9nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBQyxVQUFVLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBQyxNQUFNLElBQUksQ0FBQztBQUMzRCxPQUFPLEVBQUMsSUFBSSxFQUFDLE1BQU0sTUFBTSxDQUFDO0FBQzFCLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUc1QixvREFBb0Q7QUFDcEQsTUFBTSxhQUFhLEdBQUcsY0FBYyxDQUFDO0FBRXJDLDREQUE0RDtBQUM1RCxNQUFNLG9CQUFvQixHQUFHLHNCQUFzQixDQUFDO0FBRXBELDBFQUEwRTtBQUMxRSxNQUFNLENBQUMsTUFBTSxXQUFXLEdBQUcsaUNBQWlDLENBQUM7QUFFN0Q7Ozs7Ozs7Ozs7OztHQVlHO0FBQ0gsTUFBTSxVQUFVLEdBQUcsT0FBTyxXQUFXLE1BQU0sQ0FBQztBQUU1QywyRkFBMkY7QUFDM0YsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0FBUS9ELE1BQU0sT0FBTyxTQUFTO0lBQ3BCLCtEQUErRDtJQUMvRCxNQUFNLENBQUMsMkJBQTJCLENBQUMsR0FBYyxFQUFFLEtBQWE7UUFDOUQsTUFBTSxTQUFTLEdBQUcsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDaEMsU0FBUyxDQUFDLDJCQUEyQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFFRDs7Ozs7Ozs7T0FRRztJQUNILE1BQU0sQ0FBQyxrQ0FBa0MsQ0FBQyxHQUFjLEVBQUUsT0FBc0I7UUFDOUUsTUFBTSxTQUFTLEdBQUcsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDaEMsU0FBUyxDQUFDLGtDQUFrQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFF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QUMsQ0FBQztZQUNwQyx1REFBdUQ7YUFDdEQsS0FBSyxDQUFDLFdBQVcsQ0FBQztZQUNuQixzRkFBc0Y7WUFDdEYsMkZBQTJGO1lBQzNGLDJCQUEyQjthQUMxQixNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDO1lBQzdDLHdEQUF3RDthQUN2RCxHQUFHLENBQUMsbUJBQW1CLENBQUMsQ0FDNUIsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQUVELDhEQUE4RDtBQUM5RCxTQUFTLG1CQUFtQixDQUFDLE9BQWU7SUFDMUMsTUFBTSxvQkFBb0IsR0FBRyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDaEUsSUFBSSxvQkFBb0IsS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUNsQyxNQUFNLEtBQUssQ0FBQyxvREFBb0QsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUM3RSxDQUFDO0lBQ0QsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRXRELElBQUksT0FBTyxLQUFLLElBQUksRUFBRSxDQUFDO1FBQ3JCLE1BQU0sS0FBSyxDQUNULDhEQUE4RCxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUN4RixDQUFDO0lBQ0osQ0FBQztJQUVELE9BQU87UUFDTCxPQUFPLEVBQUUsT0FBTyxDQUFDLElBQUksRUFBRTtRQUN2QixPQUFPO0tBQ1IsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge2V4aXN0c1N5bmMsIHJlYWRGaWxlU3luYywgd3JpdGVGaWxlU3luY30gZnJvbSAnZnMnO1xuaW1wb3J0IHtqb2lufSBmcm9tICdwYXRoJztcbmltcG9ydCBzZW12ZXIgZnJvbSAnc2VtdmVyJztcbmltcG9ydCB7R2l0Q2xpZW50fSBmcm9tICcuLi8uLi91dGlscy9naXQvZ2l0LWNsaWVudC5qcyc7XG5cbi8qKiBQcm9qZWN0LXJlbGF0aXZlIHBhdGggZm9yIHRoZSBjaGFuZ2Vsb2cgZmlsZS4gKi9cbmNvbnN0IGNoYW5nZWxvZ1BhdGggPSAnQ0hBTkdFTE9HLm1kJztcblxuLyoqIFByb2plY3QtcmVsYXRpdmUgcGF0aCBmb3IgdGhlIGNoYW5nZWxvZyBhcmNoaXZlIGZpbGUuICovXG5jb25zdCBjaGFuZ2Vsb2dBcmNoaXZlUGF0aCA9ICdDSEFOR0VMT0dfQVJDSElWRS5tZCc7XG5cbi8qKiBBIG1hcmtlciB1c2VkIHRvIHNwbGl0IGEgQ0hBTkdFTE9HLm1kIGZpbGUgaW50byBpbmRpdmlkdWFsIGVudHJpZXMuICovXG5leHBvcnQgY29uc3Qgc3BsaXRNYXJrZXIgPSAnPCEtLSBDSEFOR0VMT0cgU1BMSVQgTUFSS0VSIC0tPic7XG5cbi8qKlxuICogQSBzdHJpbmcgdG8gdXNlIGJldHdlZW4gZWFjaCBjaGFuZ2Vsb2cgZW50cnkgd2hlbiBqb2luaW5nIHRoZW0gdG9nZXRoZXIuXG4gKlxuICogU2luY2UgYWxsIGV2ZXJ5IGNoYW5nZWxvZyBlbnRyeSdzIGNvbnRlbnQgaXMgdHJpbW1lZCwgd2hlbiBqb2luaW5nIGJhY2sgdG9nZXRoZXIsIHR3byBuZXcgbGluZXNcbiAqIG11c3QgYmUgcGxhY2VkIGFyb3VuZCB0aGUgc3BsaXRNYXJrZXIgdG8gY3JlYXRlIGEgb25lIGxpbmUgYnVmZmVyIGFyb3VuZCB0aGUgY29tbWVudCBpbiB0aGVcbiAqIG1hcmtkb3duLlxuICogaS5lLlxuICogPGNoYW5nZWxvZyBlbnRyeSBjb250ZW50PlxuICpcbiAqIDwhLS0gQ0hBTkdFTE9HIFNQTElUIE1BUktFUiAtLT5cbiAqXG4gKiA8Y2hhbmdlbG9nIGVudHJ5IGNvbnRlbnQ+XG4gKi9cbmNvbnN0IGpvaW5NYXJrZXIgPSBgXFxuXFxuJHtzcGxpdE1hcmtlcn1cXG5cXG5gO1xuXG4vKiogQSBSZWdFeHAgbWF0Y2hlciB0byBleHRyYWN0IHRoZSB2ZXJzaW9uIG9mIGEgY2hhbmdlbG9nIGVudHJ5IGZyb20gdGhlIGVudHJ5IGNvbnRlbnQuICovXG5jb25zdCB2ZXJzaW9uQW5jaG9yTWF0Y2hlciA9IG5ldyBSZWdFeHAoYDxhIG5hbWU9XCIoLiopXCI+PC9hPmApO1xuXG4vKiogQW4gaW5kaXZpZHVhbCBjaGFuZ2Vsb2cgZW50cnkuICovXG5pbnRlcmZhY2UgQ2hhbmdlbG9nRW50cnkge1xuICBjb250ZW50OiBzdHJpbmc7XG4gIHZlcnNpb246IHNlbXZlci5TZW1WZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBDaGFuZ2Vsb2cge1xuICAvKiogUHJlcGVuZCBhIGNoYW5nZWxvZyBlbnRyeSB0byB0aGUgY3VycmVudCBjaGFuZ2Vsb2cgZmlsZS4gKi9cbiAgc3RhdGljIHByZXBlbmRFbnRyeVRvQ2hhbmdlbG9nRmlsZShnaXQ6IEdpdENsaWVudCwgZW50cnk6IHN0cmluZykge1xuICAgIGNvbnN0IGNoYW5nZWxvZyA9IG5ldyB0aGlzKGdpdCk7XG4gICAgY2hhbmdlbG9nLnByZXBlbmRFbnRyeVRvQ2hhbmdlbG9nRmlsZShlbnRyeSk7XG4gIH1cblxuICAvKipcbiAgICogTW92ZSBhbGwgY2hhbmdlbG9nIGVudHJpZXMgZnJvbSB0aGUgQ0hBTkdFTE9HLm1kIGZpbGUgZm9yIHZlcnNpb25zIHByaW9yIHRvIHRoZSBwcm92aWRlZFxuICAgKiB2ZXJzaW9uIHRvIHRoZSBjaGFuZ2Vsb2cgYXJjaGl2ZS5cbiAgICpcbiAgICogVmVyc2lvbnMgc2hvdWxkIGJlIHVzZWQgdG8gZGV0ZXJtaW5lIHdoaWNoIGVudHJpZXMgYXJlIG1vdmVkIHRvIGFyY2hpdmUgYXMgdmVyc2lvbnMgYXJlIHRoZVxuICAgKiBtb3N0IGFjY3VyYXRlIHBpZWNlIG9mIGNvbnRleHQgZm91bmQgd2l0aGluIGEgY2hhbmdlbG9nIGVudHJ5IHRvIGRldGVybWluZSBpdHMgcmVsYXRpb25zaGlwIHRvXG4gICAqIG90aGVyIGNoYW5nZWxvZyBlbnRyaWVzLiAgVGhpcyBhbGxvd3MgZm9yIGV4YW1wbGUsIG1vdmluZyBhbGwgY2hhbmdlbG9nIGVudHJpZXMgb3V0IG9mIHRoZVxuICAgKiBtYWluIGNoYW5nZWxvZyB3aGVuIGEgdmVyc2lvbiBtb3ZlcyBvdXQgb2Ygc3VwcG9ydC5cbiAgICovXG4gIHN0YXRpYyBtb3ZlRW50cmllc1ByaW9yVG9WZXJzaW9uVG9BcmNoaXZlKGdpdDogR2l0Q2xpZW50LCB2ZXJzaW9uOiBzZW12ZXIuU2VtVmVyKSB7XG4gICAgY29uc3QgY2hhbmdlbG9nID0gbmV3IHRoaXMoZ2l0KTtcbiAgICBjaGFuZ2Vsb2cubW92ZUVudHJpZXNQcmlvclRvVmVyc2lvblRvQXJjaGl2ZSh2ZXJzaW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYWxsIGNoYW5nZWxvZyBlbnRyaWVzIGZyb20gdGhlIENIQU5HRUxPRy5tZCBmaWxlIGZvciB2ZXJzaW9ucyB3aGljaCBhcmUgcHJlcmVsZWFzZXNcbiAgICogZm9yIHRoZSBwcm92aWRlZCB2ZXJzaW9uLiBUaGlzIGlzIGV4cGVjdGVkIHRvIGJlIGRvbmUgb24gZWFjaCBtYWpvciBhbmQgbWlub3IgcmVsZWFzZSB0byByZW1vdmVcbiAgICogdGhlIGNoYW5nZWxvZyBlbnRyaWVzIHdoaWNoIHdpbGwgYmUgbWFkZSByZWR1bmRhbnQgYnkgdGhlIGZpcnN0IG1ham9yL21pbm9yIGNoYW5nZWxvZyBmb3IgYVxuICAgKiB2ZXJzaW9uLlxuICAgKi9cbiAgc3RhdGljIHJlbW92ZVByZXJlbGVhc2VFbnRyaWVzRm9yVmVyc2lvbihnaXQ6IEdpdENsaWVudCwgdmVyc2lvbjogc2VtdmVyLlNlbVZlcikge1xuICAgIGNvbnN0IGNoYW5nZWxvZyA9IG5ldyB0aGlzKGdpdCk7XG4gICAgY2hhbmdlbG9nLnJlbW92ZVByZXJlbGVhc2VFbnRyaWVzRm9yVmVyc2lvbih2ZXJzaW9uKTtcbiAgfVxuXG4gIC8vIFRPRE8oam9zZXBocGVycm90dCk6IFJlbW92ZSB0aGlzIGFmdGVyIGl0IGlzIHVudXNlZC5cbiAgLyoqIFJldHJpZXZlIHRoZSBmaWxlIHBhdGhzIGZvciB0aGUgY2hhbmdlbG9nIGZpbGVzLiAqL1xuICBzdGF0aWMgZ2V0Q2hhbmdlbG9nRmlsZVBhdGhzKGdpdDogR2l0Q2xpZW50KSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzKGdpdCk7XG4gIH1cblxuICAvKiogVGhlIGFic29sdXRlIHBhdGggdG8gdGhlIGNoYW5nZWxvZyBmaWxlLiAqL1xuICByZWFkb25seSBmaWxlUGF0aCA9IGpvaW4odGhpcy5naXQuYmFzZURpciwgY2hhbmdlbG9nUGF0aCk7XG4gIC8qKiBUaGUgYWJzb2x1dGUgcGF0aCB0byB0aGUgY2hhbmdlbG9nIGFyY2hpdmUgZmlsZS4gKi9cbiAgcmVhZG9ubHkgYXJjaGl2ZUZpbGVQYXRoID0gam9pbih0aGlzLmdpdC5iYXNlRGlyLCBjaGFuZ2Vsb2dBcmNoaXZlUGF0aCk7XG4gIC8qKlxuICAgKiBUaGUgY2hhbmdlbG9nIGVudHJpZXMgaW4gdGhlIENIQU5HRUxPRy5tZCBmaWxlLlxuICAgKiBEZWxheXMgcmVhZGluZyB0aGUgQ0hBTkdFTE9HLm1kIGZpbGUgdW50aWwgaXQgaXMgYWN0dWFsbHkgdXNlZC5cbiAgICovXG4gIHByaXZhdGUgZ2V0IGVudHJpZXMoKSB7XG4gICAgaWYgKHRoaXMuX2VudHJpZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuICh0aGlzLl9lbnRyaWVzID0gdGhpcy5nZXRFbnRyaWVzRm9yKHRoaXMuZmlsZVBhdGgpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuX2VudHJpZXM7XG4gIH1cbiAgcHJpdmF0ZSBfZW50cmllczogdW5kZWZpbmVkIHwgQ2hhbmdlbG9nRW50cnlbXSA9IHVuZGVmaW5lZDtcbiAgLyoqXG4gICAqIFRoZSBjaGFuZ2Vsb2cgZW50cmllcyBpbiB0aGUgQ0hBTkdFTE9HX0FSQ0hJVkUubWQgZmlsZS5cbiAgICogRGVsYXlzIHJlYWRpbmcgdGhlIENIQU5HRUxPR19BUkNISVZFLm1kIGZpbGUgdW50aWwgaXQgaXMgYWN0dWFsbHkgdXNlZC5cbiAgICovXG4gIHByaXZhdGUgZ2V0IGFyY2hpdmVFbnRyaWVzKCkge1xuICAgIGlmICh0aGlzLl9hcmNoaXZlRW50cmllcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gKHRoaXMuX2FyY2hpdmVFbnRyaWVzID0gdGhpcy5nZXRFbnRyaWVzRm9yKHRoaXMuYXJjaGl2ZUZpbGVQYXRoKSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9hcmNoaXZlRW50cmllcztcbiAgfVxuICBwcml2YXRlIF9hcmNoaXZlRW50cmllczogdW5kZWZpbmVkIHwgQ2hhbmdlbG9nRW50cnlbXSA9IHVuZGVmaW5lZDtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKHByaXZhdGUgZ2l0OiBHaXRDbGllbnQpIHt9XG5cbiAgLyoqIFByZXBlbmQgYSBjaGFuZ2Vsb2cgZW50cnkgdG8gdGhlIGNoYW5nZWxvZy4gKi9cbiAgcHJpdmF0ZSBwcmVwZW5kRW50cnlUb0NoYW5nZWxvZ0ZpbGUoZW50cnk6IHN0cmluZykge1xuICAgIHRoaXMuZW50cmllcy51bnNoaWZ0KHBhcnNlQ2hhbmdlbG9nRW50cnkoZW50cnkpKTtcbiAgICB0aGlzLndyaXRlVG9DaGFuZ2Vsb2dGaWxlKCk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGFsbCBjaGFuZ2Vsb2cgZW50cmllcyBmcm9tIHRoZSBDSEFOR0VMT0cubWQgZmlsZSBmb3IgdmVyc2lvbnMgd2hpY2ggYXJlIHByZXJlbGVhc2VzXG4gICAqIGZvciB0aGUgcHJvdmlkZWQgdmVyc2lvbi4gVGhpcyBpcyBleHBlY3RlZCB0byBiZSBkb25lIG9uIGVhY2ggbWFqb3IgYW5kIG1pbm9yIHJlbGVhc2UgdG8gcmVtb3ZlXG4gICAqIHRoZSBjaGFuZ2Vsb2cgZW50cmllcyB3aGljaCB3aWxsIGJlIG1hZGUgcmVkdW5kYW50IGJ5IHRoZSBmaXJzdCBtYWpvci9taW5vciBjaGFuZ2Vsb2cgZm9yIGFcbiAgICogdmVyc2lvbi5cbiAgICovXG4gIHByaXZhdGUgcmVtb3ZlUHJlcmVsZWFzZUVudHJpZXNGb3JWZXJzaW9uKHZlcnNpb246IHNlbXZlci5TZW1WZXIpIHtcbiAgICB0aGlzLl9lbnRyaWVzID0gdGhpcy5lbnRyaWVzLmZpbHRlcigoZW50cnk6IENoYW5nZWxvZ0VudHJ5KSA9PiB7XG4gICAgICAvLyBGb3IgZW50cmllcyB3aGljaCBhcmUgYSBwcmVyZWxlYXNlLCBlbnN1cmUgdGhhdCBhdCBsZWFzdCBvbmUgc2VnbWVudCBvZiB0aGUgdmVyc2lvbiBpc1xuICAgICAgLy8gZGl2ZXJnZW50IGZyb20gdGhlIHZlcnNpb24gd2UgYXJlIGNoZWNraW5nIGFnYWluc3QuXG4gICAgICBpZiAoZW50cnkudmVyc2lvbi5wcmVyZWxlYXNlLmxlbmd0aCAhPT0gMCkge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIHZlcnNpb24ubWFqb3IgIT09IGVudHJ5LnZlcnNpb24ubWFqb3IgfHxcbiAgICAgICAgICB2ZXJzaW9uLm1pbm9yICE9PSBlbnRyeS52ZXJzaW9uLm1pbm9yIHx8XG4gICAgICAgICAgdmVyc2lvbi5wYXRjaCAhPT0gZW50cnkudmVyc2lvbi5wYXRjaFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gICAgdGhpcy53cml0ZVRvQ2hhbmdlbG9nRmlsZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIE1vdmUgYWxsIGNoYW5nZWxvZyBlbnRyaWVzIGZyb20gdGhlIENIQU5HRUxPRy5tZCBmaWxlIGZvciB2ZXJzaW9ucyBwcmlvciB0byB0aGUgcHJvdmlkZWRcbiAgICogdmVyc2lvbiB0byB0aGUgY2hhbmdlbG9nIGFyY2hpdmUuXG4gICAqXG4gICAqIFZlcnNpb25zIHNob3VsZCBiZSB1c2VkIHRvIGRldGVybWluZSB3aGljaCBlbnRyaWVzIGFyZSBtb3ZlZCB0byBhcmNoaXZlIGFzIHZlcnNpb25zIGFyZSB0aGVcbiAgICogbW9zdCBhY2N1cmF0ZSBwaWVjZSBvZiBjb250ZXh0IGZvdW5kIHdpdGhpbiBhIGNoYW5nZWxvZyBlbnRyeSB0byBkZXRlcm1pbmUgaXRzIHJlbGF0aW9uc2hpcCB0b1xuICAgKiBvdGhlciBjaGFuZ2Vsb2cgZW50cmllcy4gIFRoaXMgYWxsb3dzIGZvciBleGFtcGxlLCBtb3ZpbmcgYWxsIGNoYW5nZWxvZyBlbnRyaWVzIG91dCBvZiB0aGVcbiAgICogbWFpbiBjaGFuZ2Vsb2cgd2hlbiBhIHZlcnNpb24gbW92ZXMgb3V0IG9mIHN1cHBvcnQuXG4gICAqL1xuICBwcml2YXRlIG1vdmVFbnRyaWVzUHJpb3JUb1ZlcnNpb25Ub0FyY2hpdmUodmVyc2lvbjogc2VtdmVyLlNlbVZlcikge1xuICAgIFsuLi50aGlzLmVudHJpZXNdLnJldmVyc2UoKS5mb3JFYWNoKChlbnRyeTogQ2hhbmdlbG9nRW50cnkpID0+IHtcbiAgICAgIGlmIChzZW12ZXIubHQoZW50cnkudmVyc2lvbiwgdmVyc2lvbikpIHtcbiAgICAgICAgdGhpcy5hcmNoaXZlRW50cmllcy51bnNoaWZ0KGVudHJ5KTtcbiAgICAgICAgdGhpcy5lbnRyaWVzLnNwbGljZSh0aGlzLmVudHJpZXMuaW5kZXhPZihlbnRyeSksIDEpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy53cml0ZVRvQ2hhbmdlbG9nRmlsZSgpO1xuICAgIGlmICh0aGlzLmFyY2hpdmVFbnRyaWVzLmxlbmd0aCkge1xuICAgICAgdGhpcy53cml0ZVRvQ2hhbmdlbG9nQXJjaGl2ZUZpbGUoKTtcbiAgICB9XG4gIH1cblxuICAvKiogVXBkYXRlIHRoZSBjaGFuZ2Vsb2cgYXJjaGl2ZSBmaWxlIHdpdGggdGhlIGtub3duIGNoYW5nZWxvZyBhcmNoaXZlIGVudHJpZXMuICovXG4gIHByaXZhdGUgd3JpdGVUb0NoYW5nZWxvZ0FyY2hpdmVGaWxlKCk6IHZvaWQge1xuICAgIGNvbnN0IGNoYW5nZWxvZ0FyY2hpdmUgPSB0aGlzLmFyY2hpdmVFbnRyaWVzLm1hcCgoZW50cnkpID0+IGVudHJ5LmNvbnRlbnQpLmpvaW4oam9pbk1hcmtlcik7XG4gICAgd3JpdGVGaWxlU3luYyh0aGlzLmFyY2hpdmVGaWxlUGF0aCwgY2hhbmdlbG9nQXJjaGl2ZSk7XG4gIH1cblxuICAvKiogVXBkYXRlIHRoZSBjaGFuZ2Vsb2cgZmlsZSB3aXRoIHRoZSBrbm93biBjaGFuZ2Vsb2cgZW50cmllcy4gKi9cbiAgcHJpdmF0ZSB3cml0ZVRvQ2hhbmdlbG9nRmlsZSgpOiB2b2lkIHtcbiAgICBjb25zdCBjaGFuZ2Vsb2cgPSB0aGlzLmVudHJpZXMubWFwKChlbnRyeSkgPT4gZW50cnkuY29udGVudCkuam9pbihqb2luTWFya2VyKTtcbiAgICB3cml0ZUZpbGVTeW5jKHRoaXMuZmlsZVBhdGgsIGNoYW5nZWxvZyk7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmUgdGhlIGNoYW5nZWxvZyBlbnRyaWVzIGZvciB0aGUgcHJvdmlkZSBjaGFuZ2Vsb2cgcGF0aCwgaWYgdGhlIGZpbGUgZG9lcyBub3QgZXhpc3QgYW5cbiAgICogZW1wdHkgYXJyYXkgaXMgcmV0dXJuZWQuXG4gICAqL1xuICBwcml2YXRlIGdldEVudHJpZXNGb3IocGF0aDogc3RyaW5nKTogQ2hhbmdlbG9nRW50cnlbXSB7XG4gICAgaWYgKCFleGlzdHNTeW5jKHBhdGgpKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgcmV0dXJuIChcbiAgICAgIHJlYWRGaWxlU3luYyhwYXRoLCB7ZW5jb2Rpbmc6ICd1dGY4J30pXG4gICAgICAgIC8vIFVzZSB0aGUgdmVyc2lvbk1hcmtlciBhcyB0aGUgc2VwYXJhdG9yIGZvciAuc3BsaXQoKS5cbiAgICAgICAgLnNwbGl0KHNwbGl0TWFya2VyKVxuICAgICAgICAvLyBJZiB0aGUgYHNwbGl0KClgIG1ldGhvZCBmaW5kcyB0aGUgc2VwYXJhdG9yIGF0IHRoZSBiZWdpbm5pbmcgb3IgZW5kIG9mIGEgc3RyaW5nLCBpdFxuICAgICAgICAvLyBpbmNsdWRlcyBhbiBlbXB0eSBzdHJpbmcgYXQgdGhlIHJlc3BlY3RpdmUgbG9jYWl0b24sIHNvIHdlIGZpbHRlciB0byByZW1vdmUgYWxsIG9mIHRoZXNlXG4gICAgICAgIC8vIHBvdGVudGlhbCBlbXB0eSBzdHJpbmdzLlxuICAgICAgICAuZmlsdGVyKChlbnRyeSkgPT4gZW50cnkudHJpbSgpLmxlbmd0aCAhPT0gMClcbiAgICAgICAgLy8gQ3JlYXRlIGEgQ2hhbmdlbG9nRW50cnkgZm9yIGVhY2ggb2YgdGhlIHN0cmluZyBlbnRyeS5cbiAgICAgICAgLm1hcChwYXJzZUNoYW5nZWxvZ0VudHJ5KVxuICAgICk7XG4gIH1cbn1cblxuLyoqIFBhcnNlIHRoZSBwcm92aWRlZCBzdHJpbmcgaW50byBhIENoYW5nZWxvZ0VudHJ5IG9iamVjdC4gKi9cbmZ1bmN0aW9uIHBhcnNlQ2hhbmdlbG9nRW50cnkoY29udGVudDogc3RyaW5nKTogQ2hhbmdlbG9nRW50cnkge1xuICBjb25zdCB2ZXJzaW9uTWF0Y2hlclJlc3VsdCA9IHZlcnNpb25BbmNob3JNYXRjaGVyLmV4ZWMoY29udGVudCk7XG4gIGlmICh2ZXJzaW9uTWF0Y2hlclJlc3VsdCA9PT0gbnVsbCkge1xuICAgIHRocm93IEVycm9yKGBVbmFibGUgdG8gZGV0ZXJtaW5lIHZlcnNpb24gZm9yIGNoYW5nZWxvZyBlbnRyeTogJHtjb250ZW50fWApO1xuICB9XG4gIGNvbnN0IHZlcnNpb24gPSBzZW12ZXIucGFyc2UodmVyc2lvbk1hdGNoZXJSZXN1bHRbMV0pO1xuXG4gIGlmICh2ZXJzaW9uID09PSBudWxsKSB7XG4gICAgdGhyb3cgRXJyb3IoXG4gICAgICBgVW5hYmxlIHRvIGRldGVybWluZSB2ZXJzaW9uIGZvciBjaGFuZ2Vsb2cgZW50cnksIHdpdGggdGFnOiAke3ZlcnNpb25NYXRjaGVyUmVzdWx0WzFdfWAsXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgY29udGVudDogY29udGVudC50cmltKCksXG4gICAgdmVyc2lvbixcbiAgfTtcbn1cbiJdfQ==