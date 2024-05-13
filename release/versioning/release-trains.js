/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/** Class describing a release-train. */
export class ReleaseTrain {
    constructor(
    /** Name of the branch for this release-train. */
    branchName, 
    /** Most recent version for this release train. */
    version) {
        this.branchName = branchName;
        this.version = version;
        /** Whether the release train is currently targeting a major. */
        this.isMajor = this.version.minor === 0 && this.version.patch === 0;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVsZWFzZS10cmFpbnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvcmVsZWFzZS92ZXJzaW9uaW5nL3JlbGVhc2UtdHJhaW5zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILHdDQUF3QztBQUN4QyxNQUFNLE9BQU8sWUFBWTtJQUl2QjtJQUNFLGlEQUFpRDtJQUMxQyxVQUFrQjtJQUN6QixrREFBa0Q7SUFDM0MsT0FBc0I7UUFGdEIsZUFBVSxHQUFWLFVBQVUsQ0FBUTtRQUVsQixZQUFPLEdBQVAsT0FBTyxDQUFlO1FBUC9CLGdFQUFnRTtRQUNoRSxZQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxLQUFLLENBQUMsQ0FBQztJQU81RCxDQUFDO0NBQ0wiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xuXG4vKiogQ2xhc3MgZGVzY3JpYmluZyBhIHJlbGVhc2UtdHJhaW4uICovXG5leHBvcnQgY2xhc3MgUmVsZWFzZVRyYWluIHtcbiAgLyoqIFdoZXRoZXIgdGhlIHJlbGVhc2UgdHJhaW4gaXMgY3VycmVudGx5IHRhcmdldGluZyBhIG1ham9yLiAqL1xuICBpc01ham9yID0gdGhpcy52ZXJzaW9uLm1pbm9yID09PSAwICYmIHRoaXMudmVyc2lvbi5wYXRjaCA9PT0gMDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAvKiogTmFtZSBvZiB0aGUgYnJhbmNoIGZvciB0aGlzIHJlbGVhc2UtdHJhaW4uICovXG4gICAgcHVibGljIGJyYW5jaE5hbWU6IHN0cmluZyxcbiAgICAvKiogTW9zdCByZWNlbnQgdmVyc2lvbiBmb3IgdGhpcyByZWxlYXNlIHRyYWluLiAqL1xuICAgIHB1YmxpYyB2ZXJzaW9uOiBzZW12ZXIuU2VtVmVyLFxuICApIHt9XG59XG4iXX0=