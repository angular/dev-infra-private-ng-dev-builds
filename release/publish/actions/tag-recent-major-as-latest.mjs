/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import semver from 'semver';
import { fetchProjectNpmPackageInfo } from '../../versioning/npm-registry.js';
import { ReleaseAction } from '../actions.js';
import { ExternalCommands } from '../external-commands.js';
import { getReleaseTagForVersion } from '../../versioning/version-tags.js';
/**
 * Release action that tags the recently published major as latest within the NPM
 * registry. Major versions are published to the `next` NPM dist tag initially and
 * can be re-tagged to the `latest` NPM dist tag. This allows caretakers to make major
 * releases available at the same time. e.g. Framework, Tooling and Components
 * are able to publish v12 to `@latest` at the same time. This wouldn't be possible if
 * we directly publish to `@latest` because Tooling and Components needs to wait
 * for the major framework release to be available on NPM.
 * @see {CutStableAction#perform} for more details.
 */
export class TagRecentMajorAsLatest extends ReleaseAction {
    async getDescription() {
        return `Retag recently published major v${this.active.latest.version} as "latest" in NPM.`;
    }
    async perform() {
        await this.updateGithubReleaseEntryToStable(this.active.latest.version);
        await this.checkoutUpstreamBranch(this.active.latest.branchName);
        await this.installDependenciesForCurrentBranch();
        await ExternalCommands.invokeSetNpmDist(this.projectDir, 'latest', this.active.latest.version);
    }
    /**
     * Updates the Github release entry for the specified version to show
     * it as stable release, compared to it being shown as a pre-release.
     */
    async updateGithubReleaseEntryToStable(version) {
        const releaseTagName = getReleaseTagForVersion(version);
        const { data: releaseInfo } = await this.git.github.repos.getReleaseByTag({
            ...this.git.remoteParams,
            tag: releaseTagName,
        });
        await this.git.github.repos.updateRelease({
            ...this.git.remoteParams,
            release_id: releaseInfo.id,
            prerelease: false,
        });
    }
    static async isActive({ latest }, config) {
        // If the latest release-train does currently not have a major version as version. e.g.
        // the latest branch is `10.0.x` with the version being `10.0.2`. In such cases, a major
        // has not been released recently, and this action should never become active.
        if (latest.version.minor !== 0 || latest.version.patch !== 0) {
            return false;
        }
        const packageInfo = await fetchProjectNpmPackageInfo(config);
        const npmLatestVersion = semver.parse(packageInfo['dist-tags']['latest']);
        // This action only becomes active if a major just has been released recently, but is
        // not set to the `latest` NPM dist tag in the NPM registry. Note that we only allow
        // re-tagging if the current `@latest` in NPM is the previous major version.
        return npmLatestVersion !== null && npmLatestVersion.major === latest.version.major - 1;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFnLXJlY2VudC1tYWpvci1hcy1sYXRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9wdWJsaXNoL2FjdGlvbnMvdGFnLXJlY2VudC1tYWpvci1hcy1sYXRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBSTVCLE9BQU8sRUFBQywwQkFBMEIsRUFBQyxNQUFNLGtDQUFrQyxDQUFDO0FBQzVFLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFDNUMsT0FBTyxFQUFDLGdCQUFnQixFQUFDLE1BQU0seUJBQXlCLENBQUM7QUFDekQsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sa0NBQWtDLENBQUM7QUFFekU7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBTSxPQUFPLHNCQUF1QixTQUFRLGFBQWE7SUFDOUMsS0FBSyxDQUFDLGNBQWM7UUFDM0IsT0FBTyxtQ0FBbUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxzQkFBc0IsQ0FBQztJQUM3RixDQUFDO0lBRVEsS0FBSyxDQUFDLE9BQU87UUFDcEIsTUFBTSxJQUFJLENBQUMsZ0NBQWdDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDeEUsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDakUsTUFBTSxJQUFJLENBQUMsbUNBQW1DLEVBQUUsQ0FBQztRQUNqRCxNQUFNLGdCQUFnQixDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2pHLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsZ0NBQWdDLENBQUMsT0FBc0I7UUFDM0QsTUFBTSxjQUFjLEdBQUcsdUJBQXVCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDeEQsTUFBTSxFQUFDLElBQUksRUFBRSxXQUFXLEVBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUM7WUFDdEUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVk7WUFDeEIsR0FBRyxFQUFFLGNBQWM7U0FDcEIsQ0FBQyxDQUFDO1FBRUgsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDO1lBQ3hDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZO1lBQ3hCLFVBQVUsRUFBRSxXQUFXLENBQUMsRUFBRTtZQUMxQixVQUFVLEVBQUUsS0FBSztTQUNsQixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsTUFBTSxDQUFVLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBQyxNQUFNLEVBQXNCLEVBQUUsTUFBcUI7UUFDakYsdUZBQXVGO1FBQ3ZGLHdGQUF3RjtRQUN4Riw4RUFBOEU7UUFDOUUsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDN0QsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO1FBRUQsTUFBTSxXQUFXLEdBQUcsTUFBTSwwQkFBMEIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM3RCxNQUFNLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDMUUscUZBQXFGO1FBQ3JGLG9GQUFvRjtRQUNwRiw0RUFBNEU7UUFDNUUsT0FBTyxnQkFBZ0IsS0FBSyxJQUFJLElBQUksZ0JBQWdCLENBQUMsS0FBSyxLQUFLLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztJQUMxRixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xuXG5pbXBvcnQge1JlbGVhc2VDb25maWd9IGZyb20gJy4uLy4uL2NvbmZpZy9pbmRleC5qcyc7XG5pbXBvcnQge0FjdGl2ZVJlbGVhc2VUcmFpbnN9IGZyb20gJy4uLy4uL3ZlcnNpb25pbmcvYWN0aXZlLXJlbGVhc2UtdHJhaW5zLmpzJztcbmltcG9ydCB7ZmV0Y2hQcm9qZWN0TnBtUGFja2FnZUluZm99IGZyb20gJy4uLy4uL3ZlcnNpb25pbmcvbnBtLXJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7UmVsZWFzZUFjdGlvbn0gZnJvbSAnLi4vYWN0aW9ucy5qcyc7XG5pbXBvcnQge0V4dGVybmFsQ29tbWFuZHN9IGZyb20gJy4uL2V4dGVybmFsLWNvbW1hbmRzLmpzJztcbmltcG9ydCB7Z2V0UmVsZWFzZVRhZ0ZvclZlcnNpb259IGZyb20gJy4uLy4uL3ZlcnNpb25pbmcvdmVyc2lvbi10YWdzLmpzJztcblxuLyoqXG4gKiBSZWxlYXNlIGFjdGlvbiB0aGF0IHRhZ3MgdGhlIHJlY2VudGx5IHB1Ymxpc2hlZCBtYWpvciBhcyBsYXRlc3Qgd2l0aGluIHRoZSBOUE1cbiAqIHJlZ2lzdHJ5LiBNYWpvciB2ZXJzaW9ucyBhcmUgcHVibGlzaGVkIHRvIHRoZSBgbmV4dGAgTlBNIGRpc3QgdGFnIGluaXRpYWxseSBhbmRcbiAqIGNhbiBiZSByZS10YWdnZWQgdG8gdGhlIGBsYXRlc3RgIE5QTSBkaXN0IHRhZy4gVGhpcyBhbGxvd3MgY2FyZXRha2VycyB0byBtYWtlIG1ham9yXG4gKiByZWxlYXNlcyBhdmFpbGFibGUgYXQgdGhlIHNhbWUgdGltZS4gZS5nLiBGcmFtZXdvcmssIFRvb2xpbmcgYW5kIENvbXBvbmVudHNcbiAqIGFyZSBhYmxlIHRvIHB1Ymxpc2ggdjEyIHRvIGBAbGF0ZXN0YCBhdCB0aGUgc2FtZSB0aW1lLiBUaGlzIHdvdWxkbid0IGJlIHBvc3NpYmxlIGlmXG4gKiB3ZSBkaXJlY3RseSBwdWJsaXNoIHRvIGBAbGF0ZXN0YCBiZWNhdXNlIFRvb2xpbmcgYW5kIENvbXBvbmVudHMgbmVlZHMgdG8gd2FpdFxuICogZm9yIHRoZSBtYWpvciBmcmFtZXdvcmsgcmVsZWFzZSB0byBiZSBhdmFpbGFibGUgb24gTlBNLlxuICogQHNlZSB7Q3V0U3RhYmxlQWN0aW9uI3BlcmZvcm19IGZvciBtb3JlIGRldGFpbHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBUYWdSZWNlbnRNYWpvckFzTGF0ZXN0IGV4dGVuZHMgUmVsZWFzZUFjdGlvbiB7XG4gIG92ZXJyaWRlIGFzeW5jIGdldERlc2NyaXB0aW9uKCkge1xuICAgIHJldHVybiBgUmV0YWcgcmVjZW50bHkgcHVibGlzaGVkIG1ham9yIHYke3RoaXMuYWN0aXZlLmxhdGVzdC52ZXJzaW9ufSBhcyBcImxhdGVzdFwiIGluIE5QTS5gO1xuICB9XG5cbiAgb3ZlcnJpZGUgYXN5bmMgcGVyZm9ybSgpIHtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZUdpdGh1YlJlbGVhc2VFbnRyeVRvU3RhYmxlKHRoaXMuYWN0aXZlLmxhdGVzdC52ZXJzaW9uKTtcbiAgICBhd2FpdCB0aGlzLmNoZWNrb3V0VXBzdHJlYW1CcmFuY2godGhpcy5hY3RpdmUubGF0ZXN0LmJyYW5jaE5hbWUpO1xuICAgIGF3YWl0IHRoaXMuaW5zdGFsbERlcGVuZGVuY2llc0ZvckN1cnJlbnRCcmFuY2goKTtcbiAgICBhd2FpdCBFeHRlcm5hbENvbW1hbmRzLmludm9rZVNldE5wbURpc3QodGhpcy5wcm9qZWN0RGlyLCAnbGF0ZXN0JywgdGhpcy5hY3RpdmUubGF0ZXN0LnZlcnNpb24pO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZXMgdGhlIEdpdGh1YiByZWxlYXNlIGVudHJ5IGZvciB0aGUgc3BlY2lmaWVkIHZlcnNpb24gdG8gc2hvd1xuICAgKiBpdCBhcyBzdGFibGUgcmVsZWFzZSwgY29tcGFyZWQgdG8gaXQgYmVpbmcgc2hvd24gYXMgYSBwcmUtcmVsZWFzZS5cbiAgICovXG4gIGFzeW5jIHVwZGF0ZUdpdGh1YlJlbGVhc2VFbnRyeVRvU3RhYmxlKHZlcnNpb246IHNlbXZlci5TZW1WZXIpIHtcbiAgICBjb25zdCByZWxlYXNlVGFnTmFtZSA9IGdldFJlbGVhc2VUYWdGb3JWZXJzaW9uKHZlcnNpb24pO1xuICAgIGNvbnN0IHtkYXRhOiByZWxlYXNlSW5mb30gPSBhd2FpdCB0aGlzLmdpdC5naXRodWIucmVwb3MuZ2V0UmVsZWFzZUJ5VGFnKHtcbiAgICAgIC4uLnRoaXMuZ2l0LnJlbW90ZVBhcmFtcyxcbiAgICAgIHRhZzogcmVsZWFzZVRhZ05hbWUsXG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLmdpdC5naXRodWIucmVwb3MudXBkYXRlUmVsZWFzZSh7XG4gICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICByZWxlYXNlX2lkOiByZWxlYXNlSW5mby5pZCxcbiAgICAgIHByZXJlbGVhc2U6IGZhbHNlLFxuICAgIH0pO1xuICB9XG5cbiAgc3RhdGljIG92ZXJyaWRlIGFzeW5jIGlzQWN0aXZlKHtsYXRlc3R9OiBBY3RpdmVSZWxlYXNlVHJhaW5zLCBjb25maWc6IFJlbGVhc2VDb25maWcpIHtcbiAgICAvLyBJZiB0aGUgbGF0ZXN0IHJlbGVhc2UtdHJhaW4gZG9lcyBjdXJyZW50bHkgbm90IGhhdmUgYSBtYWpvciB2ZXJzaW9uIGFzIHZlcnNpb24uIGUuZy5cbiAgICAvLyB0aGUgbGF0ZXN0IGJyYW5jaCBpcyBgMTAuMC54YCB3aXRoIHRoZSB2ZXJzaW9uIGJlaW5nIGAxMC4wLjJgLiBJbiBzdWNoIGNhc2VzLCBhIG1ham9yXG4gICAgLy8gaGFzIG5vdCBiZWVuIHJlbGVhc2VkIHJlY2VudGx5LCBhbmQgdGhpcyBhY3Rpb24gc2hvdWxkIG5ldmVyIGJlY29tZSBhY3RpdmUuXG4gICAgaWYgKGxhdGVzdC52ZXJzaW9uLm1pbm9yICE9PSAwIHx8IGxhdGVzdC52ZXJzaW9uLnBhdGNoICE9PSAwKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3QgcGFja2FnZUluZm8gPSBhd2FpdCBmZXRjaFByb2plY3ROcG1QYWNrYWdlSW5mbyhjb25maWcpO1xuICAgIGNvbnN0IG5wbUxhdGVzdFZlcnNpb24gPSBzZW12ZXIucGFyc2UocGFja2FnZUluZm9bJ2Rpc3QtdGFncyddWydsYXRlc3QnXSk7XG4gICAgLy8gVGhpcyBhY3Rpb24gb25seSBiZWNvbWVzIGFjdGl2ZSBpZiBhIG1ham9yIGp1c3QgaGFzIGJlZW4gcmVsZWFzZWQgcmVjZW50bHksIGJ1dCBpc1xuICAgIC8vIG5vdCBzZXQgdG8gdGhlIGBsYXRlc3RgIE5QTSBkaXN0IHRhZyBpbiB0aGUgTlBNIHJlZ2lzdHJ5LiBOb3RlIHRoYXQgd2Ugb25seSBhbGxvd1xuICAgIC8vIHJlLXRhZ2dpbmcgaWYgdGhlIGN1cnJlbnQgYEBsYXRlc3RgIGluIE5QTSBpcyB0aGUgcHJldmlvdXMgbWFqb3IgdmVyc2lvbi5cbiAgICByZXR1cm4gbnBtTGF0ZXN0VmVyc2lvbiAhPT0gbnVsbCAmJiBucG1MYXRlc3RWZXJzaW9uLm1ham9yID09PSBsYXRlc3QudmVyc2lvbi5tYWpvciAtIDE7XG4gIH1cbn1cbiJdfQ==