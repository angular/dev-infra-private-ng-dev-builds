/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ChildProcess } from './child-process.js';
/** Determines the repository base directory from the current working directory. */
export function determineRepoBaseDirFromCwd() {
    const { stdout, stderr, status } = ChildProcess.spawnSync('git', ['rev-parse --show-toplevel']);
    if (status !== 0) {
        throw Error(`Unable to find the path to the base directory of the repository.\n` +
            `Was the command run from inside of the repo?\n\n` +
            `${stderr}`);
    }
    return stdout.trim();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwby1kaXJlY3RvcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9uZy1kZXYvdXRpbHMvcmVwby1kaXJlY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLG9CQUFvQixDQUFDO0FBRWhELG1GQUFtRjtBQUNuRixNQUFNLFVBQVUsMkJBQTJCO0lBQ3pDLE1BQU0sRUFBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBQyxHQUFHLFlBQVksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxDQUFDO0lBQzlGLElBQUksTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ2pCLE1BQU0sS0FBSyxDQUNULG9FQUFvRTtZQUNsRSxrREFBa0Q7WUFDbEQsR0FBRyxNQUFNLEVBQUUsQ0FDZCxDQUFDO0lBQ0osQ0FBQztJQUNELE9BQU8sTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ3ZCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtDaGlsZFByb2Nlc3N9IGZyb20gJy4vY2hpbGQtcHJvY2Vzcy5qcyc7XG5cbi8qKiBEZXRlcm1pbmVzIHRoZSByZXBvc2l0b3J5IGJhc2UgZGlyZWN0b3J5IGZyb20gdGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3RvcnkuICovXG5leHBvcnQgZnVuY3Rpb24gZGV0ZXJtaW5lUmVwb0Jhc2VEaXJGcm9tQ3dkKCkge1xuICBjb25zdCB7c3Rkb3V0LCBzdGRlcnIsIHN0YXR1c30gPSBDaGlsZFByb2Nlc3Muc3Bhd25TeW5jKCdnaXQnLCBbJ3Jldi1wYXJzZSAtLXNob3ctdG9wbGV2ZWwnXSk7XG4gIGlmIChzdGF0dXMgIT09IDApIHtcbiAgICB0aHJvdyBFcnJvcihcbiAgICAgIGBVbmFibGUgdG8gZmluZCB0aGUgcGF0aCB0byB0aGUgYmFzZSBkaXJlY3Rvcnkgb2YgdGhlIHJlcG9zaXRvcnkuXFxuYCArXG4gICAgICAgIGBXYXMgdGhlIGNvbW1hbmQgcnVuIGZyb20gaW5zaWRlIG9mIHRoZSByZXBvP1xcblxcbmAgK1xuICAgICAgICBgJHtzdGRlcnJ9YCxcbiAgICApO1xuICB9XG4gIHJldHVybiBzdGRvdXQudHJpbSgpO1xufVxuIl19