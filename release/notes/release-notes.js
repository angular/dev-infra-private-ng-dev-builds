import { render } from 'ejs';
import semver from 'semver';
import { formatFiles } from '../../format/format.js';
import { assertValidReleaseConfig } from '../config/index.js';
import { RenderContext } from './context.js';
import changelogTemplate from './templates/changelog.js';
import githubReleaseTemplate from './templates/github-release.js';
import { getCommitsForRangeWithDeduping } from './commits/get-commits-in-range.js';
import { getConfig } from '../../utils/config.js';
import { assertValidFormatConfig } from '../../format/config.js';
import { Changelog } from './changelog.js';
import { Prompt } from '../../utils/prompt.js';
export const workspaceRelativeChangelogPath = 'CHANGELOG.md';
export class ReleaseNotes {
    static async forRange(git, version, baseRef, headRef) {
        const config = await getConfig([assertValidReleaseConfig]);
        const commits = getCommitsForRangeWithDeduping(git, baseRef, headRef);
        return new ReleaseNotes(config, version, commits, git);
    }
    constructor(config, version, commits, git) {
        this.config = config;
        this.version = version;
        this.commits = commits;
        this.git = git;
    }
    async getGithubReleaseEntry() {
        return render(githubReleaseTemplate, await this.generateRenderContext(), {
            rmWhitespace: true,
        });
    }
    async getChangelogEntry() {
        return render(changelogTemplate, await this.generateRenderContext(), { rmWhitespace: true });
    }
    async prependEntryToChangelogFile() {
        if (semver.prerelease(this.version) === null) {
            Changelog.removePrereleaseEntriesForVersion(this.git, this.version);
        }
        Changelog.prependEntryToChangelogFile(this.git, await this.getChangelogEntry());
        try {
            assertValidFormatConfig(await this.config);
            await formatFiles([Changelog.getChangelogFilePaths(this.git).filePath]);
        }
        catch {
        }
    }
    async getCommitCountInReleaseNotes() {
        const context = await this.generateRenderContext();
        return context.commits.filter(context.includeInReleaseNotes()).length;
    }
    async getUrlFragmentForRelease() {
        return (await this.generateRenderContext()).urlFragmentForRelease;
    }
    async promptForReleaseTitle() {
        const notesConfig = await this._getNotesConfig();
        if (this.title === undefined) {
            if (notesConfig.useReleaseTitle) {
                this.title = await Prompt.input({ message: 'Please provide a title for the release:' });
            }
            else {
                this.title = false;
            }
        }
        return this.title;
    }
    async generateRenderContext() {
        const notesConfig = await this._getNotesConfig();
        if (!this.renderContext) {
            this.renderContext = new RenderContext({
                commits: this.commits,
                github: this.git.remoteConfig,
                version: this.version.format(),
                groupOrder: notesConfig.groupOrder,
                hiddenScopes: notesConfig.hiddenScopes,
                categorizeCommit: notesConfig.categorizeCommit,
                title: await this.promptForReleaseTitle(),
            });
        }
        return this.renderContext;
    }
    async _getNotesConfig() {
        return (await this.config).release.releaseNotes ?? {};
    }
}
//# sourceMappingURL=release-notes.js.map