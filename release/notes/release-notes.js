/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
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
/** Workspace-relative path for the changelog file. */
export const workspaceRelativeChangelogPath = 'CHANGELOG.md';
/** Release note generation. */
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
    /** Retrieve the release note generated for a Github Release. */
    async getGithubReleaseEntry() {
        return render(githubReleaseTemplate, await this.generateRenderContext(), {
            rmWhitespace: true,
        });
    }
    /** Retrieve the release note generated for a CHANGELOG entry. */
    async getChangelogEntry() {
        return render(changelogTemplate, await this.generateRenderContext(), { rmWhitespace: true });
    }
    /**
     * Prepend generated release note to the CHANGELOG.md file in the base directory of the repository
     * provided by the GitClient. Removes entries for related prerelease entries as appropriate.
     */
    async prependEntryToChangelogFile() {
        // When the version for the entry is a non-prelease (i.e. 1.0.0 rather than 1.0.0-next.1), the
        // pre-release entries for the version should be removed from the changelog.
        if (semver.prerelease(this.version) === null) {
            Changelog.removePrereleaseEntriesForVersion(this.git, this.version);
        }
        Changelog.prependEntryToChangelogFile(this.git, await this.getChangelogEntry());
        // TODO(josephperrott): Remove file formatting calls.
        //   Upon reaching a standardized formatting for markdown files, rather than calling a formatter
        //   for all creation of changelogs, we instead will confirm in our testing that the new changes
        //   created for changelogs meet on standardized markdown formats via unit testing.
        try {
            assertValidFormatConfig(await this.config);
            await formatFiles([Changelog.getChangelogFilePaths(this.git).filePath]);
        }
        catch {
            // If the formatting is either unavailable or fails, continue on with the unformatted result.
        }
    }
    /** Retrieve the number of commits included in the release notes after filtering and deduping. */
    async getCommitCountInReleaseNotes() {
        const context = await this.generateRenderContext();
        return context.commits.filter(context.includeInReleaseNotes()).length;
    }
    /**
     * Gets the URL fragment for the release notes. The URL fragment identifier
     * can be used to point to a specific changelog entry through an URL.
     */
    async getUrlFragmentForRelease() {
        return (await this.generateRenderContext()).urlFragmentForRelease;
    }
    /**
     * Prompt the user for a title for the release, if the project's configuration is defined to use a
     * title.
     */
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
    /** Build the render context data object for constructing the RenderContext instance. */
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
    /** Gets the configuration for the release notes. */
    async _getNotesConfig() {
        return (await this.config).release.releaseNotes ?? {};
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVsZWFzZS1ub3Rlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL25vdGVzL3JlbGVhc2Utbm90ZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLEtBQUssQ0FBQztBQUMzQixPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFHNUIsT0FBTyxFQUFDLFdBQVcsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBRW5ELE9BQU8sRUFBQyx3QkFBd0IsRUFBZ0IsTUFBTSxvQkFBb0IsQ0FBQztBQUMzRSxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBRTNDLE9BQU8saUJBQWlCLE1BQU0sMEJBQTBCLENBQUM7QUFDekQsT0FBTyxxQkFBcUIsTUFBTSwrQkFBK0IsQ0FBQztBQUNsRSxPQUFPLEVBQUMsOEJBQThCLEVBQUMsTUFBTSxtQ0FBbUMsQ0FBQztBQUNqRixPQUFPLEVBQUMsU0FBUyxFQUFjLE1BQU0sdUJBQXVCLENBQUM7QUFDN0QsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDL0QsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLGdCQUFnQixDQUFDO0FBQ3pDLE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSx1QkFBdUIsQ0FBQztBQUU3QyxzREFBc0Q7QUFDdEQsTUFBTSxDQUFDLE1BQU0sOEJBQThCLEdBQUcsY0FBYyxDQUFDO0FBRTdELCtCQUErQjtBQUMvQixNQUFNLE9BQU8sWUFBWTtJQUN2QixNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFjLEVBQUUsT0FBc0IsRUFBRSxPQUFlLEVBQUUsT0FBZTtRQUM1RixNQUFNLE1BQU0sR0FBRyxNQUFNLFNBQVMsQ0FBQyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQztRQUMzRCxNQUFNLE9BQU8sR0FBRyw4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LEtBQUssQ0FBQztJQUNwQixDQUFDO0lBRUQsd0ZBQXdGO0lBQ2hGLEtBQUssQ0FBQyxxQkFBcUI7UUFDakMsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7UUFFakQsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN4QixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksYUFBYSxDQUFDO2dCQUNyQyxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU87Z0JBQ3JCLE1BQU0sRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVk7Z0JBQzdCLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRTtnQkFDOUIsVUFBVSxFQUFFLFdBQVcsQ0FBQyxVQUFVO2dCQUNsQyxZQUFZLEVBQUUsV0FBVyxDQUFDLFlBQVk7Z0JBQ3RDLGdCQUFnQixFQUFFLFdBQVcsQ0FBQyxnQkFBZ0I7Z0JBQzlDLEtBQUssRUFBRSxNQUFNLElBQUksQ0FBQyxxQkFBcUIsRUFBRTthQUMxQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDO0lBQzVCLENBQUM7SUFFRCxvREFBb0Q7SUFDNUMsS0FBSyxDQUFDLGVBQWU7UUFDM0IsT0FBTyxDQUFDLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLElBQUksRUFBRSxDQUFDO0lBQ3hELENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHtyZW5kZXJ9IGZyb20gJ2Vqcyc7XG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XG5pbXBvcnQge0NvbW1pdEZyb21HaXRMb2d9IGZyb20gJy4uLy4uL2NvbW1pdC1tZXNzYWdlL3BhcnNlLmpzJztcblxuaW1wb3J0IHtmb3JtYXRGaWxlc30gZnJvbSAnLi4vLi4vZm9ybWF0L2Zvcm1hdC5qcyc7XG5pbXBvcnQge0dpdENsaWVudH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdC1jbGllbnQuanMnO1xuaW1wb3J0IHthc3NlcnRWYWxpZFJlbGVhc2VDb25maWcsIFJlbGVhc2VDb25maWd9IGZyb20gJy4uL2NvbmZpZy9pbmRleC5qcyc7XG5pbXBvcnQge1JlbmRlckNvbnRleHR9IGZyb20gJy4vY29udGV4dC5qcyc7XG5cbmltcG9ydCBjaGFuZ2Vsb2dUZW1wbGF0ZSBmcm9tICcuL3RlbXBsYXRlcy9jaGFuZ2Vsb2cuanMnO1xuaW1wb3J0IGdpdGh1YlJlbGVhc2VUZW1wbGF0ZSBmcm9tICcuL3RlbXBsYXRlcy9naXRodWItcmVsZWFzZS5qcyc7XG5pbXBvcnQge2dldENvbW1pdHNGb3JSYW5nZVdpdGhEZWR1cGluZ30gZnJvbSAnLi9jb21taXRzL2dldC1jb21taXRzLWluLXJhbmdlLmpzJztcbmltcG9ydCB7Z2V0Q29uZmlnLCBOZ0RldkNvbmZpZ30gZnJvbSAnLi4vLi4vdXRpbHMvY29uZmlnLmpzJztcbmltcG9ydCB7YXNzZXJ0VmFsaWRGb3JtYXRDb25maWd9IGZyb20gJy4uLy4uL2Zvcm1hdC9jb25maWcuanMnO1xuaW1wb3J0IHtDaGFuZ2Vsb2d9IGZyb20gJy4vY2hhbmdlbG9nLmpzJztcbmltcG9ydCB7UHJvbXB0fSBmcm9tICcuLi8uLi91dGlscy9wcm9tcHQuanMnO1xuXG4vKiogV29ya3NwYWNlLXJlbGF0aXZlIHBhdGggZm9yIHRoZSBjaGFuZ2Vsb2cgZmlsZS4gKi9cbmV4cG9ydCBjb25zdCB3b3Jrc3BhY2VSZWxhdGl2ZUNoYW5nZWxvZ1BhdGggPSAnQ0hBTkdFTE9HLm1kJztcblxuLyoqIFJlbGVhc2Ugbm90ZSBnZW5lcmF0aW9uLiAqL1xuZXhwb3J0IGNsYXNzIFJlbGVhc2VOb3RlcyB7XG4gIHN0YXRpYyBhc3luYyBmb3JSYW5nZShnaXQ6IEdpdENsaWVudCwgdmVyc2lvbjogc2VtdmVyLlNlbVZlciwgYmFzZVJlZjogc3RyaW5nLCBoZWFkUmVmOiBzdHJpbmcpIHtcbiAgICBjb25zdCBjb25maWcgPSBhd2FpdCBnZXRDb25maWcoW2Fzc2VydFZhbGlkUmVsZWFzZUNvbmZpZ10pO1xuICAgIGNvbnN0IGNvbW1pdHMgPSBnZXRDb21taXRzRm9yUmFuZ2VXaXRoRGVkdXBpbmcoZ2l0LCBiYXNlUmVmLCBoZWFkUmVmKTtcbiAgICByZXR1cm4gbmV3IFJlbGVhc2VOb3Rlcyhjb25maWcsIHZlcnNpb24sIGNvbW1pdHMsIGdpdCk7XG4gIH1cblxuICAvKiogVGhlIFJlbmRlckNvbnRleHQgdG8gYmUgdXNlZCBkdXJpbmcgcmVuZGVyaW5nLiAqL1xuICBwcml2YXRlIHJlbmRlckNvbnRleHQ6IFJlbmRlckNvbnRleHQgfCB1bmRlZmluZWQ7XG5cbiAgLyoqIFRoZSB0aXRsZSB0byB1c2UgZm9yIHRoZSByZWxlYXNlLiAqL1xuICBwcml2YXRlIHRpdGxlOiBzdHJpbmcgfCBmYWxzZSB8IHVuZGVmaW5lZDtcblxuICBwcm90ZWN0ZWQgY29uc3RydWN0b3IoXG4gICAgcHVibGljIGNvbmZpZzogTmdEZXZDb25maWc8e3JlbGVhc2U6IFJlbGVhc2VDb25maWd9PixcbiAgICBwdWJsaWMgdmVyc2lvbjogc2VtdmVyLlNlbVZlcixcbiAgICBwcml2YXRlIGNvbW1pdHM6IENvbW1pdEZyb21HaXRMb2dbXSxcbiAgICBwcml2YXRlIGdpdDogR2l0Q2xpZW50LFxuICApIHt9XG5cbiAgLyoqIFJldHJpZXZlIHRoZSByZWxlYXNlIG5vdGUgZ2VuZXJhdGVkIGZvciBhIEdpdGh1YiBSZWxlYXNlLiAqL1xuICBhc3luYyBnZXRHaXRodWJSZWxlYXNlRW50cnkoKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gcmVuZGVyKGdpdGh1YlJlbGVhc2VUZW1wbGF0ZSwgYXdhaXQgdGhpcy5nZW5lcmF0ZVJlbmRlckNvbnRleHQoKSwge1xuICAgICAgcm1XaGl0ZXNwYWNlOiB0cnVlLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqIFJldHJpZXZlIHRoZSByZWxlYXNlIG5vdGUgZ2VuZXJhdGVkIGZvciBhIENIQU5HRUxPRyBlbnRyeS4gKi9cbiAgYXN5bmMgZ2V0Q2hhbmdlbG9nRW50cnkoKSB7XG4gICAgcmV0dXJuIHJlbmRlcihjaGFuZ2Vsb2dUZW1wbGF0ZSwgYXdhaXQgdGhpcy5nZW5lcmF0ZVJlbmRlckNvbnRleHQoKSwge3JtV2hpdGVzcGFjZTogdHJ1ZX0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFByZXBlbmQgZ2VuZXJhdGVkIHJlbGVhc2Ugbm90ZSB0byB0aGUgQ0hBTkdFTE9HLm1kIGZpbGUgaW4gdGhlIGJhc2UgZGlyZWN0b3J5IG9mIHRoZSByZXBvc2l0b3J5XG4gICAqIHByb3ZpZGVkIGJ5IHRoZSBHaXRDbGllbnQuIFJlbW92ZXMgZW50cmllcyBmb3IgcmVsYXRlZCBwcmVyZWxlYXNlIGVudHJpZXMgYXMgYXBwcm9wcmlhdGUuXG4gICAqL1xuICBhc3luYyBwcmVwZW5kRW50cnlUb0NoYW5nZWxvZ0ZpbGUoKSB7XG4gICAgLy8gV2hlbiB0aGUgdmVyc2lvbiBmb3IgdGhlIGVudHJ5IGlzIGEgbm9uLXByZWxlYXNlIChpLmUuIDEuMC4wIHJhdGhlciB0aGFuIDEuMC4wLW5leHQuMSksIHRoZVxuICAgIC8vIHByZS1yZWxlYXNlIGVudHJpZXMgZm9yIHRoZSB2ZXJzaW9uIHNob3VsZCBiZSByZW1vdmVkIGZyb20gdGhlIGNoYW5nZWxvZy5cbiAgICBpZiAoc2VtdmVyLnByZXJlbGVhc2UodGhpcy52ZXJzaW9uKSA9PT0gbnVsbCkge1xuICAgICAgQ2hhbmdlbG9nLnJlbW92ZVByZXJlbGVhc2VFbnRyaWVzRm9yVmVyc2lvbih0aGlzLmdpdCwgdGhpcy52ZXJzaW9uKTtcbiAgICB9XG4gICAgQ2hhbmdlbG9nLnByZXBlbmRFbnRyeVRvQ2hhbmdlbG9nRmlsZSh0aGlzLmdpdCwgYXdhaXQgdGhpcy5nZXRDaGFuZ2Vsb2dFbnRyeSgpKTtcblxuICAgIC8vIFRPRE8oam9zZXBocGVycm90dCk6IFJlbW92ZSBmaWxlIGZvcm1hdHRpbmcgY2FsbHMuXG4gICAgLy8gICBVcG9uIHJlYWNoaW5nIGEgc3RhbmRhcmRpemVkIGZvcm1hdHRpbmcgZm9yIG1hcmtkb3duIGZpbGVzLCByYXRoZXIgdGhhbiBjYWxsaW5nIGEgZm9ybWF0dGVyXG4gICAgLy8gICBmb3IgYWxsIGNyZWF0aW9uIG9mIGNoYW5nZWxvZ3MsIHdlIGluc3RlYWQgd2lsbCBjb25maXJtIGluIG91ciB0ZXN0aW5nIHRoYXQgdGhlIG5ldyBjaGFuZ2VzXG4gICAgLy8gICBjcmVhdGVkIGZvciBjaGFuZ2Vsb2dzIG1lZXQgb24gc3RhbmRhcmRpemVkIG1hcmtkb3duIGZvcm1hdHMgdmlhIHVuaXQgdGVzdGluZy5cbiAgICB0cnkge1xuICAgICAgYXNzZXJ0VmFsaWRGb3JtYXRDb25maWcoYXdhaXQgdGhpcy5jb25maWcpO1xuICAgICAgYXdhaXQgZm9ybWF0RmlsZXMoW0NoYW5nZWxvZy5nZXRDaGFuZ2Vsb2dGaWxlUGF0aHModGhpcy5naXQpLmZpbGVQYXRoXSk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBJZiB0aGUgZm9ybWF0dGluZyBpcyBlaXRoZXIgdW5hdmFpbGFibGUgb3IgZmFpbHMsIGNvbnRpbnVlIG9uIHdpdGggdGhlIHVuZm9ybWF0dGVkIHJlc3VsdC5cbiAgICB9XG4gIH1cblxuICAvKiogUmV0cmlldmUgdGhlIG51bWJlciBvZiBjb21taXRzIGluY2x1ZGVkIGluIHRoZSByZWxlYXNlIG5vdGVzIGFmdGVyIGZpbHRlcmluZyBhbmQgZGVkdXBpbmcuICovXG4gIGFzeW5jIGdldENvbW1pdENvdW50SW5SZWxlYXNlTm90ZXMoKSB7XG4gICAgY29uc3QgY29udGV4dCA9IGF3YWl0IHRoaXMuZ2VuZXJhdGVSZW5kZXJDb250ZXh0KCk7XG4gICAgcmV0dXJuIGNvbnRleHQuY29tbWl0cy5maWx0ZXIoY29udGV4dC5pbmNsdWRlSW5SZWxlYXNlTm90ZXMoKSkubGVuZ3RoO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIFVSTCBmcmFnbWVudCBmb3IgdGhlIHJlbGVhc2Ugbm90ZXMuIFRoZSBVUkwgZnJhZ21lbnQgaWRlbnRpZmllclxuICAgKiBjYW4gYmUgdXNlZCB0byBwb2ludCB0byBhIHNwZWNpZmljIGNoYW5nZWxvZyBlbnRyeSB0aHJvdWdoIGFuIFVSTC5cbiAgICovXG4gIGFzeW5jIGdldFVybEZyYWdtZW50Rm9yUmVsZWFzZSgpIHtcbiAgICByZXR1cm4gKGF3YWl0IHRoaXMuZ2VuZXJhdGVSZW5kZXJDb250ZXh0KCkpLnVybEZyYWdtZW50Rm9yUmVsZWFzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcm9tcHQgdGhlIHVzZXIgZm9yIGEgdGl0bGUgZm9yIHRoZSByZWxlYXNlLCBpZiB0aGUgcHJvamVjdCdzIGNvbmZpZ3VyYXRpb24gaXMgZGVmaW5lZCB0byB1c2UgYVxuICAgKiB0aXRsZS5cbiAgICovXG4gIGFzeW5jIHByb21wdEZvclJlbGVhc2VUaXRsZSgpIHtcbiAgICBjb25zdCBub3Rlc0NvbmZpZyA9IGF3YWl0IHRoaXMuX2dldE5vdGVzQ29uZmlnKCk7XG5cbiAgICBpZiAodGhpcy50aXRsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAobm90ZXNDb25maWcudXNlUmVsZWFzZVRpdGxlKSB7XG4gICAgICAgIHRoaXMudGl0bGUgPSBhd2FpdCBQcm9tcHQuaW5wdXQoe21lc3NhZ2U6ICdQbGVhc2UgcHJvdmlkZSBhIHRpdGxlIGZvciB0aGUgcmVsZWFzZTonfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnRpdGxlID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnRpdGxlO1xuICB9XG5cbiAgLyoqIEJ1aWxkIHRoZSByZW5kZXIgY29udGV4dCBkYXRhIG9iamVjdCBmb3IgY29uc3RydWN0aW5nIHRoZSBSZW5kZXJDb250ZXh0IGluc3RhbmNlLiAqL1xuICBwcml2YXRlIGFzeW5jIGdlbmVyYXRlUmVuZGVyQ29udGV4dCgpOiBQcm9taXNlPFJlbmRlckNvbnRleHQ+IHtcbiAgICBjb25zdCBub3Rlc0NvbmZpZyA9IGF3YWl0IHRoaXMuX2dldE5vdGVzQ29uZmlnKCk7XG5cbiAgICBpZiAoIXRoaXMucmVuZGVyQ29udGV4dCkge1xuICAgICAgdGhpcy5yZW5kZXJDb250ZXh0ID0gbmV3IFJlbmRlckNvbnRleHQoe1xuICAgICAgICBjb21taXRzOiB0aGlzLmNvbW1pdHMsXG4gICAgICAgIGdpdGh1YjogdGhpcy5naXQucmVtb3RlQ29uZmlnLFxuICAgICAgICB2ZXJzaW9uOiB0aGlzLnZlcnNpb24uZm9ybWF0KCksXG4gICAgICAgIGdyb3VwT3JkZXI6IG5vdGVzQ29uZmlnLmdyb3VwT3JkZXIsXG4gICAgICAgIGhpZGRlblNjb3Blczogbm90ZXNDb25maWcuaGlkZGVuU2NvcGVzLFxuICAgICAgICBjYXRlZ29yaXplQ29tbWl0OiBub3Rlc0NvbmZpZy5jYXRlZ29yaXplQ29tbWl0LFxuICAgICAgICB0aXRsZTogYXdhaXQgdGhpcy5wcm9tcHRGb3JSZWxlYXNlVGl0bGUoKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5yZW5kZXJDb250ZXh0O1xuICB9XG5cbiAgLyoqIEdldHMgdGhlIGNvbmZpZ3VyYXRpb24gZm9yIHRoZSByZWxlYXNlIG5vdGVzLiAqL1xuICBwcml2YXRlIGFzeW5jIF9nZXROb3Rlc0NvbmZpZygpIHtcbiAgICByZXR1cm4gKGF3YWl0IHRoaXMuY29uZmlnKS5yZWxlYXNlLnJlbGVhc2VOb3RlcyA/PyB7fTtcbiAgfVxufVxuIl19