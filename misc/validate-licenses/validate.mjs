/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import licenseChecker from 'license-checker';
import spdx from 'spdx-satisfies';
// A general note on some disallowed licenses:
// - CC0
//    This is not a valid license. It does not grant copyright of the code/asset, and does not
//    resolve patents or other licensed work. The different claims also have no standing in court
//    and do not provide protection to or from Google and/or third parties.
//    We cannot use nor contribute to CC0 licenses.
// - Public Domain
//    Same as CC0, it is not a valid license.
/** List of established allowed licenses for depdenencies. */
const allowedLicenses = [
    // Notice licenses
    'MIT',
    'ISC',
    'Apache-2.0',
    'Python-2.0',
    'Artistic-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'BSD-4-Clause',
    'Zlib',
    'AFL-2.1',
    'CC-BY-3.0',
    'CC-BY-4.0',
    // Unencumbered
    'Unlicense',
    'CC0-1.0',
    '0BSD',
];
/** Known name variations of SPDX licenses. */
const licenseReplacements = new Map([
    // Just a longer string that our script catches. SPDX official name is the shorter one.
    ['Apache License, Version 2.0', 'Apache-2.0'],
    ['Apache2', 'Apache-2.0'],
    ['Apache 2.0', 'Apache-2.0'],
    ['Apache v2', 'Apache-2.0'],
    // Alternate syntax
    ['AFLv2.1', 'AFL-2.1'],
    // BSD is BSD-2-clause by default.
    ['BSD', 'BSD-2-Clause'],
]);
export async function checkAllLicenses(start) {
    return new Promise((resolve, reject) => {
        let maxPkgNameLength = 0;
        licenseChecker.init({ start }, (err, pkgInfoObject) => {
            // If the license processor fails, reject the process with the error.
            if (err) {
                console.log('thats an error');
                return reject(err);
            }
            // Check each package to ensure its license(s) are allowed.
            const packages = Object.entries(pkgInfoObject).map(([name, pkg]) => {
                maxPkgNameLength = Math.max(maxPkgNameLength, name.length);
                /**
                 * Array of licenses for the package.
                 *
                 * Note: Typically a package will only have one license, but support for multiple license
                 *       is necessary for full support.
                 */
                const licenses = Array.isArray(pkg.licenses) ? pkg.licenses : [pkg.licenses];
                return {
                    ...pkg,
                    name,
                    allowed: licenses.some(assertAllowedLicense),
                };
            });
            resolve({
                valid: packages.every((pkg) => pkg.allowed),
                packages,
                maxPkgNameLength,
            });
        });
    });
}
const allowedLicensesSpdxExpression = allowedLicenses.join(' OR ');
// Check if a license is accepted by an array of accepted licenses
function assertAllowedLicense(license) {
    // Licenses which are determined based on a file other than LICENSE are have an * appended.
    // See https://www.npmjs.com/package/license-checker#how-licenses-are-found
    const strippedLicense = license.endsWith('*') ? license.slice(0, -1) : license;
    try {
        // If the license is included in the known replacements, use the replacement instead.
        return spdx(licenseReplacements.get(strippedLicense) ?? strippedLicense, allowedLicensesSpdxExpression);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvbWlzYy92YWxpZGF0ZS1saWNlbnNlcy92YWxpZGF0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFDSCxPQUFPLGNBQXlDLE1BQU0saUJBQWlCLENBQUM7QUFDeEUsT0FBTyxJQUFJLE1BQU0sZ0JBQWdCLENBQUM7QUFFbEMsOENBQThDO0FBQzlDLFFBQVE7QUFDUiw4RkFBOEY7QUFDOUYsaUdBQWlHO0FBQ2pHLDJFQUEyRTtBQUMzRSxtREFBbUQ7QUFDbkQsa0JBQWtCO0FBQ2xCLDZDQUE2QztBQUU3Qyw2REFBNkQ7QUFDN0QsTUFBTSxlQUFlLEdBQUc7SUFDdEIsa0JBQWtCO0lBQ2xCLEtBQUs7SUFDTCxLQUFLO0lBQ0wsWUFBWTtJQUNaLFlBQVk7SUFDWixjQUFjO0lBQ2QsY0FBYztJQUNkLGNBQWM7SUFDZCxjQUFjO0lBQ2QsTUFBTTtJQUNOLFNBQVM7SUFDVCxXQUFXO0lBQ1gsV0FBVztJQUVYLGVBQWU7SUFDZixXQUFXO0lBQ1gsU0FBUztJQUNULE1BQU07Q0FDUCxDQUFDO0FBRUYsOENBQThDO0FBQzlDLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxHQUFHLENBQWlCO0lBQ2xELHVGQUF1RjtJQUN2RixDQUFDLDZCQUE2QixFQUFFLFlBQVksQ0FBQztJQUM3QyxDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUM7SUFDekIsQ0FBQyxZQUFZLEVBQUUsWUFBWSxDQUFDO0lBQzVCLENBQUMsV0FBVyxFQUFFLFlBQVksQ0FBQztJQUUzQixtQkFBbUI7SUFDbkIsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDO0lBRXRCLGtDQUFrQztJQUNsQyxDQUFDLEtBQUssRUFBRSxjQUFjLENBQUM7Q0FDeEIsQ0FBQyxDQUFDO0FBYUgsTUFBTSxDQUFDLEtBQUssVUFBVSxnQkFBZ0IsQ0FBQyxLQUFhO0lBQ2xELE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7UUFDckMsSUFBSSxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7UUFDekIsY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFDLEtBQUssRUFBQyxFQUFFLENBQUMsR0FBVSxFQUFFLGFBQTBCLEVBQUUsRUFBRTtZQUN0RSxxRUFBcUU7WUFDckUsSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDUixPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUM7Z0JBQzlCLE9BQU8sTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3JCLENBQUM7WUFFRCwyREFBMkQ7WUFDM0QsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLENBQ2hELENBQUMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUF1QixFQUFFLEVBQUU7Z0JBQ3BDLGdCQUFnQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUMzRDs7Ozs7bUJBS0c7Z0JBQ0gsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVMsQ0FBQyxDQUFDO2dCQUU5RSxPQUFPO29CQUNMLEdBQUcsR0FBRztvQkFDTixJQUFJO29CQUNKLE9BQU8sRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDO2lCQUM3QyxDQUFDO1lBQ0osQ0FBQyxDQUNGLENBQUM7WUFFRixPQUFPLENBQUM7Z0JBQ04sS0FBSyxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUM7Z0JBQzNDLFFBQVE7Z0JBQ1IsZ0JBQWdCO2FBQ2pCLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsTUFBTSw2QkFBNkIsR0FBRyxlQUFlLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ25FLGtFQUFrRTtBQUNsRSxTQUFTLG9CQUFvQixDQUFDLE9BQWU7SUFDM0MsMkZBQTJGO0lBQzNGLDJFQUEyRTtJQUMzRSxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7SUFDL0UsSUFBSSxDQUFDO1FBQ0gscUZBQXFGO1FBQ3JGLE9BQU8sSUFBSSxDQUNULG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsSUFBSSxlQUFlLEVBQzNELDZCQUE2QixDQUM5QixDQUFDO0lBQ0osQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCBsaWNlbnNlQ2hlY2tlciwge01vZHVsZUluZm8sIE1vZHVsZUluZm9zfSBmcm9tICdsaWNlbnNlLWNoZWNrZXInO1xuaW1wb3J0IHNwZHggZnJvbSAnc3BkeC1zYXRpc2ZpZXMnO1xuXG4vLyBBIGdlbmVyYWwgbm90ZSBvbiBzb21lIGRpc2FsbG93ZWQgbGljZW5zZXM6XG4vLyAtIENDMFxuLy8gICAgVGhpcyBpcyBub3QgYSB2YWxpZCBsaWNlbnNlLiBJdCBkb2VzIG5vdCBncmFudCBjb3B5cmlnaHQgb2YgdGhlIGNvZGUvYXNzZXQsIGFuZCBkb2VzIG5vdFxuLy8gICAgcmVzb2x2ZSBwYXRlbnRzIG9yIG90aGVyIGxpY2Vuc2VkIHdvcmsuIFRoZSBkaWZmZXJlbnQgY2xhaW1zIGFsc28gaGF2ZSBubyBzdGFuZGluZyBpbiBjb3VydFxuLy8gICAgYW5kIGRvIG5vdCBwcm92aWRlIHByb3RlY3Rpb24gdG8gb3IgZnJvbSBHb29nbGUgYW5kL29yIHRoaXJkIHBhcnRpZXMuXG4vLyAgICBXZSBjYW5ub3QgdXNlIG5vciBjb250cmlidXRlIHRvIENDMCBsaWNlbnNlcy5cbi8vIC0gUHVibGljIERvbWFpblxuLy8gICAgU2FtZSBhcyBDQzAsIGl0IGlzIG5vdCBhIHZhbGlkIGxpY2Vuc2UuXG5cbi8qKiBMaXN0IG9mIGVzdGFibGlzaGVkIGFsbG93ZWQgbGljZW5zZXMgZm9yIGRlcGRlbmVuY2llcy4gKi9cbmNvbnN0IGFsbG93ZWRMaWNlbnNlcyA9IFtcbiAgLy8gTm90aWNlIGxpY2Vuc2VzXG4gICdNSVQnLFxuICAnSVNDJyxcbiAgJ0FwYWNoZS0yLjAnLFxuICAnUHl0aG9uLTIuMCcsXG4gICdBcnRpc3RpYy0yLjAnLFxuICAnQlNELTItQ2xhdXNlJyxcbiAgJ0JTRC0zLUNsYXVzZScsXG4gICdCU0QtNC1DbGF1c2UnLFxuICAnWmxpYicsXG4gICdBRkwtMi4xJyxcbiAgJ0NDLUJZLTMuMCcsXG4gICdDQy1CWS00LjAnLFxuXG4gIC8vIFVuZW5jdW1iZXJlZFxuICAnVW5saWNlbnNlJyxcbiAgJ0NDMC0xLjAnLFxuICAnMEJTRCcsXG5dO1xuXG4vKiogS25vd24gbmFtZSB2YXJpYXRpb25zIG9mIFNQRFggbGljZW5zZXMuICovXG5jb25zdCBsaWNlbnNlUmVwbGFjZW1lbnRzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oW1xuICAvLyBKdXN0IGEgbG9uZ2VyIHN0cmluZyB0aGF0IG91ciBzY3JpcHQgY2F0Y2hlcy4gU1BEWCBvZmZpY2lhbCBuYW1lIGlzIHRoZSBzaG9ydGVyIG9uZS5cbiAgWydBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAnLCAnQXBhY2hlLTIuMCddLFxuICBbJ0FwYWNoZTInLCAnQXBhY2hlLTIuMCddLFxuICBbJ0FwYWNoZSAyLjAnLCAnQXBhY2hlLTIuMCddLFxuICBbJ0FwYWNoZSB2MicsICdBcGFjaGUtMi4wJ10sXG5cbiAgLy8gQWx0ZXJuYXRlIHN5bnRheFxuICBbJ0FGTHYyLjEnLCAnQUZMLTIuMSddLFxuXG4gIC8vIEJTRCBpcyBCU0QtMi1jbGF1c2UgYnkgZGVmYXVsdC5cbiAgWydCU0QnLCAnQlNELTItQ2xhdXNlJ10sXG5dKTtcblxuaW50ZXJmYWNlIEV4cGFuZGVkTW9kdWxlSW5mbyBleHRlbmRzIE1vZHVsZUluZm8ge1xuICBuYW1lOiBzdHJpbmc7XG4gIGFsbG93ZWQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGljZW5zZUNoZWNrUmVzdWx0IHtcbiAgdmFsaWQ6IGJvb2xlYW47XG4gIHBhY2thZ2VzOiBFeHBhbmRlZE1vZHVsZUluZm9bXTtcbiAgbWF4UGtnTmFtZUxlbmd0aDogbnVtYmVyO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2hlY2tBbGxMaWNlbnNlcyhzdGFydDogc3RyaW5nKTogUHJvbWlzZTxMaWNlbnNlQ2hlY2tSZXN1bHQ+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBsZXQgbWF4UGtnTmFtZUxlbmd0aCA9IDA7XG4gICAgbGljZW5zZUNoZWNrZXIuaW5pdCh7c3RhcnR9LCAoZXJyOiBFcnJvciwgcGtnSW5mb09iamVjdDogTW9kdWxlSW5mb3MpID0+IHtcbiAgICAgIC8vIElmIHRoZSBsaWNlbnNlIHByb2Nlc3NvciBmYWlscywgcmVqZWN0IHRoZSBwcm9jZXNzIHdpdGggdGhlIGVycm9yLlxuICAgICAgaWYgKGVycikge1xuICAgICAgICBjb25zb2xlLmxvZygndGhhdHMgYW4gZXJyb3InKTtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnIpO1xuICAgICAgfVxuXG4gICAgICAvLyBDaGVjayBlYWNoIHBhY2thZ2UgdG8gZW5zdXJlIGl0cyBsaWNlbnNlKHMpIGFyZSBhbGxvd2VkLlxuICAgICAgY29uc3QgcGFja2FnZXMgPSBPYmplY3QuZW50cmllcyhwa2dJbmZvT2JqZWN0KS5tYXA8RXhwYW5kZWRNb2R1bGVJbmZvPihcbiAgICAgICAgKFtuYW1lLCBwa2ddOiBbc3RyaW5nLCBNb2R1bGVJbmZvXSkgPT4ge1xuICAgICAgICAgIG1heFBrZ05hbWVMZW5ndGggPSBNYXRoLm1heChtYXhQa2dOYW1lTGVuZ3RoLCBuYW1lLmxlbmd0aCk7XG4gICAgICAgICAgLyoqXG4gICAgICAgICAgICogQXJyYXkgb2YgbGljZW5zZXMgZm9yIHRoZSBwYWNrYWdlLlxuICAgICAgICAgICAqXG4gICAgICAgICAgICogTm90ZTogVHlwaWNhbGx5IGEgcGFja2FnZSB3aWxsIG9ubHkgaGF2ZSBvbmUgbGljZW5zZSwgYnV0IHN1cHBvcnQgZm9yIG11bHRpcGxlIGxpY2Vuc2VcbiAgICAgICAgICAgKiAgICAgICBpcyBuZWNlc3NhcnkgZm9yIGZ1bGwgc3VwcG9ydC5cbiAgICAgICAgICAgKi9cbiAgICAgICAgICBjb25zdCBsaWNlbnNlcyA9IEFycmF5LmlzQXJyYXkocGtnLmxpY2Vuc2VzKSA/IHBrZy5saWNlbnNlcyA6IFtwa2cubGljZW5zZXMhXTtcblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5wa2csXG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgYWxsb3dlZDogbGljZW5zZXMuc29tZShhc3NlcnRBbGxvd2VkTGljZW5zZSksXG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgICk7XG5cbiAgICAgIHJlc29sdmUoe1xuICAgICAgICB2YWxpZDogcGFja2FnZXMuZXZlcnkoKHBrZykgPT4gcGtnLmFsbG93ZWQpLFxuICAgICAgICBwYWNrYWdlcyxcbiAgICAgICAgbWF4UGtnTmFtZUxlbmd0aCxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcbn1cblxuY29uc3QgYWxsb3dlZExpY2Vuc2VzU3BkeEV4cHJlc3Npb24gPSBhbGxvd2VkTGljZW5zZXMuam9pbignIE9SICcpO1xuLy8gQ2hlY2sgaWYgYSBsaWNlbnNlIGlzIGFjY2VwdGVkIGJ5IGFuIGFycmF5IG9mIGFjY2VwdGVkIGxpY2Vuc2VzXG5mdW5jdGlvbiBhc3NlcnRBbGxvd2VkTGljZW5zZShsaWNlbnNlOiBzdHJpbmcpIHtcbiAgLy8gTGljZW5zZXMgd2hpY2ggYXJlIGRldGVybWluZWQgYmFzZWQgb24gYSBmaWxlIG90aGVyIHRoYW4gTElDRU5TRSBhcmUgaGF2ZSBhbiAqIGFwcGVuZGVkLlxuICAvLyBTZWUgaHR0cHM6Ly93d3cubnBtanMuY29tL3BhY2thZ2UvbGljZW5zZS1jaGVja2VyI2hvdy1saWNlbnNlcy1hcmUtZm91bmRcbiAgY29uc3Qgc3RyaXBwZWRMaWNlbnNlID0gbGljZW5zZS5lbmRzV2l0aCgnKicpID8gbGljZW5zZS5zbGljZSgwLCAtMSkgOiBsaWNlbnNlO1xuICB0cnkge1xuICAgIC8vIElmIHRoZSBsaWNlbnNlIGlzIGluY2x1ZGVkIGluIHRoZSBrbm93biByZXBsYWNlbWVudHMsIHVzZSB0aGUgcmVwbGFjZW1lbnQgaW5zdGVhZC5cbiAgICByZXR1cm4gc3BkeChcbiAgICAgIGxpY2Vuc2VSZXBsYWNlbWVudHMuZ2V0KHN0cmlwcGVkTGljZW5zZSkgPz8gc3RyaXBwZWRMaWNlbnNlLFxuICAgICAgYWxsb3dlZExpY2Vuc2VzU3BkeEV4cHJlc3Npb24sXG4gICAgKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG4iXX0=