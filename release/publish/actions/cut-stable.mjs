/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import semver from 'semver';
import { getLtsNpmDistTagOfMajor } from '../../versioning/long-term-support.js';
import { exceptionalMinorPackageIndicator } from '../../versioning/version-branches.js';
import { FatalReleaseActionError } from '../actions-error.js';
import { ReleaseAction } from '../actions.js';
import { ExternalCommands } from '../external-commands.js';
/**
 * Release action that cuts a stable version for the current release-train
 * in the "release-candidate" phase.
 *
 * There are only two possible release-trains that can ever be in the RC phase.
 * This is either an exceptional-minor or the dedicated FF/RC release-train.
 */
export class CutStableAction extends ReleaseAction {
    constructor() {
        super(...arguments);
        this._train = (this.active.exceptionalMinor ?? this.active.releaseCandidate);
        this._branch = this._train.branchName;
        this._newVersion = this._computeNewVersion(this._train);
        this._isNewMajor = this._train.isMajor;
    }
    async getDescription() {
        if (this._isNewMajor) {
            return `Cut a stable release for the "${this._branch}" branch — published as \`@next\` (v${this._newVersion}).`;
        }
        else {
            return `Cut a stable release for the "${this._branch}" branch — published as \`@latest\` (v${this._newVersion}).`;
        }
    }
    async perform() {
        // This should never happen, but we add a sanity check just to be sure.
        if (this._isNewMajor && this._train === this.active.exceptionalMinor) {
            throw new FatalReleaseActionError('Unexpected major release of an `exceptional-minor`.');
        }
        const branchName = this._branch;
        const newVersion = this._newVersion;
        // When cutting a new stable minor/major or an exceptional minor, we want to build the
        // notes capturing all changes that have landed in the individual `-next`/RC pre-releases.
        const compareVersionForReleaseNotes = this.active.latest.version;
        // We always remove a potential exceptional-minor indicator. If we would
        // publish a stable version of an exceptional minor here- it would leave
        // the exceptional minor train and the indicator should be removed.
        const stagingOpts = {
            updatePkgJsonFn: (pkgJson) => {
                pkgJson[exceptionalMinorPackageIndicator] = undefined;
            },
        };
        const { pullRequest, releaseNotes, builtPackagesWithInfo, beforeStagingSha } = await this.checkoutBranchAndStageVersion(newVersion, compareVersionForReleaseNotes, branchName, stagingOpts);
        await this.promptAndWaitForPullRequestMerged(pullRequest);
        await this.publish(builtPackagesWithInfo, releaseNotes, beforeStagingSha, branchName, this._getNpmDistTag(), { showAsLatestOnGitHub: true });
        // If we turned an exceptional minor into the new patch, the temporary
        // NPM dist tag for the exceptional minor can be deleted. For more details
        // see the `CutExceptionalMinorPrereleaseAction` class.
        if (this._train === this.active.exceptionalMinor) {
            await ExternalCommands.invokeDeleteNpmDistTag(this.projectDir, 'do-not-use-exceptional-minor', this.pnpmVersioning);
        }
        // If a new major version is published and becomes the "latest" release-train, we need
        // to set the LTS npm dist tag for the previous latest release-train (the current patch).
        if (this._isNewMajor) {
            const previousPatch = this.active.latest;
            const ltsTagForPatch = getLtsNpmDistTagOfMajor(previousPatch.version.major);
            // Instead of directly setting the NPM dist tags, we invoke the ng-dev command for
            // setting the NPM dist tag to the specified version. We do this because release NPM
            // packages could be different in the previous patch branch, and we want to set the
            // LTS tag for all packages part of the last major. It would not be possible to set the
            // NPM dist tag for new packages part of the released major, nor would it be acceptable
            // to skip the LTS tag for packages which are no longer part of the new major.
            await this.checkoutUpstreamBranch(previousPatch.branchName);
            await this.installDependenciesForCurrentBranch();
            await ExternalCommands.invokeSetNpmDist(this.projectDir, ltsTagForPatch, previousPatch.version, this.pnpmVersioning, {
                // We do not intend to tag experimental NPM packages as LTS.
                skipExperimentalPackages: true,
            });
        }
        await this.cherryPickChangelogIntoNextBranch(releaseNotes, branchName);
    }
    _getNpmDistTag() {
        // If a new major version is published, we publish to the `next` NPM dist tag temporarily.
        // We do this because for major versions, we want all main Angular projects to have their
        // new major become available at the same time. Publishing immediately to the `latest` NPM
        // dist tag could cause inconsistent versions when users install packages with `@latest`.
        // For example: Consider Angular Framework releases v12. CLI and Components would need to
        // wait for that release to complete. Once done, they can update their dependencies to point
        // to v12. Afterwards they could start the release process. In the meanwhile though, the FW
        // dependencies were already available as `@latest`, so users could end up installing v12 while
        // still having the older (but currently still latest) CLI version that is incompatible.
        // The major release can be re-tagged to `latest` through a separate release action.
        return this._isNewMajor ? 'next' : 'latest';
    }
    /** Gets the new stable version of the given release-train. */
    _computeNewVersion({ version }) {
        return semver.parse(`${version.major}.${version.minor}.${version.patch}`);
    }
    static async isActive(active) {
        // -- Notes -- :
        //   * A stable version can be cut for an active release-train currently in the
        //     release-candidate phase.
        //   * If there is an exceptional minor, **only** the exceptional minor considered
        //     because it would be problematic if an in-progress RC would suddenly take over
        //     while there is still an in-progress exceptional minor.
        //   * It is impossible to directly release from feature-freeze phase into stable.
        if (active.exceptionalMinor !== null) {
            return active.exceptionalMinor.version.prerelease[0] === 'rc';
        }
        if (active.releaseCandidate !== null) {
            return active.releaseCandidate.version.prerelease[0] === 'rc';
        }
        return false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3V0LXN0YWJsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL3B1Ymxpc2gvYWN0aW9ucy9jdXQtc3RhYmxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUc1QixPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSx1Q0FBdUMsQ0FBQztBQUc5RSxPQUFPLEVBQUMsZ0NBQWdDLEVBQUMsTUFBTSxzQ0FBc0MsQ0FBQztBQUN0RixPQUFPLEVBQUMsdUJBQXVCLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUM1RCxPQUFPLEVBQUMsYUFBYSxFQUFpQixNQUFNLGVBQWUsQ0FBQztBQUM1RCxPQUFPLEVBQUMsZ0JBQWdCLEVBQUMsTUFBTSx5QkFBeUIsQ0FBQztBQUV6RDs7Ozs7O0dBTUc7QUFDSCxNQUFNLE9BQU8sZUFBZ0IsU0FBUSxhQUFhO0lBQWxEOztRQUNVLFdBQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBRSxDQUFDO1FBQ3pFLFlBQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQztRQUNqQyxnQkFBVyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbkQsZ0JBQVcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztJQStINUMsQ0FBQztJQTdIVSxLQUFLLENBQUMsY0FBYztRQUMzQixJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNyQixPQUFPLGlDQUFpQyxJQUFJLENBQUMsT0FBTyx1Q0FBdUMsSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDO1FBQ2xILENBQUM7YUFBTSxDQUFDO1lBQ04sT0FBTyxpQ0FBaUMsSUFBSSxDQUFDLE9BQU8seUNBQXlDLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQztRQUNwSCxDQUFDO0lBQ0gsQ0FBQztJQUVRLEtBQUssQ0FBQyxPQUFPO1FBQ3BCLHVFQUF1RTtRQUN2RSxJQUFJLElBQUksQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDckUsTUFBTSxJQUFJLHVCQUF1QixDQUFDLHFEQUFxRCxDQUFDLENBQUM7UUFDM0YsQ0FBQztRQUVELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDaEMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUVwQyxzRkFBc0Y7UUFDdEYsMEZBQTBGO1FBQzFGLE1BQU0sNkJBQTZCLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO1FBRWpFLHdFQUF3RTtRQUN4RSx3RUFBd0U7UUFDeEUsbUVBQW1FO1FBQ25FLE1BQU0sV0FBVyxHQUFtQjtZQUNsQyxlQUFlLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRTtnQkFDM0IsT0FBTyxDQUFDLGdDQUFnQyxDQUFDLEdBQUcsU0FBUyxDQUFDO1lBQ3hELENBQUM7U0FDRixDQUFDO1FBRUYsTUFBTSxFQUFDLFdBQVcsRUFBRSxZQUFZLEVBQUUscUJBQXFCLEVBQUUsZ0JBQWdCLEVBQUMsR0FDeEUsTUFBTSxJQUFJLENBQUMsNkJBQTZCLENBQ3RDLFVBQVUsRUFDViw2QkFBNkIsRUFDN0IsVUFBVSxFQUNWLFdBQVcsQ0FDWixDQUFDO1FBRUosTUFBTSxJQUFJLENBQUMsaUNBQWlDLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFMUQsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUNoQixxQkFBcUIsRUFDckIsWUFBWSxFQUNaLGdCQUFnQixFQUNoQixVQUFVLEVBQ1YsSUFBSSxDQUFDLGNBQWMsRUFBRSxFQUNyQixFQUFDLG9CQUFvQixFQUFFLElBQUksRUFBQyxDQUM3QixDQUFDO1FBRUYsc0VBQXNFO1FBQ3RFLDBFQUEwRTtRQUMxRSx1REFBdUQ7UUFDdkQsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUNqRCxNQUFNLGdCQUFnQixDQUFDLHNCQUFzQixDQUMzQyxJQUFJLENBQUMsVUFBVSxFQUNmLDhCQUE4QixFQUM5QixJQUFJLENBQUMsY0FBYyxDQUNwQixDQUFDO1FBQ0osQ0FBQztRQUVELHNGQUFzRjtRQUN0Rix5RkFBeUY7UUFDekYsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDckIsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7WUFDekMsTUFBTSxjQUFjLEdBQUcsdUJBQXVCLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUU1RSxrRkFBa0Y7WUFDbEYsb0ZBQW9GO1lBQ3BGLG1GQUFtRjtZQUNuRix1RkFBdUY7WUFDdkYsdUZBQXVGO1lBQ3ZGLDhFQUE4RTtZQUM5RSxNQUFNLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDNUQsTUFBTSxJQUFJLENBQUMsbUNBQW1DLEVBQUUsQ0FBQztZQUVqRCxNQUFNLGdCQUFnQixDQUFDLGdCQUFnQixDQUNyQyxJQUFJLENBQUMsVUFBVSxFQUNmLGNBQWMsRUFDZCxhQUFhLENBQUMsT0FBTyxFQUNyQixJQUFJLENBQUMsY0FBYyxFQUNuQjtnQkFDRSw0REFBNEQ7Z0JBQzVELHdCQUF3QixFQUFFLElBQUk7YUFDL0IsQ0FDRixDQUFDO1FBQ0osQ0FBQztRQUVELE1BQU0sSUFBSSxDQUFDLGlDQUFpQyxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBRU8sY0FBYztRQUNwQiwwRkFBMEY7UUFDMUYseUZBQXlGO1FBQ3pGLDBGQUEwRjtRQUMxRix5RkFBeUY7UUFDekYseUZBQXlGO1FBQ3pGLDRGQUE0RjtRQUM1RiwyRkFBMkY7UUFDM0YsK0ZBQStGO1FBQy9GLHdGQUF3RjtRQUN4RixvRkFBb0Y7UUFDcEYsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztJQUM5QyxDQUFDO0lBRUQsOERBQThEO0lBQ3RELGtCQUFrQixDQUFDLEVBQUMsT0FBTyxFQUFlO1FBQ2hELE9BQU8sTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxLQUFLLElBQUksT0FBTyxDQUFDLEtBQUssSUFBSSxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUUsQ0FBQztJQUM3RSxDQUFDO0lBRUQsTUFBTSxDQUFVLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBMkI7UUFDeEQsZ0JBQWdCO1FBQ2hCLCtFQUErRTtRQUMvRSwrQkFBK0I7UUFDL0Isa0ZBQWtGO1FBQ2xGLG9GQUFvRjtRQUNwRiw2REFBNkQ7UUFDN0Qsa0ZBQWtGO1FBQ2xGLElBQUksTUFBTSxDQUFDLGdCQUFnQixLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3JDLE9BQU8sTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDO1FBQ2hFLENBQUM7UUFDRCxJQUFJLE1BQU0sQ0FBQyxnQkFBZ0IsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUNyQyxPQUFPLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQztRQUNoRSxDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xuXG5pbXBvcnQge0FjdGl2ZVJlbGVhc2VUcmFpbnN9IGZyb20gJy4uLy4uL3ZlcnNpb25pbmcvYWN0aXZlLXJlbGVhc2UtdHJhaW5zLmpzJztcbmltcG9ydCB7Z2V0THRzTnBtRGlzdFRhZ09mTWFqb3J9IGZyb20gJy4uLy4uL3ZlcnNpb25pbmcvbG9uZy10ZXJtLXN1cHBvcnQuanMnO1xuaW1wb3J0IHtOcG1EaXN0VGFnfSBmcm9tICcuLi8uLi92ZXJzaW9uaW5nL25wbS1yZWdpc3RyeS5qcyc7XG5pbXBvcnQge1JlbGVhc2VUcmFpbn0gZnJvbSAnLi4vLi4vdmVyc2lvbmluZy9yZWxlYXNlLXRyYWlucy5qcyc7XG5pbXBvcnQge2V4Y2VwdGlvbmFsTWlub3JQYWNrYWdlSW5kaWNhdG9yfSBmcm9tICcuLi8uLi92ZXJzaW9uaW5nL3ZlcnNpb24tYnJhbmNoZXMuanMnO1xuaW1wb3J0IHtGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcn0gZnJvbSAnLi4vYWN0aW9ucy1lcnJvci5qcyc7XG5pbXBvcnQge1JlbGVhc2VBY3Rpb24sIFN0YWdpbmdPcHRpb25zfSBmcm9tICcuLi9hY3Rpb25zLmpzJztcbmltcG9ydCB7RXh0ZXJuYWxDb21tYW5kc30gZnJvbSAnLi4vZXh0ZXJuYWwtY29tbWFuZHMuanMnO1xuXG4vKipcbiAqIFJlbGVhc2UgYWN0aW9uIHRoYXQgY3V0cyBhIHN0YWJsZSB2ZXJzaW9uIGZvciB0aGUgY3VycmVudCByZWxlYXNlLXRyYWluXG4gKiBpbiB0aGUgXCJyZWxlYXNlLWNhbmRpZGF0ZVwiIHBoYXNlLlxuICpcbiAqIFRoZXJlIGFyZSBvbmx5IHR3byBwb3NzaWJsZSByZWxlYXNlLXRyYWlucyB0aGF0IGNhbiBldmVyIGJlIGluIHRoZSBSQyBwaGFzZS5cbiAqIFRoaXMgaXMgZWl0aGVyIGFuIGV4Y2VwdGlvbmFsLW1pbm9yIG9yIHRoZSBkZWRpY2F0ZWQgRkYvUkMgcmVsZWFzZS10cmFpbi5cbiAqL1xuZXhwb3J0IGNsYXNzIEN1dFN0YWJsZUFjdGlvbiBleHRlbmRzIFJlbGVhc2VBY3Rpb24ge1xuICBwcml2YXRlIF90cmFpbiA9ICh0aGlzLmFjdGl2ZS5leGNlcHRpb25hbE1pbm9yID8/IHRoaXMuYWN0aXZlLnJlbGVhc2VDYW5kaWRhdGUpITtcbiAgcHJpdmF0ZSBfYnJhbmNoID0gdGhpcy5fdHJhaW4uYnJhbmNoTmFtZTtcbiAgcHJpdmF0ZSBfbmV3VmVyc2lvbiA9IHRoaXMuX2NvbXB1dGVOZXdWZXJzaW9uKHRoaXMuX3RyYWluKTtcbiAgcHJpdmF0ZSBfaXNOZXdNYWpvciA9IHRoaXMuX3RyYWluLmlzTWFqb3I7XG5cbiAgb3ZlcnJpZGUgYXN5bmMgZ2V0RGVzY3JpcHRpb24oKSB7XG4gICAgaWYgKHRoaXMuX2lzTmV3TWFqb3IpIHtcbiAgICAgIHJldHVybiBgQ3V0IGEgc3RhYmxlIHJlbGVhc2UgZm9yIHRoZSBcIiR7dGhpcy5fYnJhbmNofVwiIGJyYW5jaCDigJQgcHVibGlzaGVkIGFzIFxcYEBuZXh0XFxgICh2JHt0aGlzLl9uZXdWZXJzaW9ufSkuYDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGBDdXQgYSBzdGFibGUgcmVsZWFzZSBmb3IgdGhlIFwiJHt0aGlzLl9icmFuY2h9XCIgYnJhbmNoIOKAlCBwdWJsaXNoZWQgYXMgXFxgQGxhdGVzdFxcYCAodiR7dGhpcy5fbmV3VmVyc2lvbn0pLmA7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgYXN5bmMgcGVyZm9ybSgpIHtcbiAgICAvLyBUaGlzIHNob3VsZCBuZXZlciBoYXBwZW4sIGJ1dCB3ZSBhZGQgYSBzYW5pdHkgY2hlY2sganVzdCB0byBiZSBzdXJlLlxuICAgIGlmICh0aGlzLl9pc05ld01ham9yICYmIHRoaXMuX3RyYWluID09PSB0aGlzLmFjdGl2ZS5leGNlcHRpb25hbE1pbm9yKSB7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoJ1VuZXhwZWN0ZWQgbWFqb3IgcmVsZWFzZSBvZiBhbiBgZXhjZXB0aW9uYWwtbWlub3JgLicpO1xuICAgIH1cblxuICAgIGNvbnN0IGJyYW5jaE5hbWUgPSB0aGlzLl9icmFuY2g7XG4gICAgY29uc3QgbmV3VmVyc2lvbiA9IHRoaXMuX25ld1ZlcnNpb247XG5cbiAgICAvLyBXaGVuIGN1dHRpbmcgYSBuZXcgc3RhYmxlIG1pbm9yL21ham9yIG9yIGFuIGV4Y2VwdGlvbmFsIG1pbm9yLCB3ZSB3YW50IHRvIGJ1aWxkIHRoZVxuICAgIC8vIG5vdGVzIGNhcHR1cmluZyBhbGwgY2hhbmdlcyB0aGF0IGhhdmUgbGFuZGVkIGluIHRoZSBpbmRpdmlkdWFsIGAtbmV4dGAvUkMgcHJlLXJlbGVhc2VzLlxuICAgIGNvbnN0IGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzID0gdGhpcy5hY3RpdmUubGF0ZXN0LnZlcnNpb247XG5cbiAgICAvLyBXZSBhbHdheXMgcmVtb3ZlIGEgcG90ZW50aWFsIGV4Y2VwdGlvbmFsLW1pbm9yIGluZGljYXRvci4gSWYgd2Ugd291bGRcbiAgICAvLyBwdWJsaXNoIGEgc3RhYmxlIHZlcnNpb24gb2YgYW4gZXhjZXB0aW9uYWwgbWlub3IgaGVyZS0gaXQgd291bGQgbGVhdmVcbiAgICAvLyB0aGUgZXhjZXB0aW9uYWwgbWlub3IgdHJhaW4gYW5kIHRoZSBpbmRpY2F0b3Igc2hvdWxkIGJlIHJlbW92ZWQuXG4gICAgY29uc3Qgc3RhZ2luZ09wdHM6IFN0YWdpbmdPcHRpb25zID0ge1xuICAgICAgdXBkYXRlUGtnSnNvbkZuOiAocGtnSnNvbikgPT4ge1xuICAgICAgICBwa2dKc29uW2V4Y2VwdGlvbmFsTWlub3JQYWNrYWdlSW5kaWNhdG9yXSA9IHVuZGVmaW5lZDtcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIGNvbnN0IHtwdWxsUmVxdWVzdCwgcmVsZWFzZU5vdGVzLCBidWlsdFBhY2thZ2VzV2l0aEluZm8sIGJlZm9yZVN0YWdpbmdTaGF9ID1cbiAgICAgIGF3YWl0IHRoaXMuY2hlY2tvdXRCcmFuY2hBbmRTdGFnZVZlcnNpb24oXG4gICAgICAgIG5ld1ZlcnNpb24sXG4gICAgICAgIGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzLFxuICAgICAgICBicmFuY2hOYW1lLFxuICAgICAgICBzdGFnaW5nT3B0cyxcbiAgICAgICk7XG5cbiAgICBhd2FpdCB0aGlzLnByb21wdEFuZFdhaXRGb3JQdWxsUmVxdWVzdE1lcmdlZChwdWxsUmVxdWVzdCk7XG5cbiAgICBhd2FpdCB0aGlzLnB1Ymxpc2goXG4gICAgICBidWlsdFBhY2thZ2VzV2l0aEluZm8sXG4gICAgICByZWxlYXNlTm90ZXMsXG4gICAgICBiZWZvcmVTdGFnaW5nU2hhLFxuICAgICAgYnJhbmNoTmFtZSxcbiAgICAgIHRoaXMuX2dldE5wbURpc3RUYWcoKSxcbiAgICAgIHtzaG93QXNMYXRlc3RPbkdpdEh1YjogdHJ1ZX0sXG4gICAgKTtcblxuICAgIC8vIElmIHdlIHR1cm5lZCBhbiBleGNlcHRpb25hbCBtaW5vciBpbnRvIHRoZSBuZXcgcGF0Y2gsIHRoZSB0ZW1wb3JhcnlcbiAgICAvLyBOUE0gZGlzdCB0YWcgZm9yIHRoZSBleGNlcHRpb25hbCBtaW5vciBjYW4gYmUgZGVsZXRlZC4gRm9yIG1vcmUgZGV0YWlsc1xuICAgIC8vIHNlZSB0aGUgYEN1dEV4Y2VwdGlvbmFsTWlub3JQcmVyZWxlYXNlQWN0aW9uYCBjbGFzcy5cbiAgICBpZiAodGhpcy5fdHJhaW4gPT09IHRoaXMuYWN0aXZlLmV4Y2VwdGlvbmFsTWlub3IpIHtcbiAgICAgIGF3YWl0IEV4dGVybmFsQ29tbWFuZHMuaW52b2tlRGVsZXRlTnBtRGlzdFRhZyhcbiAgICAgICAgdGhpcy5wcm9qZWN0RGlyLFxuICAgICAgICAnZG8tbm90LXVzZS1leGNlcHRpb25hbC1taW5vcicsXG4gICAgICAgIHRoaXMucG5wbVZlcnNpb25pbmcsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIElmIGEgbmV3IG1ham9yIHZlcnNpb24gaXMgcHVibGlzaGVkIGFuZCBiZWNvbWVzIHRoZSBcImxhdGVzdFwiIHJlbGVhc2UtdHJhaW4sIHdlIG5lZWRcbiAgICAvLyB0byBzZXQgdGhlIExUUyBucG0gZGlzdCB0YWcgZm9yIHRoZSBwcmV2aW91cyBsYXRlc3QgcmVsZWFzZS10cmFpbiAodGhlIGN1cnJlbnQgcGF0Y2gpLlxuICAgIGlmICh0aGlzLl9pc05ld01ham9yKSB7XG4gICAgICBjb25zdCBwcmV2aW91c1BhdGNoID0gdGhpcy5hY3RpdmUubGF0ZXN0O1xuICAgICAgY29uc3QgbHRzVGFnRm9yUGF0Y2ggPSBnZXRMdHNOcG1EaXN0VGFnT2ZNYWpvcihwcmV2aW91c1BhdGNoLnZlcnNpb24ubWFqb3IpO1xuXG4gICAgICAvLyBJbnN0ZWFkIG9mIGRpcmVjdGx5IHNldHRpbmcgdGhlIE5QTSBkaXN0IHRhZ3MsIHdlIGludm9rZSB0aGUgbmctZGV2IGNvbW1hbmQgZm9yXG4gICAgICAvLyBzZXR0aW5nIHRoZSBOUE0gZGlzdCB0YWcgdG8gdGhlIHNwZWNpZmllZCB2ZXJzaW9uLiBXZSBkbyB0aGlzIGJlY2F1c2UgcmVsZWFzZSBOUE1cbiAgICAgIC8vIHBhY2thZ2VzIGNvdWxkIGJlIGRpZmZlcmVudCBpbiB0aGUgcHJldmlvdXMgcGF0Y2ggYnJhbmNoLCBhbmQgd2Ugd2FudCB0byBzZXQgdGhlXG4gICAgICAvLyBMVFMgdGFnIGZvciBhbGwgcGFja2FnZXMgcGFydCBvZiB0aGUgbGFzdCBtYWpvci4gSXQgd291bGQgbm90IGJlIHBvc3NpYmxlIHRvIHNldCB0aGVcbiAgICAgIC8vIE5QTSBkaXN0IHRhZyBmb3IgbmV3IHBhY2thZ2VzIHBhcnQgb2YgdGhlIHJlbGVhc2VkIG1ham9yLCBub3Igd291bGQgaXQgYmUgYWNjZXB0YWJsZVxuICAgICAgLy8gdG8gc2tpcCB0aGUgTFRTIHRhZyBmb3IgcGFja2FnZXMgd2hpY2ggYXJlIG5vIGxvbmdlciBwYXJ0IG9mIHRoZSBuZXcgbWFqb3IuXG4gICAgICBhd2FpdCB0aGlzLmNoZWNrb3V0VXBzdHJlYW1CcmFuY2gocHJldmlvdXNQYXRjaC5icmFuY2hOYW1lKTtcbiAgICAgIGF3YWl0IHRoaXMuaW5zdGFsbERlcGVuZGVuY2llc0ZvckN1cnJlbnRCcmFuY2goKTtcblxuICAgICAgYXdhaXQgRXh0ZXJuYWxDb21tYW5kcy5pbnZva2VTZXROcG1EaXN0KFxuICAgICAgICB0aGlzLnByb2plY3REaXIsXG4gICAgICAgIGx0c1RhZ0ZvclBhdGNoLFxuICAgICAgICBwcmV2aW91c1BhdGNoLnZlcnNpb24sXG4gICAgICAgIHRoaXMucG5wbVZlcnNpb25pbmcsXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBXZSBkbyBub3QgaW50ZW5kIHRvIHRhZyBleHBlcmltZW50YWwgTlBNIHBhY2thZ2VzIGFzIExUUy5cbiAgICAgICAgICBza2lwRXhwZXJpbWVudGFsUGFja2FnZXM6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICApO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuY2hlcnJ5UGlja0NoYW5nZWxvZ0ludG9OZXh0QnJhbmNoKHJlbGVhc2VOb3RlcywgYnJhbmNoTmFtZSk7XG4gIH1cblxuICBwcml2YXRlIF9nZXROcG1EaXN0VGFnKCk6IE5wbURpc3RUYWcge1xuICAgIC8vIElmIGEgbmV3IG1ham9yIHZlcnNpb24gaXMgcHVibGlzaGVkLCB3ZSBwdWJsaXNoIHRvIHRoZSBgbmV4dGAgTlBNIGRpc3QgdGFnIHRlbXBvcmFyaWx5LlxuICAgIC8vIFdlIGRvIHRoaXMgYmVjYXVzZSBmb3IgbWFqb3IgdmVyc2lvbnMsIHdlIHdhbnQgYWxsIG1haW4gQW5ndWxhciBwcm9qZWN0cyB0byBoYXZlIHRoZWlyXG4gICAgLy8gbmV3IG1ham9yIGJlY29tZSBhdmFpbGFibGUgYXQgdGhlIHNhbWUgdGltZS4gUHVibGlzaGluZyBpbW1lZGlhdGVseSB0byB0aGUgYGxhdGVzdGAgTlBNXG4gICAgLy8gZGlzdCB0YWcgY291bGQgY2F1c2UgaW5jb25zaXN0ZW50IHZlcnNpb25zIHdoZW4gdXNlcnMgaW5zdGFsbCBwYWNrYWdlcyB3aXRoIGBAbGF0ZXN0YC5cbiAgICAvLyBGb3IgZXhhbXBsZTogQ29uc2lkZXIgQW5ndWxhciBGcmFtZXdvcmsgcmVsZWFzZXMgdjEyLiBDTEkgYW5kIENvbXBvbmVudHMgd291bGQgbmVlZCB0b1xuICAgIC8vIHdhaXQgZm9yIHRoYXQgcmVsZWFzZSB0byBjb21wbGV0ZS4gT25jZSBkb25lLCB0aGV5IGNhbiB1cGRhdGUgdGhlaXIgZGVwZW5kZW5jaWVzIHRvIHBvaW50XG4gICAgLy8gdG8gdjEyLiBBZnRlcndhcmRzIHRoZXkgY291bGQgc3RhcnQgdGhlIHJlbGVhc2UgcHJvY2Vzcy4gSW4gdGhlIG1lYW53aGlsZSB0aG91Z2gsIHRoZSBGV1xuICAgIC8vIGRlcGVuZGVuY2llcyB3ZXJlIGFscmVhZHkgYXZhaWxhYmxlIGFzIGBAbGF0ZXN0YCwgc28gdXNlcnMgY291bGQgZW5kIHVwIGluc3RhbGxpbmcgdjEyIHdoaWxlXG4gICAgLy8gc3RpbGwgaGF2aW5nIHRoZSBvbGRlciAoYnV0IGN1cnJlbnRseSBzdGlsbCBsYXRlc3QpIENMSSB2ZXJzaW9uIHRoYXQgaXMgaW5jb21wYXRpYmxlLlxuICAgIC8vIFRoZSBtYWpvciByZWxlYXNlIGNhbiBiZSByZS10YWdnZWQgdG8gYGxhdGVzdGAgdGhyb3VnaCBhIHNlcGFyYXRlIHJlbGVhc2UgYWN0aW9uLlxuICAgIHJldHVybiB0aGlzLl9pc05ld01ham9yID8gJ25leHQnIDogJ2xhdGVzdCc7XG4gIH1cblxuICAvKiogR2V0cyB0aGUgbmV3IHN0YWJsZSB2ZXJzaW9uIG9mIHRoZSBnaXZlbiByZWxlYXNlLXRyYWluLiAqL1xuICBwcml2YXRlIF9jb21wdXRlTmV3VmVyc2lvbih7dmVyc2lvbn06IFJlbGVhc2VUcmFpbik6IHNlbXZlci5TZW1WZXIge1xuICAgIHJldHVybiBzZW12ZXIucGFyc2UoYCR7dmVyc2lvbi5tYWpvcn0uJHt2ZXJzaW9uLm1pbm9yfS4ke3ZlcnNpb24ucGF0Y2h9YCkhO1xuICB9XG5cbiAgc3RhdGljIG92ZXJyaWRlIGFzeW5jIGlzQWN0aXZlKGFjdGl2ZTogQWN0aXZlUmVsZWFzZVRyYWlucykge1xuICAgIC8vIC0tIE5vdGVzIC0tIDpcbiAgICAvLyAgICogQSBzdGFibGUgdmVyc2lvbiBjYW4gYmUgY3V0IGZvciBhbiBhY3RpdmUgcmVsZWFzZS10cmFpbiBjdXJyZW50bHkgaW4gdGhlXG4gICAgLy8gICAgIHJlbGVhc2UtY2FuZGlkYXRlIHBoYXNlLlxuICAgIC8vICAgKiBJZiB0aGVyZSBpcyBhbiBleGNlcHRpb25hbCBtaW5vciwgKipvbmx5KiogdGhlIGV4Y2VwdGlvbmFsIG1pbm9yIGNvbnNpZGVyZWRcbiAgICAvLyAgICAgYmVjYXVzZSBpdCB3b3VsZCBiZSBwcm9ibGVtYXRpYyBpZiBhbiBpbi1wcm9ncmVzcyBSQyB3b3VsZCBzdWRkZW5seSB0YWtlIG92ZXJcbiAgICAvLyAgICAgd2hpbGUgdGhlcmUgaXMgc3RpbGwgYW4gaW4tcHJvZ3Jlc3MgZXhjZXB0aW9uYWwgbWlub3IuXG4gICAgLy8gICAqIEl0IGlzIGltcG9zc2libGUgdG8gZGlyZWN0bHkgcmVsZWFzZSBmcm9tIGZlYXR1cmUtZnJlZXplIHBoYXNlIGludG8gc3RhYmxlLlxuICAgIGlmIChhY3RpdmUuZXhjZXB0aW9uYWxNaW5vciAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGFjdGl2ZS5leGNlcHRpb25hbE1pbm9yLnZlcnNpb24ucHJlcmVsZWFzZVswXSA9PT0gJ3JjJztcbiAgICB9XG4gICAgaWYgKGFjdGl2ZS5yZWxlYXNlQ2FuZGlkYXRlICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gYWN0aXZlLnJlbGVhc2VDYW5kaWRhdGUudmVyc2lvbi5wcmVyZWxlYXNlWzBdID09PSAncmMnO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cbiJdfQ==