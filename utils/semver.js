/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import semver from 'semver';
/**
 * Increments a specified SemVer version. Compared to the original increment in SemVer,
 * the version is cloned to not modify the original version instance.
 */
export function semverInc(version, release, identifier) {
    const clone = new semver.SemVer(version.version);
    return clone.inc(release, identifier);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VtdmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbmctZGV2L3V0aWxzL3NlbXZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFFNUI7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLFNBQVMsQ0FDdkIsT0FBc0IsRUFDdEIsT0FBMkIsRUFDM0IsVUFBbUI7SUFFbkIsTUFBTSxLQUFLLEdBQUcsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNqRCxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ3hDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xuXG4vKipcbiAqIEluY3JlbWVudHMgYSBzcGVjaWZpZWQgU2VtVmVyIHZlcnNpb24uIENvbXBhcmVkIHRvIHRoZSBvcmlnaW5hbCBpbmNyZW1lbnQgaW4gU2VtVmVyLFxuICogdGhlIHZlcnNpb24gaXMgY2xvbmVkIHRvIG5vdCBtb2RpZnkgdGhlIG9yaWdpbmFsIHZlcnNpb24gaW5zdGFuY2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZW12ZXJJbmMoXG4gIHZlcnNpb246IHNlbXZlci5TZW1WZXIsXG4gIHJlbGVhc2U6IHNlbXZlci5SZWxlYXNlVHlwZSxcbiAgaWRlbnRpZmllcj86IHN0cmluZyxcbikge1xuICBjb25zdCBjbG9uZSA9IG5ldyBzZW12ZXIuU2VtVmVyKHZlcnNpb24udmVyc2lvbik7XG4gIHJldHVybiBjbG9uZS5pbmMocmVsZWFzZSwgaWRlbnRpZmllcik7XG59XG4iXX0=