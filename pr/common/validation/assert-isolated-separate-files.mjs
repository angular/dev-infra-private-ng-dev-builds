/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Minimatch } from 'minimatch';
import path from 'path';
import { assertValidCaretakerConfig, } from '../../../utils/config.js';
import { getGoogleSyncConfig } from '../../../utils/g3-sync-config.js';
import { G3Stats } from '../../../utils/g3.js';
import { createPullRequestValidation, PullRequestValidation } from './validation-config.js';
import { fetchPullRequestFilesFromGithub } from '../fetch-pull-request.js';
/** Assert the pull request has passing enforced statuses. */
// TODO: update typings to make sure portability is properly handled for windows build.
export const isolatedSeparateFilesValidation = createPullRequestValidation({ name: 'assertIsolatedSeparateFiles', canBeForceIgnored: true }, () => Validation);
class Validation extends PullRequestValidation {
    async assert(config, prNumber, gitClient) {
        try {
            assertValidCaretakerConfig(config);
        }
        catch {
            throw this._createError('No Caretaker Config was found.');
        }
        const g3SyncConfigWithMatchers = await getGsyncConfig(config.caretaker, gitClient);
        if (g3SyncConfigWithMatchers === null) {
            return;
        }
        // diffStats tells you what's already been merged in github, but hasn't yet been synced to G3
        const diffStats = await getDiffStats(config, g3SyncConfigWithMatchers.config, gitClient);
        if (diffStats === undefined) {
            return;
        }
        const hasSeparateSyncFiles = await PullRequestFiles.create(gitClient, prNumber, g3SyncConfigWithMatchers.config).pullRequestHasSeparateFiles();
        // This validation applies to PRs that get merged when changes have not yet been synced into G3.
        // The rules are as follows:
        //   1. if pure framework changes have been merged, separate file changes should not be merged.
        //   2. if separate file changes have been merged, pure framework changes should not be merged.
        //   3. if separate file changes have been merged, any change merged MUST have separate file changes in it.
        //   4. framework changes can be merged with separate file changes as long as that change ALSO
        //       has separate file changes also.
        // covers 2 & 3
        if (diffStats.separateFiles > 0 && !hasSeparateSyncFiles) {
            throw this._createError(`This PR cannot be merged as Shared Primitives code has already been merged. ` +
                `Primitives and Framework code must be merged and synced separately. Try again after a g3sync has finished.`);
        }
        // covers 1 & 4
        if (diffStats.files > 0 && diffStats.separateFiles === 0 && hasSeparateSyncFiles) {
            throw this._createError(`This PR cannot be merged as Angular framework code has already been merged. ` +
                `Primitives and Framework code must be merged and synced separately. Try again after a g3sync has finished.`);
        }
    }
}
async function getGsyncConfig(config, git) {
    let googleSyncConfig = null;
    if (config.g3SyncConfigPath) {
        try {
            const configPath = path.join(git.baseDir, config.g3SyncConfigPath);
            googleSyncConfig = await getGoogleSyncConfig(configPath);
        }
        catch { }
    }
    return googleSyncConfig;
}
export class PullRequestFiles {
    constructor(git, prNumber, config) {
        this.git = git;
        this.prNumber = prNumber;
        this.config = config;
    }
    /**
     * Loads the files from a given pull request.
     */
    async loadPullRequestFiles() {
        const files = await fetchPullRequestFilesFromGithub(this.git, this.prNumber);
        return files?.map((x) => x.path) ?? [];
    }
    /**
     * checks for separate files against the pull request files
     */
    async pullRequestHasSeparateFiles() {
        const pullRequestFiles = await this.loadPullRequestFiles();
        const separateFilePatterns = this.config.separateFilePatterns.map((p) => new Minimatch(p));
        for (let path of pullRequestFiles) {
            if (separateFilePatterns.some((p) => p.match(path))) {
                return true;
            }
        }
        return false;
    }
    static create(git, prNumber, config) {
        return new PullRequestFiles(git, prNumber, config);
    }
}
async function getDiffStats(ngDevConfig, googleSyncConfig, git) {
    if (googleSyncConfig && googleSyncConfig.separateFilePatterns.length > 0) {
        return G3Stats.retrieveDiffStats(git, {
            caretaker: ngDevConfig.caretaker,
            github: ngDevConfig.github,
        });
    }
    return;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXJ0LWlzb2xhdGVkLXNlcGFyYXRlLWZpbGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL2NvbW1vbi92YWxpZGF0aW9uL2Fzc2VydC1pc29sYXRlZC1zZXBhcmF0ZS1maWxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBQ3BDLE9BQU8sSUFBSSxNQUFNLE1BQU0sQ0FBQztBQUN4QixPQUFPLEVBS0wsMEJBQTBCLEdBQzNCLE1BQU0sMEJBQTBCLENBQUM7QUFDbEMsT0FBTyxFQUFrQixtQkFBbUIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBQ3RGLE9BQU8sRUFBYyxPQUFPLEVBQUMsTUFBTSxzQkFBc0IsQ0FBQztBQUMxRCxPQUFPLEVBQUMsMkJBQTJCLEVBQUUscUJBQXFCLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUUxRixPQUFPLEVBQUMsK0JBQStCLEVBQUMsTUFBTSwwQkFBMEIsQ0FBQztBQUV6RSw2REFBNkQ7QUFDN0QsdUZBQXVGO0FBQ3ZGLE1BQU0sQ0FBQyxNQUFNLCtCQUErQixHQUFHLDJCQUEyQixDQUN4RSxFQUFDLElBQUksRUFBRSw2QkFBNkIsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUMsRUFDOUQsR0FBRyxFQUFFLENBQUMsVUFBVSxDQUNqQixDQUFDO0FBRUYsTUFBTSxVQUFXLFNBQVEscUJBQXFCO0lBQzVDLEtBQUssQ0FBQyxNQUFNLENBQ1YsTUFFRSxFQUNGLFFBQWdCLEVBQ2hCLFNBQWlDO1FBRWpDLElBQUksQ0FBQztZQUNILDBCQUEwQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JDLENBQUM7UUFBQyxNQUFNLENBQUM7WUFDUCxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztRQUM1RCxDQUFDO1FBRUQsTUFBTSx3QkFB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LENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDcEQsT0FBTyxJQUFJLENBQUM7WUFDZCxDQUFDO1FBQ0gsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVELE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBMkIsRUFBRSxRQUFnQixFQUFFLE1BQXdCO1FBQ25GLE9BQU8sSUFBSSxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ3JELENBQUM7Q0FDRjtBQUVELEtBQUssVUFBVSxZQUFZLENBQ3pCLFdBR0UsRUFDRixnQkFBa0MsRUFDbEMsR0FBMkI7SUFFM0IsSUFBSSxnQkFBZ0IsSUFBSSxnQkFBZ0IsQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDekUsT0FBTyxPQUFPLENBQUMsaUJBQWlCLENBQUMsR0FBRyxFQUFFO1lBQ3BDLFNBQVMsRUFBRSxXQUFXLENBQUMsU0FBUztZQUNoQyxNQUFNLEVBQUUsV0FBVyxDQUFDLE1BQU07U0FDM0IsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUNELE9BQU87QUFDVCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7TWluaW1hdGNofSBmcm9tICdtaW5pbWF0Y2gnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQge1xuICBDYXJldGFrZXJDb25maWcsXG4gIEdpdGh1YkNvbmZpZyxcbiAgR29vZ2xlU3luY0NvbmZpZyxcbiAgTmdEZXZDb25maWcsXG4gIGFzc2VydFZhbGlkQ2FyZXRha2VyQ29uZmlnLFxufSBmcm9tICcuLi8uLi8uLi91dGlscy9jb25maWcuanMnO1xuaW1wb3J0IHtTeW5jRmlsZU1hdGNoRm4sIGdldEdvb2dsZVN5bmNDb25maWd9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2czLXN5bmMtY29uZmlnLmpzJztcbmltcG9ydCB7RzNTdGF0c0RhdGEsIEczU3RhdHN9IGZyb20gJy4uLy4uLy4uL3V0aWxzL2czLmpzJztcbmltcG9ydCB7Y3JlYXRlUHVsbFJlcXVlc3RWYWxpZGF0aW9uLCBQdWxsUmVxdWVzdFZhbGlkYXRpb259IGZyb20gJy4vdmFsaWRhdGlvbi1jb25maWcuanMnO1xuaW1wb3J0IHtBdXRoZW50aWNhdGVkR2l0Q2xpZW50fSBmcm9tICcuLi8uLi8uLi91dGlscy9naXQvYXV0aGVudGljYXRlZC1naXQtY2xpZW50LmpzJztcbmltcG9ydCB7ZmV0Y2hQdWxsUmVxdWVzdEZpbGVzRnJvbUdpdGh1Yn0gZnJvbSAnLi4vZmV0Y2gtcHVsbC1yZXF1ZXN0LmpzJztcblxuLyoqIEFzc2VydCB0aGUgcHVsbCByZXF1ZXN0IGhhcyBwYXNzaW5nIGVuZm9yY2VkIHN0YXR1c2VzLiAqL1xuLy8gVE9ETzogdXBkYXRlIHR5cGluZ3MgdG8gbWFrZSBzdXJlIHBvcnRhYmlsaXR5IGlzIHByb3Blcmx5IGhhbmRsZWQgZm9yIHdpbmRvd3MgYnVpbGQuXG5leHBvcnQgY29uc3QgaXNvbGF0ZWRTZXBhcmF0ZUZpbGVzVmFsaWRhdGlvbiA9IGNyZWF0ZVB1bGxSZXF1ZXN0VmFsaWRhdGlvbihcbiAge25hbWU6ICdhc3NlcnRJc29sYXRlZFNlcGFyYXRlRmlsZXMnLCBjYW5CZUZvcmNlSWdub3JlZDogdHJ1ZX0sXG4gICgpID0+IFZhbGlkYXRpb24sXG4pO1xuXG5jbGFzcyBWYWxpZGF0aW9uIGV4dGVuZHMgUHVsbFJlcXVlc3RWYWxpZGF0aW9uIHtcbiAgYXN5bmMgYXNzZXJ0KFxuICAgIGNvbmZpZzogTmdEZXZDb25maWc8e1xuICAgICAgZ2l0aHViOiBHaXRodWJDb25maWc7XG4gICAgfT4sXG4gICAgcHJOdW1iZXI6IG51bWJlcixcbiAgICBnaXRDbGllbnQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4gICkge1xuICAgIHRyeSB7XG4gICAgICBhc3NlcnRWYWxpZENhcmV0YWtlckNvbmZpZyhjb25maWcpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoJ05vIENhcmV0YWtlciBDb25maWcgd2FzIGZvdW5kLicpO1xuICAgIH1cblxuICAgIGNvbnN0IGczU3luY0NvbmZpZ1dpdGhNYXRjaGVycyA9IGF3YWl0IGdldEdzeW5jQ29uZmlnKGNvbmZpZy5jYXJldGFrZXIsIGdpdENsaWVudCk7XG4gICAgaWYgKGczU3luY0NvbmZpZ1dpdGhNYXRjaGVycyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIGRpZmZTdGF0cyB0ZWxscyB5b3Ugd2hhdCdzIGFscmVhZHkgYmVlbiBtZXJnZWQgaW4gZ2l0aHViLCBidXQgaGFzbid0IHlldCBiZWVuIHN5bmNlZCB0byBHM1xuICAgIGNvbnN0IGRpZmZTdGF0cyA9IGF3YWl0IGdldERpZmZTdGF0cyhjb25maWcsIGczU3luY0NvbmZpZ1dpdGhNYXRjaGVycy5jb25maWcsIGdpdENsaWVudCk7XG4gICAgaWYgKGRpZmZTdGF0cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgaGFzU2VwYXJhdGVTeW5jRmlsZXMgPSBhd2FpdCBQdWxsUmVxdWVzdEZpbGVzLmNyZWF0ZShcbiAgICAgIGdpdENsaWVudCxcbiAgICAgIHByTnVtYmVyLFxuICAgICAgZzNTeW5jQ29uZmlnV2l0aE1hdGNoZXJzLmNvbmZpZyxcbiAgICApLnB1bGxSZXF1ZXN0SGFzU2VwYXJhdGVGaWxlcygpO1xuXG4gICAgLy8gVGhpcyB2YWxpZGF0aW9uIGFwcGxpZXMgdG8gUFJzIHRoYXQgZ2V0IG1lcmdlZCB3aGVuIGNoYW5nZXMgaGF2ZSBub3QgeWV0IGJlZW4gc3luY2VkIGludG8gRzMuXG4gICAgLy8gVGhlIHJ1bGVzIGFyZSBhcyBmb2xsb3dzOlxuICAgIC8vICAgMS4gaWYgcHVyZSBmcmFtZXdvcmsgY2hhbmdlcyBoYXZlIGJlZW4gbWVyZ2VkLCBzZXBhcmF0ZSBmaWxlIGNoYW5nZXMgc2hvdWxkIG5vdCBiZSBtZXJnZWQuXG4gICAgLy8gICAyLiBpZiBzZXBhcmF0ZSBmaWxlIGNoYW5nZXMgaGF2ZSBiZWVuIG1lcmdlZCwgcHVyZSBmcmFtZXdvcmsgY2hhbmdlcyBzaG91bGQgbm90IGJlIG1lcmdlZC5cbiAgICAvLyAgIDMuIGlmIHNlcGFyYXRlIGZpbGUgY2hhbmdlcyBoYXZlIGJlZW4gbWVyZ2VkLCBhbnkgY2hhbmdlIG1lcmdlZCBNVVNUIGhhdmUgc2VwYXJhdGUgZmlsZSBjaGFuZ2VzIGluIGl0LlxuICAgIC8vICAgNC4gZnJhbWV3b3JrIGNoYW5nZXMgY2FuIGJlIG1lcmdlZCB3aXRoIHNlcGFyYXRlIGZpbGUgY2hhbmdlcyBhcyBsb25nIGFzIHRoYXQgY2hhbmdlIEFMU09cbiAgICAvLyAgICAgICBoYXMgc2VwYXJhdGUgZmlsZSBjaGFuZ2VzIGFsc28uXG5cbiAgICAvLyBjb3ZlcnMgMiAmIDNcbiAgICBpZiAoZGlmZlN0YXRzLnNlcGFyYXRlRmlsZXMgPiAwICYmICFoYXNTZXBhcmF0ZVN5bmNGaWxlcykge1xuICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoXG4gICAgICAgIGBUaGlzIFBSIGNhbm5vdCBiZSBtZXJnZWQgYXMgU2hhcmVkIFByaW1pdGl2ZXMgY29kZSBoYXMgYWxyZWFkeSBiZWVuIG1lcmdlZC4gYCArXG4gICAgICAgICAgYFByaW1pdGl2ZXMgYW5kIEZyYW1ld29yayBjb2RlIG11c3QgYmUgbWVyZ2VkIGFuZCBzeW5jZWQgc2VwYXJhdGVseS4gVHJ5IGFnYWluIGFmdGVyIGEgZzNzeW5jIGhhcyBmaW5pc2hlZC5gLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBjb3ZlcnMgMSAmIDRcbiAgICBpZiAoZGlmZlN0YXRzLmZpbGVzID4gMCAmJiBkaWZmU3RhdHMuc2VwYXJhdGVGaWxlcyA9PT0gMCAmJiBoYXNTZXBhcmF0ZVN5bmNGaWxlcykge1xuICAgICAgdGhyb3cgdGhpcy5fY3JlYXRlRXJyb3IoXG4gICAgICAgIGBUaGlzIFBSIGNhbm5vdCBiZSBtZXJnZWQgYXMgQW5ndWxhciBmcmFtZXdvcmsgY29kZSBoYXMgYWxyZWFkeSBiZWVuIG1lcmdlZC4gYCArXG4gICAgICAgICAgYFByaW1pdGl2ZXMgYW5kIEZyYW1ld29yayBjb2RlIG11c3QgYmUgbWVyZ2VkIGFuZCBzeW5jZWQgc2VwYXJhdGVseS4gVHJ5IGFnYWluIGFmdGVyIGEgZzNzeW5jIGhhcyBmaW5pc2hlZC5gLFxuICAgICAgKTtcbiAgICB9XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0R3N5bmNDb25maWcoXG4gIGNvbmZpZzogQ2FyZXRha2VyQ29uZmlnLFxuICBnaXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4pOiBQcm9taXNlPHtcbiAgbmdNYXRjaEZuOiBTeW5jRmlsZU1hdGNoRm47XG4gIHNlcGFyYXRlTWF0Y2hGbjogU3luY0ZpbGVNYXRjaEZuO1xuICBjb25maWc6IEdvb2dsZVN5bmNDb25maWc7XG59IHwgbnVsbD4ge1xuICBsZXQgZ29vZ2xlU3luY0NvbmZpZyA9IG51bGw7XG4gIGlmIChjb25maWcuZzNTeW5jQ29uZmlnUGF0aCkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb25maWdQYXRoID0gcGF0aC5qb2luKGdpdC5iYXNlRGlyLCBjb25maWcuZzNTeW5jQ29uZmlnUGF0aCk7XG4gICAgICBnb29nbGVTeW5jQ29uZmlnID0gYXdhaXQgZ2V0R29vZ2xlU3luY0NvbmZpZyhjb25maWdQYXRoKTtcbiAgICB9IGNhdGNoIHt9XG4gIH1cbiAgcmV0dXJuIGdvb2dsZVN5bmNDb25maWc7XG59XG5cbmV4cG9ydCBjbGFzcyBQdWxsUmVxdWVzdEZpbGVzIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBnaXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4gICAgcHJpdmF0ZSBwck51bWJlcjogbnVtYmVyLFxuICAgIHByaXZhdGUgY29uZmlnOiBHb29nbGVTeW5jQ29uZmlnLFxuICApIHt9XG4gIC8qKlxuICAgKiBMb2FkcyB0aGUgZmlsZXMgZnJvbSBhIGdpdmVuIHB1bGwgcmVxdWVzdC5cbiAgICovXG4gIGFzeW5jIGxvYWRQdWxsUmVxdWVzdEZpbGVzKCk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBjb25zdCBmaWxlcyA9IGF3YWl0IGZldGNoUHVsbFJlcXVlc3RGaWxlc0Zyb21HaXRodWIodGhpcy5naXQsIHRoaXMucHJOdW1iZXIpO1xuICAgIHJldHVybiBmaWxlcz8ubWFwKCh4KSA9PiB4LnBhdGgpID8/IFtdO1xuICB9XG5cbiAgLyoqXG4gICAqIGNoZWNrcyBmb3Igc2VwYXJhdGUgZmlsZXMgYWdhaW5zdCB0aGUgcHVsbCByZXF1ZXN0IGZpbGVzXG4gICAqL1xuICBhc3luYyBwdWxsUmVxdWVzdEhhc1NlcGFyYXRlRmlsZXMoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgcHVsbFJlcXVlc3RGaWxlcyA9IGF3YWl0IHRoaXMubG9hZFB1bGxSZXF1ZXN0RmlsZXMoKTtcbiAgICBjb25zdCBzZXBhcmF0ZUZpbGVQYXR0ZXJucyA9IHRoaXMuY29uZmlnLnNlcGFyYXRlRmlsZVBhdHRlcm5zLm1hcCgocCkgPT4gbmV3IE1pbmltYXRjaChwKSk7XG4gICAgZm9yIChsZXQgcGF0aCBvZiBwdWxsUmVxdWVzdEZpbGVzKSB7XG4gICAgICBpZiAoc2VwYXJhdGVGaWxlUGF0dGVybnMuc29tZSgocCkgPT4gcC5tYXRjaChwYXRoKSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHN0YXRpYyBjcmVhdGUoZ2l0OiBBdXRoZW50aWNhdGVkR2l0Q2xpZW50LCBwck51bWJlcjogbnVtYmVyLCBjb25maWc6IEdvb2dsZVN5bmNDb25maWcpIHtcbiAgICByZXR1cm4gbmV3IFB1bGxSZXF1ZXN0RmlsZXMoZ2l0LCBwck51bWJlciwgY29uZmlnKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXREaWZmU3RhdHMoXG4gIG5nRGV2Q29uZmlnOiBOZ0RldkNvbmZpZzx7XG4gICAgZ2l0aHViOiBHaXRodWJDb25maWc7XG4gICAgY2FyZXRha2VyOiBDYXJldGFrZXJDb25maWc7XG4gIH0+LFxuICBnb29nbGVTeW5jQ29uZmlnOiBHb29nbGVTeW5jQ29uZmlnLFxuICBnaXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4pOiBQcm9taXNlPEczU3RhdHNEYXRhIHwgdW5kZWZpbmVkPiB7XG4gIGlmIChnb29nbGVTeW5jQ29uZmlnICYmIGdvb2dsZVN5bmNDb25maWcuc2VwYXJhdGVGaWxlUGF0dGVybnMubGVuZ3RoID4gMCkge1xuICAgIHJldHVybiBHM1N0YXRzLnJldHJpZXZlRGlmZlN0YXRzKGdpdCwge1xuICAgICAgY2FyZXRha2VyOiBuZ0RldkNvbmZpZy5jYXJldGFrZXIsXG4gICAgICBnaXRodWI6IG5nRGV2Q29uZmlnLmdpdGh1YixcbiAgICB9KTtcbiAgfVxuICByZXR1cm47XG59XG4iXX0=