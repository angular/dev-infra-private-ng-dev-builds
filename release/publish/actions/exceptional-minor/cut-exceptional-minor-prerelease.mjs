/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { isVersionPublishedToNpm } from '../../../versioning/npm-registry.js';
import { isFirstNextPrerelease } from '../../../versioning/prerelease-version.js';
import { CutPrereleaseBaseAction } from '../shared/cut-prerelease.js';
/**
 * Release action that allows for `-next` pre-releases of an in-progress
 * exceptional minor. The action is active when there is an exceptional minor.
 *
 * The action will bump the pre-release version to the next increment
 * and publish it to NPM. Note that it would not be tagged on NPM as `@next`.
 */
export class CutExceptionalMinorPrereleaseAction extends CutPrereleaseBaseAction {
    constructor() {
        super(...arguments);
        this.releaseTrain = this.active.exceptionalMinor;
        // An exceptional minor will never be released as `@next`. The NPM next dist tag
        // will be reserved for the normal FF/RC or `next` release trains. Specifically
        // we cannot override the `@next` NPM dist tag when it already points to a more
        // recent major. This would most commonly be the case, and in the other edge-case
        // of where no NPM next release has occurred yet- arguably an exceptional minor
        // should not prevent actual pre-releases for an on-going FF/RC or the next branch.
        // Note that NPM always requires a dist-tag, so we explicitly have one dedicated
        // for exceptional minors. This tag could be deleted in the future.
        this.npmDistTag = 'do-not-use-exceptional-minor';
        this.shouldUseExistingVersion = (async () => {
            // If an exceptional minor branch has just been created, the actual version
            // will not be published directly. To account for this case, based on if the
            // version is already published or not, the version is NOT incremented.
            return (isFirstNextPrerelease(this.releaseTrain.version) &&
                !(await isVersionPublishedToNpm(this.releaseTrain.version, this.config)));
        })();
        this.releaseNotesCompareVersion = (async () => {
            if (await this.shouldUseExistingVersion) {
                return this.active.latest.version;
            }
            return this.releaseTrain.version;
        })();
    }
    async getDescription() {
        // Make it more obvious that this action is for an exceptional minor.
        return `Exceptional Minor: ${await super.getDescription()}`;
    }
    static async isActive(active) {
        return active.exceptionalMinor !== null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3V0LWV4Y2VwdGlvbmFsLW1pbm9yLXByZXJlbGVhc2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9wdWJsaXNoL2FjdGlvbnMvZXhjZXB0aW9uYWwtbWlub3IvY3V0LWV4Y2VwdGlvbmFsLW1pbm9yLXByZXJlbGVhc2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBSUgsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0scUNBQXFDLENBQUM7QUFDNUUsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0sMkNBQTJDLENBQUM7QUFDaEYsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFFcEU7Ozs7OztHQU1HO0FBQ0gsTUFBTSxPQUFPLG1DQUFvQyxTQUFRLHVCQUF1QjtJQUFoRjs7UUFDRSxpQkFBWSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWlCLENBQUM7UUFFN0MsZ0ZBQWdGO1FBQ2hGLCtFQUErRTtRQUMvRSwrRUFBK0U7UUFDL0UsaUZBQWlGO1FBQ2pGLCtFQUErRTtRQUMvRSxtRkFBbUY7UUFDbkYsZ0ZBQWdGO1FBQ2hGLG1FQUFtRTtRQUNuRSxlQUFVLEdBQUcsOEJBQXVDLENBQUM7UUFFckQsNkJBQXdCLEdBQUcsQ0FBQyxLQUFLLElBQUksRUFBRTtZQUNyQywyRUFBMkU7WUFDM0UsNEVBQTRFO1lBQzVFLHVFQUF1RTtZQUN2RSxPQUFPLENBQ0wscUJBQXFCLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUM7Z0JBQ2hELENBQUMsQ0FBQyxNQUFNLHVCQUF1QixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUN6RSxDQUFDO1FBQ0osQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUVMLCtCQUEwQixHQUEyQixDQUFDLEtBQUssSUFBSSxFQUFFO1lBQy9ELElBQUksTUFBTSxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztnQkFDeEMsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7WUFDcEMsQ0FBQztZQUNELE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUM7UUFDbkMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQVVQLENBQUM7SUFSVSxLQUFLLENBQUMsY0FBYztRQUMzQixxRUFBcUU7UUFDckUsT0FBTyxzQkFBc0IsTUFBTSxLQUFLLENBQUMsY0FBYyxFQUFFLEVBQUUsQ0FBQztJQUM5RCxDQUFDO0lBRUQsTUFBTSxDQUFVLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBMkI7UUFDeEQsT0FBTyxNQUFNLENBQUMsZ0JBQWdCLEtBQUssSUFBSSxDQUFDO0lBQzFDLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XG5pbXBvcnQge0FjdGl2ZVJlbGVhc2VUcmFpbnN9IGZyb20gJy4uLy4uLy4uL3ZlcnNpb25pbmcvYWN0aXZlLXJlbGVhc2UtdHJhaW5zLmpzJztcbmltcG9ydCB7aXNWZXJzaW9uUHVibGlzaGVkVG9OcG19IGZyb20gJy4uLy4uLy4uL3ZlcnNpb25pbmcvbnBtLXJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7aXNGaXJzdE5leHRQcmVyZWxlYXNlfSBmcm9tICcuLi8uLi8uLi92ZXJzaW9uaW5nL3ByZXJlbGVhc2UtdmVyc2lvbi5qcyc7XG5pbXBvcnQge0N1dFByZXJlbGVhc2VCYXNlQWN0aW9ufSBmcm9tICcuLi9zaGFyZWQvY3V0LXByZXJlbGVhc2UuanMnO1xuXG4vKipcbiAqIFJlbGVhc2UgYWN0aW9uIHRoYXQgYWxsb3dzIGZvciBgLW5leHRgIHByZS1yZWxlYXNlcyBvZiBhbiBpbi1wcm9ncmVzc1xuICogZXhjZXB0aW9uYWwgbWlub3IuIFRoZSBhY3Rpb24gaXMgYWN0aXZlIHdoZW4gdGhlcmUgaXMgYW4gZXhjZXB0aW9uYWwgbWlub3IuXG4gKlxuICogVGhlIGFjdGlvbiB3aWxsIGJ1bXAgdGhlIHByZS1yZWxlYXNlIHZlcnNpb24gdG8gdGhlIG5leHQgaW5jcmVtZW50XG4gKiBhbmQgcHVibGlzaCBpdCB0byBOUE0uIE5vdGUgdGhhdCBpdCB3b3VsZCBub3QgYmUgdGFnZ2VkIG9uIE5QTSBhcyBgQG5leHRgLlxuICovXG5leHBvcnQgY2xhc3MgQ3V0RXhjZXB0aW9uYWxNaW5vclByZXJlbGVhc2VBY3Rpb24gZXh0ZW5kcyBDdXRQcmVyZWxlYXNlQmFzZUFjdGlvbiB7XG4gIHJlbGVhc2VUcmFpbiA9IHRoaXMuYWN0aXZlLmV4Y2VwdGlvbmFsTWlub3IhO1xuXG4gIC8vIEFuIGV4Y2VwdGlvbmFsIG1pbm9yIHdpbGwgbmV2ZXIgYmUgcmVsZWFzZWQgYXMgYEBuZXh0YC4gVGhlIE5QTSBuZXh0IGRpc3QgdGFnXG4gIC8vIHdpbGwgYmUgcmVzZXJ2ZWQgZm9yIHRoZSBub3JtYWwgRkYvUkMgb3IgYG5leHRgIHJlbGVhc2UgdHJhaW5zLiBTcGVjaWZpY2FsbHlcbiAgLy8gd2UgY2Fubm90IG92ZXJyaWRlIHRoZSBgQG5leHRgIE5QTSBkaXN0IHRhZyB3aGVuIGl0IGFscmVhZHkgcG9pbnRzIHRvIGEgbW9yZVxuICAvLyByZWNlbnQgbWFqb3IuIFRoaXMgd291bGQgbW9zdCBjb21tb25seSBiZSB0aGUgY2FzZSwgYW5kIGluIHRoZSBvdGhlciBlZGdlLWNhc2VcbiAgLy8gb2Ygd2hlcmUgbm8gTlBNIG5leHQgcmVsZWFzZSBoYXMgb2NjdXJyZWQgeWV0LSBhcmd1YWJseSBhbiBleGNlcHRpb25hbCBtaW5vclxuICAvLyBzaG91bGQgbm90IHByZXZlbnQgYWN0dWFsIHByZS1yZWxlYXNlcyBmb3IgYW4gb24tZ29pbmcgRkYvUkMgb3IgdGhlIG5leHQgYnJhbmNoLlxuICAvLyBOb3RlIHRoYXQgTlBNIGFsd2F5cyByZXF1aXJlcyBhIGRpc3QtdGFnLCBzbyB3ZSBleHBsaWNpdGx5IGhhdmUgb25lIGRlZGljYXRlZFxuICAvLyBmb3IgZXhjZXB0aW9uYWwgbWlub3JzLiBUaGlzIHRhZyBjb3VsZCBiZSBkZWxldGVkIGluIHRoZSBmdXR1cmUuXG4gIG5wbURpc3RUYWcgPSAnZG8tbm90LXVzZS1leGNlcHRpb25hbC1taW5vcicgYXMgY29uc3Q7XG5cbiAgc2hvdWxkVXNlRXhpc3RpbmdWZXJzaW9uID0gKGFzeW5jICgpID0+IHtcbiAgICAvLyBJZiBhbiBleGNlcHRpb25hbCBtaW5vciBicmFuY2ggaGFzIGp1c3QgYmVlbiBjcmVhdGVkLCB0aGUgYWN0dWFsIHZlcnNpb25cbiAgICAvLyB3aWxsIG5vdCBiZSBwdWJsaXNoZWQgZGlyZWN0bHkuIFRvIGFjY291bnQgZm9yIHRoaXMgY2FzZSwgYmFzZWQgb24gaWYgdGhlXG4gICAgLy8gdmVyc2lvbiBpcyBhbHJlYWR5IHB1Ymxpc2hlZCBvciBub3QsIHRoZSB2ZXJzaW9uIGlzIE5PVCBpbmNyZW1lbnRlZC5cbiAgICByZXR1cm4gKFxuICAgICAgaXNGaXJzdE5leHRQcmVyZWxlYXNlKHRoaXMucmVsZWFzZVRyYWluLnZlcnNpb24pICYmXG4gICAgICAhKGF3YWl0IGlzVmVyc2lvblB1Ymxpc2hlZFRvTnBtKHRoaXMucmVsZWFzZVRyYWluLnZlcnNpb24sIHRoaXMuY29uZmlnKSlcbiAgICApO1xuICB9KSgpO1xuXG4gIHJlbGVhc2VOb3Rlc0NvbXBhcmVWZXJzaW9uOiBQcm9taXNlPHNlbXZlci5TZW1WZXI+ID0gKGFzeW5jICgpID0+IHtcbiAgICBpZiAoYXdhaXQgdGhpcy5zaG91bGRVc2VFeGlzdGluZ1ZlcnNpb24pIHtcbiAgICAgIHJldHVybiB0aGlzLmFjdGl2ZS5sYXRlc3QudmVyc2lvbjtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucmVsZWFzZVRyYWluLnZlcnNpb247XG4gIH0pKCk7XG5cbiAgb3ZlcnJpZGUgYXN5bmMgZ2V0RGVzY3JpcHRpb24oKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAvLyBNYWtlIGl0IG1vcmUgb2J2aW91cyB0aGF0IHRoaXMgYWN0aW9uIGlzIGZvciBhbiBleGNlcHRpb25hbCBtaW5vci5cbiAgICByZXR1cm4gYEV4Y2VwdGlvbmFsIE1pbm9yOiAke2F3YWl0IHN1cGVyLmdldERlc2NyaXB0aW9uKCl9YDtcbiAgfVxuXG4gIHN0YXRpYyBvdmVycmlkZSBhc3luYyBpc0FjdGl2ZShhY3RpdmU6IEFjdGl2ZVJlbGVhc2VUcmFpbnMpIHtcbiAgICByZXR1cm4gYWN0aXZlLmV4Y2VwdGlvbmFsTWlub3IgIT09IG51bGw7XG4gIH1cbn1cbiJdfQ==