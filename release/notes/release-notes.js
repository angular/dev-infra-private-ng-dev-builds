/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { render } from 'ejs';
import semver from 'semver';
import { Prompt } from '../../utils/prompt.js';
import { formatFiles } from '../../format/format.js';
import { assertValidReleaseConfig } from '../config/index.js';
import { RenderContext } from './context.js';
import changelogTemplate from './templates/changelog.js';
import githubReleaseTemplate from './templates/github-release.js';
import { getCommitsForRangeWithDeduping } from './commits/get-commits-in-range.js';
import { getConfig } from '../../utils/config.js';
import { assertValidFormatConfig } from '../../format/config.js';
import { Changelog } from './changelog.js';
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
                this.title = await Prompt.input('Please provide a title for the release:');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVsZWFzZS1ub3Rlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL25vdGVzL3JlbGVhc2Utbm90ZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLEtBQUssQ0FBQztBQUMzQixPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFHNUIsT0FBTyxFQUFDLE1BQU0sRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBQzdDLE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUVuRCxPQUFPLEVBQUMsd0JBQXdCLEVBQWdCLE1BQU0sb0JBQW9CLENBQUM7QUFDM0UsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGNBQWMsQ0FBQztBQUUzQyxPQUFPLGlCQUFpQixNQUFNLDBCQUEwQixDQUFDO0FBQ3pELE9BQU8scUJBQXFCLE1BQU0sK0JBQStCLENBQUM7QUFDbEUsT0FBTyxFQUFDLDhCQUE4QixFQUFDLE1BQU0sbUNBQW1DLENBQUM7QUFDakYsT0FBTyxFQUFDLFNBQVMsRUFBYyxNQUFNLHVCQUF1QixDQUFDO0FBQzdELE9BQU8sRUFBQyx1QkFBdUIsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQy9ELE9BQU8sRUFBQyxTQUFTLEVBQUMsTUFBTSxnQkFBZ0IsQ0FBQztBQUV6QyxzREFBc0Q7QUFDdEQsTUFBTSxDQUFDLE1BQU0sOEJBQThCLEdBQUcsY0FBYyxDQUFDO0FBRTdELCtCQUErQjtBQUMvQixNQUFNLE9BQU8sWUFBWTtJQUN2QixNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFjLEVBQUUsT0FBc0IsRUFBRSxPQUFlLEVBQUUsT0FBZTtRQUM1RixNQUFNLE1BQU0sR0FBRyxNQUFNLFNBQVMsQ0FBQyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQztRQUMzRCxNQUFNLE9BQU8sR0FBRyw4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QztJQUVELHdGQUF3RjtJQUNoRixLQUFLLENBQUMscUJBQXFCO1FBQ2pDLE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBRWpELElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDeEIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLGFBQWEsQ0FBQztnQkFDckMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPO2dCQUNyQixNQUFNLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZO2dCQUM3QixPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUU7Z0JBQzlCLFVBQVUsRUFBRSxXQUFXLENBQUMsVUFBVTtnQkFDbEMsWUFBWSxFQUFFLFdBQVcsQ0FBQyxZQUFZO2dCQUN0QyxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsZ0JBQWdCO2dCQUM5QyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUMscUJBQXFCLEVBQUU7YUFDMUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQztJQUM1QixDQUFDO0lBRUQsb0RBQW9EO0lBQzVDLEtBQUssQ0FBQyxlQUFlO1FBQzNCLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxJQUFJLEVBQUUsQ0FBQztJQUN4RCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7cmVuZGVyfSBmcm9tICdlanMnO1xuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xuaW1wb3J0IHtDb21taXRGcm9tR2l0TG9nfSBmcm9tICcuLi8uLi9jb21taXQtbWVzc2FnZS9wYXJzZS5qcyc7XG5cbmltcG9ydCB7UHJvbXB0fSBmcm9tICcuLi8uLi91dGlscy9wcm9tcHQuanMnO1xuaW1wb3J0IHtmb3JtYXRGaWxlc30gZnJvbSAnLi4vLi4vZm9ybWF0L2Zvcm1hdC5qcyc7XG5pbXBvcnQge0dpdENsaWVudH0gZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdC1jbGllbnQuanMnO1xuaW1wb3J0IHthc3NlcnRWYWxpZFJlbGVhc2VDb25maWcsIFJlbGVhc2VDb25maWd9IGZyb20gJy4uL2NvbmZpZy9pbmRleC5qcyc7XG5pbXBvcnQge1JlbmRlckNvbnRleHR9IGZyb20gJy4vY29udGV4dC5qcyc7XG5cbmltcG9ydCBjaGFuZ2Vsb2dUZW1wbGF0ZSBmcm9tICcuL3RlbXBsYXRlcy9jaGFuZ2Vsb2cuanMnO1xuaW1wb3J0IGdpdGh1YlJlbGVhc2VUZW1wbGF0ZSBmcm9tICcuL3RlbXBsYXRlcy9naXRodWItcmVsZWFzZS5qcyc7XG5pbXBvcnQge2dldENvbW1pdHNGb3JSYW5nZVdpdGhEZWR1cGluZ30gZnJvbSAnLi9jb21taXRzL2dldC1jb21taXRzLWluLXJhbmdlLmpzJztcbmltcG9ydCB7Z2V0Q29uZmlnLCBOZ0RldkNvbmZpZ30gZnJvbSAnLi4vLi4vdXRpbHMvY29uZmlnLmpzJztcbmltcG9ydCB7YXNzZXJ0VmFsaWRGb3JtYXRDb25maWd9IGZyb20gJy4uLy4uL2Zvcm1hdC9jb25maWcuanMnO1xuaW1wb3J0IHtDaGFuZ2Vsb2d9IGZyb20gJy4vY2hhbmdlbG9nLmpzJztcblxuLyoqIFdvcmtzcGFjZS1yZWxhdGl2ZSBwYXRoIGZvciB0aGUgY2hhbmdlbG9nIGZpbGUuICovXG5leHBvcnQgY29uc3Qgd29ya3NwYWNlUmVsYXRpdmVDaGFuZ2Vsb2dQYXRoID0gJ0NIQU5HRUxPRy5tZCc7XG5cbi8qKiBSZWxlYXNlIG5vdGUgZ2VuZXJhdGlvbi4gKi9cbmV4cG9ydCBjbGFzcyBSZWxlYXNlTm90ZXMge1xuICBzdGF0aWMgYXN5bmMgZm9yUmFuZ2UoZ2l0OiBHaXRDbGllbnQsIHZlcnNpb246IHNlbXZlci5TZW1WZXIsIGJhc2VSZWY6IHN0cmluZywgaGVhZFJlZjogc3RyaW5nKSB7XG4gICAgY29uc3QgY29uZmlnID0gYXdhaXQgZ2V0Q29uZmlnKFthc3NlcnRWYWxpZFJlbGVhc2VDb25maWddKTtcbiAgICBjb25zdCBjb21taXRzID0gZ2V0Q29tbWl0c0ZvclJhbmdlV2l0aERlZHVwaW5nKGdpdCwgYmFzZVJlZiwgaGVhZFJlZik7XG4gICAgcmV0dXJuIG5ldyBSZWxlYXNlTm90ZXMoY29uZmlnLCB2ZXJzaW9uLCBjb21taXRzLCBnaXQpO1xuICB9XG5cbiAgLyoqIFRoZSBSZW5kZXJDb250ZXh0IHRvIGJlIHVzZWQgZHVyaW5nIHJlbmRlcmluZy4gKi9cbiAgcHJpdmF0ZSByZW5kZXJDb250ZXh0OiBSZW5kZXJDb250ZXh0IHwgdW5kZWZpbmVkO1xuXG4gIC8qKiBUaGUgdGl0bGUgdG8gdXNlIGZvciB0aGUgcmVsZWFzZS4gKi9cbiAgcHJpdmF0ZSB0aXRsZTogc3RyaW5nIHwgZmFsc2UgfCB1bmRlZmluZWQ7XG5cbiAgcHJvdGVjdGVkIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyBjb25maWc6IE5nRGV2Q29uZmlnPHtyZWxlYXNlOiBSZWxlYXNlQ29uZmlnfT4sXG4gICAgcHVibGljIHZlcnNpb246IHNlbXZlci5TZW1WZXIsXG4gICAgcHJpdmF0ZSBjb21taXRzOiBDb21taXRGcm9tR2l0TG9nW10sXG4gICAgcHJpdmF0ZSBnaXQ6IEdpdENsaWVudCxcbiAgKSB7fVxuXG4gIC8qKiBSZXRyaWV2ZSB0aGUgcmVsZWFzZSBub3RlIGdlbmVyYXRlZCBmb3IgYSBHaXRodWIgUmVsZWFzZS4gKi9cbiAgYXN5bmMgZ2V0R2l0aHViUmVsZWFzZUVudHJ5KCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIHJlbmRlcihnaXRodWJSZWxlYXNlVGVtcGxhdGUsIGF3YWl0IHRoaXMuZ2VuZXJhdGVSZW5kZXJDb250ZXh0KCksIHtcbiAgICAgIHJtV2hpdGVzcGFjZTogdHJ1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKiBSZXRyaWV2ZSB0aGUgcmVsZWFzZSBub3RlIGdlbmVyYXRlZCBmb3IgYSBDSEFOR0VMT0cgZW50cnkuICovXG4gIGFzeW5jIGdldENoYW5nZWxvZ0VudHJ5KCkge1xuICAgIHJldHVybiByZW5kZXIoY2hhbmdlbG9nVGVtcGxhdGUsIGF3YWl0IHRoaXMuZ2VuZXJhdGVSZW5kZXJDb250ZXh0KCksIHtybVdoaXRlc3BhY2U6IHRydWV9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwZW5kIGdlbmVyYXRlZCByZWxlYXNlIG5vdGUgdG8gdGhlIENIQU5HRUxPRy5tZCBmaWxlIGluIHRoZSBiYXNlIGRpcmVjdG9yeSBvZiB0aGUgcmVwb3NpdG9yeVxuICAgKiBwcm92aWRlZCBieSB0aGUgR2l0Q2xpZW50LiBSZW1vdmVzIGVudHJpZXMgZm9yIHJlbGF0ZWQgcHJlcmVsZWFzZSBlbnRyaWVzIGFzIGFwcHJvcHJpYXRlLlxuICAgKi9cbiAgYXN5bmMgcHJlcGVuZEVudHJ5VG9DaGFuZ2Vsb2dGaWxlKCkge1xuICAgIC8vIFdoZW4gdGhlIHZlcnNpb24gZm9yIHRoZSBlbnRyeSBpcyBhIG5vbi1wcmVsZWFzZSAoaS5lLiAxLjAuMCByYXRoZXIgdGhhbiAxLjAuMC1uZXh0LjEpLCB0aGVcbiAgICAvLyBwcmUtcmVsZWFzZSBlbnRyaWVzIGZvciB0aGUgdmVyc2lvbiBzaG91bGQgYmUgcmVtb3ZlZCBmcm9tIHRoZSBjaGFuZ2Vsb2cuXG4gICAgaWYgKHNlbXZlci5wcmVyZWxlYXNlKHRoaXMudmVyc2lvbikgPT09IG51bGwpIHtcbiAgICAgIENoYW5nZWxvZy5yZW1vdmVQcmVyZWxlYXNlRW50cmllc0ZvclZlcnNpb24odGhpcy5naXQsIHRoaXMudmVyc2lvbik7XG4gICAgfVxuICAgIENoYW5nZWxvZy5wcmVwZW5kRW50cnlUb0NoYW5nZWxvZ0ZpbGUodGhpcy5naXQsIGF3YWl0IHRoaXMuZ2V0Q2hhbmdlbG9nRW50cnkoKSk7XG5cbiAgICAvLyBUT0RPKGpvc2VwaHBlcnJvdHQpOiBSZW1vdmUgZmlsZSBmb3JtYXR0aW5nIGNhbGxzLlxuICAgIC8vICAgVXBvbiByZWFjaGluZyBhIHN0YW5kYXJkaXplZCBmb3JtYXR0aW5nIGZvciBtYXJrZG93biBmaWxlcywgcmF0aGVyIHRoYW4gY2FsbGluZyBhIGZvcm1hdHRlclxuICAgIC8vICAgZm9yIGFsbCBjcmVhdGlvbiBvZiBjaGFuZ2Vsb2dzLCB3ZSBpbnN0ZWFkIHdpbGwgY29uZmlybSBpbiBvdXIgdGVzdGluZyB0aGF0IHRoZSBuZXcgY2hhbmdlc1xuICAgIC8vICAgY3JlYXRlZCBmb3IgY2hhbmdlbG9ncyBtZWV0IG9uIHN0YW5kYXJkaXplZCBtYXJrZG93biBmb3JtYXRzIHZpYSB1bml0IHRlc3RpbmcuXG4gICAgdHJ5IHtcbiAgICAgIGFzc2VydFZhbGlkRm9ybWF0Q29uZmlnKGF3YWl0IHRoaXMuY29uZmlnKTtcbiAgICAgIGF3YWl0IGZvcm1hdEZpbGVzKFtDaGFuZ2Vsb2cuZ2V0Q2hhbmdlbG9nRmlsZVBhdGhzKHRoaXMuZ2l0KS5maWxlUGF0aF0pO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gSWYgdGhlIGZvcm1hdHRpbmcgaXMgZWl0aGVyIHVuYXZhaWxhYmxlIG9yIGZhaWxzLCBjb250aW51ZSBvbiB3aXRoIHRoZSB1bmZvcm1hdHRlZCByZXN1bHQuXG4gICAgfVxuICB9XG5cbiAgLyoqIFJldHJpZXZlIHRoZSBudW1iZXIgb2YgY29tbWl0cyBpbmNsdWRlZCBpbiB0aGUgcmVsZWFzZSBub3RlcyBhZnRlciBmaWx0ZXJpbmcgYW5kIGRlZHVwaW5nLiAqL1xuICBhc3luYyBnZXRDb21taXRDb3VudEluUmVsZWFzZU5vdGVzKCkge1xuICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLmdlbmVyYXRlUmVuZGVyQ29udGV4dCgpO1xuICAgIHJldHVybiBjb250ZXh0LmNvbW1pdHMuZmlsdGVyKGNvbnRleHQuaW5jbHVkZUluUmVsZWFzZU5vdGVzKCkpLmxlbmd0aDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBVUkwgZnJhZ21lbnQgZm9yIHRoZSByZWxlYXNlIG5vdGVzLiBUaGUgVVJMIGZyYWdtZW50IGlkZW50aWZpZXJcbiAgICogY2FuIGJlIHVzZWQgdG8gcG9pbnQgdG8gYSBzcGVjaWZpYyBjaGFuZ2Vsb2cgZW50cnkgdGhyb3VnaCBhbiBVUkwuXG4gICAqL1xuICBhc3luYyBnZXRVcmxGcmFnbWVudEZvclJlbGVhc2UoKSB7XG4gICAgcmV0dXJuIChhd2FpdCB0aGlzLmdlbmVyYXRlUmVuZGVyQ29udGV4dCgpKS51cmxGcmFnbWVudEZvclJlbGVhc2U7XG4gIH1cblxuICAvKipcbiAgICogUHJvbXB0IHRoZSB1c2VyIGZvciBhIHRpdGxlIGZvciB0aGUgcmVsZWFzZSwgaWYgdGhlIHByb2plY3QncyBjb25maWd1cmF0aW9uIGlzIGRlZmluZWQgdG8gdXNlIGFcbiAgICogdGl0bGUuXG4gICAqL1xuICBhc3luYyBwcm9tcHRGb3JSZWxlYXNlVGl0bGUoKSB7XG4gICAgY29uc3Qgbm90ZXNDb25maWcgPSBhd2FpdCB0aGlzLl9nZXROb3Rlc0NvbmZpZygpO1xuXG4gICAgaWYgKHRoaXMudGl0bGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKG5vdGVzQ29uZmlnLnVzZVJlbGVhc2VUaXRsZSkge1xuICAgICAgICB0aGlzLnRpdGxlID0gYXdhaXQgUHJvbXB0LmlucHV0KCdQbGVhc2UgcHJvdmlkZSBhIHRpdGxlIGZvciB0aGUgcmVsZWFzZTonKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudGl0bGUgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudGl0bGU7XG4gIH1cblxuICAvKiogQnVpbGQgdGhlIHJlbmRlciBjb250ZXh0IGRhdGEgb2JqZWN0IGZvciBjb25zdHJ1Y3RpbmcgdGhlIFJlbmRlckNvbnRleHQgaW5zdGFuY2UuICovXG4gIHByaXZhdGUgYXN5bmMgZ2VuZXJhdGVSZW5kZXJDb250ZXh0KCk6IFByb21pc2U8UmVuZGVyQ29udGV4dD4ge1xuICAgIGNvbnN0IG5vdGVzQ29uZmlnID0gYXdhaXQgdGhpcy5fZ2V0Tm90ZXNDb25maWcoKTtcblxuICAgIGlmICghdGhpcy5yZW5kZXJDb250ZXh0KSB7XG4gICAgICB0aGlzLnJlbmRlckNvbnRleHQgPSBuZXcgUmVuZGVyQ29udGV4dCh7XG4gICAgICAgIGNvbW1pdHM6IHRoaXMuY29tbWl0cyxcbiAgICAgICAgZ2l0aHViOiB0aGlzLmdpdC5yZW1vdGVDb25maWcsXG4gICAgICAgIHZlcnNpb246IHRoaXMudmVyc2lvbi5mb3JtYXQoKSxcbiAgICAgICAgZ3JvdXBPcmRlcjogbm90ZXNDb25maWcuZ3JvdXBPcmRlcixcbiAgICAgICAgaGlkZGVuU2NvcGVzOiBub3Rlc0NvbmZpZy5oaWRkZW5TY29wZXMsXG4gICAgICAgIGNhdGVnb3JpemVDb21taXQ6IG5vdGVzQ29uZmlnLmNhdGVnb3JpemVDb21taXQsXG4gICAgICAgIHRpdGxlOiBhd2FpdCB0aGlzLnByb21wdEZvclJlbGVhc2VUaXRsZSgpLFxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnJlbmRlckNvbnRleHQ7XG4gIH1cblxuICAvKiogR2V0cyB0aGUgY29uZmlndXJhdGlvbiBmb3IgdGhlIHJlbGVhc2Ugbm90ZXMuICovXG4gIHByaXZhdGUgYXN5bmMgX2dldE5vdGVzQ29uZmlnKCkge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5jb25maWcpLnJlbGVhc2UucmVsZWFzZU5vdGVzID8/IHt9O1xuICB9XG59XG4iXX0=