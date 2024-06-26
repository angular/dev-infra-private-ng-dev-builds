/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Minimatch } from 'minimatch';
/** Map that holds patterns and their corresponding Minimatch globs. */
const patternCache = new Map();
/**
 * Gets a glob for the given pattern. The cached glob will be returned
 * if available. Otherwise a new glob will be created and cached.
 */
export function getOrCreateGlob(pattern) {
    if (patternCache.has(pattern)) {
        return patternCache.get(pattern);
    }
    const glob = new Minimatch(pattern, { dot: false, nobrace: false });
    patternCache.set(pattern, glob);
    return glob;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHVsbGFwcHJvdmUvdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBQ0gsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLFdBQVcsQ0FBQztBQUVwQyx1RUFBdUU7QUFDdkUsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQXFCLENBQUM7QUFFbEQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLGVBQWUsQ0FBQyxPQUFlO0lBQzdDLElBQUksWUFBWSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQzlCLE9BQU8sWUFBWSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUUsQ0FBQztJQUNwQyxDQUFDO0lBQ0QsTUFBTSxJQUFJLEdBQUcsSUFBSSxTQUFTLENBQUMsT0FBTyxFQUFFLEVBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFDLENBQUMsQ0FBQztJQUNsRSxZQUFZLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNoQyxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7TWluaW1hdGNofSBmcm9tICdtaW5pbWF0Y2gnO1xuXG4vKiogTWFwIHRoYXQgaG9sZHMgcGF0dGVybnMgYW5kIHRoZWlyIGNvcnJlc3BvbmRpbmcgTWluaW1hdGNoIGdsb2JzLiAqL1xuY29uc3QgcGF0dGVybkNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIE1pbmltYXRjaD4oKTtcblxuLyoqXG4gKiBHZXRzIGEgZ2xvYiBmb3IgdGhlIGdpdmVuIHBhdHRlcm4uIFRoZSBjYWNoZWQgZ2xvYiB3aWxsIGJlIHJldHVybmVkXG4gKiBpZiBhdmFpbGFibGUuIE90aGVyd2lzZSBhIG5ldyBnbG9iIHdpbGwgYmUgY3JlYXRlZCBhbmQgY2FjaGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0T3JDcmVhdGVHbG9iKHBhdHRlcm46IHN0cmluZykge1xuICBpZiAocGF0dGVybkNhY2hlLmhhcyhwYXR0ZXJuKSkge1xuICAgIHJldHVybiBwYXR0ZXJuQ2FjaGUuZ2V0KHBhdHRlcm4pITtcbiAgfVxuICBjb25zdCBnbG9iID0gbmV3IE1pbmltYXRjaChwYXR0ZXJuLCB7ZG90OiBmYWxzZSwgbm9icmFjZTogZmFsc2V9KTtcbiAgcGF0dGVybkNhY2hlLnNldChwYXR0ZXJuLCBnbG9iKTtcbiAgcmV0dXJuIGdsb2I7XG59XG4iXX0=