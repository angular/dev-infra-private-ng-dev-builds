/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BranchOffNextBranchBaseAction } from './shared/branch-off-next-branch.js';
/**
 * Release action that moves the next release-train into the release-candidate phase. This means
 * that a new version branch is created from the next branch, and the first release candidate
 * version is cut indicating the new phase.
 */
export class MoveNextIntoReleaseCandidateAction extends BranchOffNextBranchBaseAction {
    constructor() {
        super(...arguments);
        this.newPhaseName = 'release-candidate';
    }
    static async isActive(active) {
        // Directly switching a next release-train into the `release-candidate`
        // phase is only allowed for minor releases. Major version always need to
        // go through the `feature-freeze` phase.
        return active.releaseCandidate === null && !active.next.isMajor;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW92ZS1uZXh0LWludG8tcmVsZWFzZS1jYW5kaWRhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS9wdWJsaXNoL2FjdGlvbnMvbW92ZS1uZXh0LWludG8tcmVsZWFzZS1jYW5kaWRhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBSUgsT0FBTyxFQUFDLDZCQUE2QixFQUFDLE1BQU0sb0NBQW9DLENBQUM7QUFFakY7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyxrQ0FBbUMsU0FBUSw2QkFBNkI7SUFBckY7O1FBQ1csaUJBQVksR0FBRyxtQkFBNEIsQ0FBQztJQVF2RCxDQUFDO0lBTkMsTUFBTSxDQUFVLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBMkI7UUFDeEQsdUVBQXVFO1FBQ3ZFLHlFQUF5RTtRQUN6RSx5Q0FBeUM7UUFDekMsT0FBTyxNQUFNLENBQUMsZ0JBQWdCLEtBQUssSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDbEUsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QWN0aXZlUmVsZWFzZVRyYWluc30gZnJvbSAnLi4vLi4vdmVyc2lvbmluZy9pbmRleC5qcyc7XG5cbmltcG9ydCB7QnJhbmNoT2ZmTmV4dEJyYW5jaEJhc2VBY3Rpb259IGZyb20gJy4vc2hhcmVkL2JyYW5jaC1vZmYtbmV4dC1icmFuY2guanMnO1xuXG4vKipcbiAqIFJlbGVhc2UgYWN0aW9uIHRoYXQgbW92ZXMgdGhlIG5leHQgcmVsZWFzZS10cmFpbiBpbnRvIHRoZSByZWxlYXNlLWNhbmRpZGF0ZSBwaGFzZS4gVGhpcyBtZWFuc1xuICogdGhhdCBhIG5ldyB2ZXJzaW9uIGJyYW5jaCBpcyBjcmVhdGVkIGZyb20gdGhlIG5leHQgYnJhbmNoLCBhbmQgdGhlIGZpcnN0IHJlbGVhc2UgY2FuZGlkYXRlXG4gKiB2ZXJzaW9uIGlzIGN1dCBpbmRpY2F0aW5nIHRoZSBuZXcgcGhhc2UuXG4gKi9cbmV4cG9ydCBjbGFzcyBNb3ZlTmV4dEludG9SZWxlYXNlQ2FuZGlkYXRlQWN0aW9uIGV4dGVuZHMgQnJhbmNoT2ZmTmV4dEJyYW5jaEJhc2VBY3Rpb24ge1xuICBvdmVycmlkZSBuZXdQaGFzZU5hbWUgPSAncmVsZWFzZS1jYW5kaWRhdGUnIGFzIGNvbnN0O1xuXG4gIHN0YXRpYyBvdmVycmlkZSBhc3luYyBpc0FjdGl2ZShhY3RpdmU6IEFjdGl2ZVJlbGVhc2VUcmFpbnMpIHtcbiAgICAvLyBEaXJlY3RseSBzd2l0Y2hpbmcgYSBuZXh0IHJlbGVhc2UtdHJhaW4gaW50byB0aGUgYHJlbGVhc2UtY2FuZGlkYXRlYFxuICAgIC8vIHBoYXNlIGlzIG9ubHkgYWxsb3dlZCBmb3IgbWlub3IgcmVsZWFzZXMuIE1ham9yIHZlcnNpb24gYWx3YXlzIG5lZWQgdG9cbiAgICAvLyBnbyB0aHJvdWdoIHRoZSBgZmVhdHVyZS1mcmVlemVgIHBoYXNlLlxuICAgIHJldHVybiBhY3RpdmUucmVsZWFzZUNhbmRpZGF0ZSA9PT0gbnVsbCAmJiAhYWN0aXZlLm5leHQuaXNNYWpvcjtcbiAgfVxufVxuIl19