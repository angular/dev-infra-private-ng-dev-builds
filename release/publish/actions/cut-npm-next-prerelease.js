/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { isVersionPublishedToNpm } from '../../versioning/npm-registry.js';
import { isFirstNextPrerelease } from '../../versioning/prerelease-version.js';
import { CutPrereleaseBaseAction } from './shared/cut-prerelease.js';
/**
 * Release action that allows NPM `@next` pre-releases. The action will
 * always be active and operate on the an ongoing FF/RC train, or the
 * next release-train.
 *
 * The action will bump the pre-release version to the next increment
 * and publish it to NPM along with the `@npm` dist tag.
 */
export class CutNpmNextPrereleaseAction extends CutPrereleaseBaseAction {
    constructor() {
        super(...arguments);
        this.releaseTrain = this.active.releaseCandidate ?? this.active.next;
        this.npmDistTag = 'next';
        this.shouldUseExistingVersion = (async () => {
            // Special-case where the version in the `next` release-train is not published yet. This
            // happens when we recently branched off for feature-freeze. We already bump the version to
            // the next minor or major, but do not publish immediately. Cutting a release immediately
            // would be not helpful as there are no other changes than in the feature-freeze branch. If
            // we happen to detect this case, we stage the release as usual but do not increment the version.
            if (this.releaseTrain === this.active.next && isFirstNextPrerelease(this.active.next.version)) {
                return !(await isVersionPublishedToNpm(this.active.next.version, this.config));
            }
            return false;
        })();
        this.releaseNotesCompareVersion = (async () => {
            // If we happen to detect the case from above, we use the most recent patch version as base
            // for building release notes. This is better than finding the "next" version when we
            // branched off as it also prevents us from duplicating many commits that have already
            // landed in the new patch that was worked on when we branched off.
            // For more details see the release notes generation and commit range determination.
            if (this.releaseTrain === this.active.next && (await this.shouldUseExistingVersion)) {
                return this.active.latest.version;
            }
            return this.releaseTrain.version;
        })();
    }
    static async isActive(_active) {
        // Pre-releases for the `next` NPM dist tag can always be cut. A NPM next
        // release could always either occur for an in-progress FF/RCm, or `next`.
        return true;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3V0LW5wbS1uZXh0LXByZXJlbGVhc2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9wdWJsaXNoL2FjdGlvbnMvY3V0LW5wbS1uZXh0LXByZXJlbGVhc2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBSUgsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sa0NBQWtDLENBQUM7QUFDekUsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sd0NBQXdDLENBQUM7QUFDN0UsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sNEJBQTRCLENBQUM7QUFFbkU7Ozs7Ozs7R0FPRztBQUNILE1BQU0sT0FBTywwQkFBMkIsU0FBUSx1QkFBdUI7SUFBdkU7O1FBQ0UsaUJBQVksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBQ2hFLGVBQVUsR0FBRyxNQUFlLENBQUM7UUFFN0IsNkJBQXdCLEdBQUcsQ0FBQyxLQUFLLElBQUksRUFBRTtZQUNyQyx3RkFBd0Y7WUFDeEYsMkZBQTJGO1lBQzNGLHlGQUF5RjtZQUN6RiwyRkFBMkY7WUFDM0YsaUdBQWlHO1lBQ2pHLElBQUksSUFBSSxDQUFDLFlBQVksS0FBSyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUM5RixPQUFPLENBQUMsQ0FBQyxNQUFNLHVCQUF1QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUNqRixDQUFDO1lBQ0QsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDLENBQUMsRUFBRSxDQUFDO1FBRUwsK0JBQTBCLEdBQTJCLENBQUMsS0FBSyxJQUFJLEVBQUU7WUFDL0QsMkZBQTJGO1lBQzNGLHFGQUFxRjtZQUNyRixzRkFBc0Y7WUFDdEYsbUVBQW1FO1lBQ25FLG9GQUFvRjtZQUNwRixJQUFJLElBQUksQ0FBQyxZQUFZLEtBQUssSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFLENBQUM7Z0JBQ3BGLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO1lBQ3BDLENBQUM7WUFDRCxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDO1FBQ25DLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFPUCxDQUFDO0lBTEMsTUFBTSxDQUFVLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBNEI7UUFDekQseUVBQXlFO1FBQ3pFLDBFQUEwRTtRQUMxRSxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XG5pbXBvcnQge0FjdGl2ZVJlbGVhc2VUcmFpbnN9IGZyb20gJy4uLy4uL3ZlcnNpb25pbmcvYWN0aXZlLXJlbGVhc2UtdHJhaW5zLmpzJztcbmltcG9ydCB7aXNWZXJzaW9uUHVibGlzaGVkVG9OcG19IGZyb20gJy4uLy4uL3ZlcnNpb25pbmcvbnBtLXJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7aXNGaXJzdE5leHRQcmVyZWxlYXNlfSBmcm9tICcuLi8uLi92ZXJzaW9uaW5nL3ByZXJlbGVhc2UtdmVyc2lvbi5qcyc7XG5pbXBvcnQge0N1dFByZXJlbGVhc2VCYXNlQWN0aW9ufSBmcm9tICcuL3NoYXJlZC9jdXQtcHJlcmVsZWFzZS5qcyc7XG5cbi8qKlxuICogUmVsZWFzZSBhY3Rpb24gdGhhdCBhbGxvd3MgTlBNIGBAbmV4dGAgcHJlLXJlbGVhc2VzLiBUaGUgYWN0aW9uIHdpbGxcbiAqIGFsd2F5cyBiZSBhY3RpdmUgYW5kIG9wZXJhdGUgb24gdGhlIGFuIG9uZ29pbmcgRkYvUkMgdHJhaW4sIG9yIHRoZVxuICogbmV4dCByZWxlYXNlLXRyYWluLlxuICpcbiAqIFRoZSBhY3Rpb24gd2lsbCBidW1wIHRoZSBwcmUtcmVsZWFzZSB2ZXJzaW9uIHRvIHRoZSBuZXh0IGluY3JlbWVudFxuICogYW5kIHB1Ymxpc2ggaXQgdG8gTlBNIGFsb25nIHdpdGggdGhlIGBAbnBtYCBkaXN0IHRhZy5cbiAqL1xuZXhwb3J0IGNsYXNzIEN1dE5wbU5leHRQcmVyZWxlYXNlQWN0aW9uIGV4dGVuZHMgQ3V0UHJlcmVsZWFzZUJhc2VBY3Rpb24ge1xuICByZWxlYXNlVHJhaW4gPSB0aGlzLmFjdGl2ZS5yZWxlYXNlQ2FuZGlkYXRlID8/IHRoaXMuYWN0aXZlLm5leHQ7XG4gIG5wbURpc3RUYWcgPSAnbmV4dCcgYXMgY29uc3Q7XG5cbiAgc2hvdWxkVXNlRXhpc3RpbmdWZXJzaW9uID0gKGFzeW5jICgpID0+IHtcbiAgICAvLyBTcGVjaWFsLWNhc2Ugd2hlcmUgdGhlIHZlcnNpb24gaW4gdGhlIGBuZXh0YCByZWxlYXNlLXRyYWluIGlzIG5vdCBwdWJsaXNoZWQgeWV0LiBUaGlzXG4gICAgLy8gaGFwcGVucyB3aGVuIHdlIHJlY2VudGx5IGJyYW5jaGVkIG9mZiBmb3IgZmVhdHVyZS1mcmVlemUuIFdlIGFscmVhZHkgYnVtcCB0aGUgdmVyc2lvbiB0b1xuICAgIC8vIHRoZSBuZXh0IG1pbm9yIG9yIG1ham9yLCBidXQgZG8gbm90IHB1Ymxpc2ggaW1tZWRpYXRlbHkuIEN1dHRpbmcgYSByZWxlYXNlIGltbWVkaWF0ZWx5XG4gICAgLy8gd291bGQgYmUgbm90IGhlbHBmdWwgYXMgdGhlcmUgYXJlIG5vIG90aGVyIGNoYW5nZXMgdGhhbiBpbiB0aGUgZmVhdHVyZS1mcmVlemUgYnJhbmNoLiBJZlxuICAgIC8vIHdlIGhhcHBlbiB0byBkZXRlY3QgdGhpcyBjYXNlLCB3ZSBzdGFnZSB0aGUgcmVsZWFzZSBhcyB1c3VhbCBidXQgZG8gbm90IGluY3JlbWVudCB0aGUgdmVyc2lvbi5cbiAgICBpZiAodGhpcy5yZWxlYXNlVHJhaW4gPT09IHRoaXMuYWN0aXZlLm5leHQgJiYgaXNGaXJzdE5leHRQcmVyZWxlYXNlKHRoaXMuYWN0aXZlLm5leHQudmVyc2lvbikpIHtcbiAgICAgIHJldHVybiAhKGF3YWl0IGlzVmVyc2lvblB1Ymxpc2hlZFRvTnBtKHRoaXMuYWN0aXZlLm5leHQudmVyc2lvbiwgdGhpcy5jb25maWcpKTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9KSgpO1xuXG4gIHJlbGVhc2VOb3Rlc0NvbXBhcmVWZXJzaW9uOiBQcm9taXNlPHNlbXZlci5TZW1WZXI+ID0gKGFzeW5jICgpID0+IHtcbiAgICAvLyBJZiB3ZSBoYXBwZW4gdG8gZGV0ZWN0IHRoZSBjYXNlIGZyb20gYWJvdmUsIHdlIHVzZSB0aGUgbW9zdCByZWNlbnQgcGF0Y2ggdmVyc2lvbiBhcyBiYXNlXG4gICAgLy8gZm9yIGJ1aWxkaW5nIHJlbGVhc2Ugbm90ZXMuIFRoaXMgaXMgYmV0dGVyIHRoYW4gZmluZGluZyB0aGUgXCJuZXh0XCIgdmVyc2lvbiB3aGVuIHdlXG4gICAgLy8gYnJhbmNoZWQgb2ZmIGFzIGl0IGFsc28gcHJldmVudHMgdXMgZnJvbSBkdXBsaWNhdGluZyBtYW55IGNvbW1pdHMgdGhhdCBoYXZlIGFscmVhZHlcbiAgICAvLyBsYW5kZWQgaW4gdGhlIG5ldyBwYXRjaCB0aGF0IHdhcyB3b3JrZWQgb24gd2hlbiB3ZSBicmFuY2hlZCBvZmYuXG4gICAgLy8gRm9yIG1vcmUgZGV0YWlscyBzZWUgdGhlIHJlbGVhc2Ugbm90ZXMgZ2VuZXJhdGlvbiBhbmQgY29tbWl0IHJhbmdlIGRldGVybWluYXRpb24uXG4gICAgaWYgKHRoaXMucmVsZWFzZVRyYWluID09PSB0aGlzLmFjdGl2ZS5uZXh0ICYmIChhd2FpdCB0aGlzLnNob3VsZFVzZUV4aXN0aW5nVmVyc2lvbikpIHtcbiAgICAgIHJldHVybiB0aGlzLmFjdGl2ZS5sYXRlc3QudmVyc2lvbjtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucmVsZWFzZVRyYWluLnZlcnNpb247XG4gIH0pKCk7XG5cbiAgc3RhdGljIG92ZXJyaWRlIGFzeW5jIGlzQWN0aXZlKF9hY3RpdmU6IEFjdGl2ZVJlbGVhc2VUcmFpbnMpIHtcbiAgICAvLyBQcmUtcmVsZWFzZXMgZm9yIHRoZSBgbmV4dGAgTlBNIGRpc3QgdGFnIGNhbiBhbHdheXMgYmUgY3V0LiBBIE5QTSBuZXh0XG4gICAgLy8gcmVsZWFzZSBjb3VsZCBhbHdheXMgZWl0aGVyIG9jY3VyIGZvciBhbiBpbi1wcm9ncmVzcyBGRi9SQ20sIG9yIGBuZXh0YC5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuIl19