/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { join } from 'path';
import { determineRepoBaseDirFromCwd } from './repo-directory.js';
let BAZEL_BIN = undefined;
export function getBazelBin() {
    if (BAZEL_BIN === undefined) {
        BAZEL_BIN = process.env.BAZEL || join(determineRepoBaseDirFromCwd(), 'node_modules/.bin/bazel');
    }
    return BAZEL_BIN;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF6ZWwtYmluLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbmctZGV2L3V0aWxzL2JhemVsLWJpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsSUFBSSxFQUFDLE1BQU0sTUFBTSxDQUFDO0FBQzFCLE9BQU8sRUFBQywyQkFBMkIsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBRWhFLElBQUksU0FBUyxHQUF1QixTQUFTLENBQUM7QUFFOUMsTUFBTSxVQUFVLFdBQVc7SUFDekIsSUFBSSxTQUFTLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDNUIsU0FBUyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQywyQkFBMkIsRUFBRSxFQUFFLHlCQUF5QixDQUFDLENBQUM7SUFDbEcsQ0FBQztJQUVELE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtqb2lufSBmcm9tICdwYXRoJztcbmltcG9ydCB7ZGV0ZXJtaW5lUmVwb0Jhc2VEaXJGcm9tQ3dkfSBmcm9tICcuL3JlcG8tZGlyZWN0b3J5LmpzJztcblxubGV0IEJBWkVMX0JJTjogdW5kZWZpbmVkIHwgc3RyaW5nID0gdW5kZWZpbmVkO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QmF6ZWxCaW4oKSB7XG4gIGlmIChCQVpFTF9CSU4gPT09IHVuZGVmaW5lZCkge1xuICAgIEJBWkVMX0JJTiA9IHByb2Nlc3MuZW52LkJBWkVMIHx8IGpvaW4oZGV0ZXJtaW5lUmVwb0Jhc2VEaXJGcm9tQ3dkKCksICdub2RlX21vZHVsZXMvLmJpbi9iYXplbCcpO1xuICB9XG5cbiAgcmV0dXJuIEJBWkVMX0JJTjtcbn1cbiJdfQ==