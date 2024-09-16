/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import * as path from 'path';
import * as fs from 'fs';
import lockfile from '@yarnpkg/lockfile';
import { parse as parseYaml } from 'yaml';
import { ngDevNpmPackageName, workspaceRelativePackageJsonPath, workspaceRelativeYarnLockFilePath, } from './constants.js';
import { Log } from './logging.js';
/**
 * Verifies that the `ng-dev` tool is up-to-date in the workspace. The check will compare
 * the local version of the tool against the requested version in the workspace lock file.
 *
 * This check is helpful ensuring that the caretaker does not accidentally run with an older
 * local version of `ng-dev` due to not running `yarn` after checking out new revisions.
 *
 * @returns a boolean indicating success or failure.
 */
export async function verifyNgDevToolIsUpToDate(workspacePath) {
    // The placeholder will be replaced by the `pkg_npm` substitutions.
    const localVersion = `0.0.0-5261b7569a48fb76739881c0fffaeca48955ec55`;
    const workspacePackageJsonFile = path.join(workspacePath, workspaceRelativePackageJsonPath);
    const workspaceDirLockFile = path.join(workspacePath, workspaceRelativeYarnLockFilePath);
    try {
        const packageJson = JSON.parse(fs.readFileSync(workspacePackageJsonFile, 'utf8'));
        // If we are operating in the actual dev-infra repo, always return `true`.
        if (packageJson.name === ngDevNpmPackageName) {
            return true;
        }
        const lockFileContent = fs.readFileSync(workspaceDirLockFile, 'utf8');
        let lockFileObject;
        try {
            const lockFile = lockfile.parse(lockFileContent);
            if (lockFile.type !== 'success') {
                throw Error('Unable to parse workspace lock file. Please ensure the file is valid.');
            }
            lockFileObject = lockFile.object;
        }
        catch {
            lockFileObject = parseYaml(lockFileContent);
        }
        const devInfraPkgVersion = packageJson?.dependencies?.[ngDevNpmPackageName] ??
            packageJson?.devDependencies?.[ngDevNpmPackageName] ??
            packageJson?.optionalDependencies?.[ngDevNpmPackageName];
        const expectedVersion = lockFileObject[`${ngDevNpmPackageName}@${devInfraPkgVersion}`].version;
        if (localVersion !== expectedVersion) {
            Log.error('  ✘   Your locally installed version of the `ng-dev` tool is outdated and not');
            Log.error('      matching with the version in the `package.json` file.');
            Log.error('      Re-install the dependencies to ensure you are using the correct version.');
            return false;
        }
        return true;
    }
    catch (e) {
        Log.error(e);
        return false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVyc2lvbi1jaGVjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25nLWRldi91dGlscy92ZXJzaW9uLWNoZWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sS0FBSyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBQzdCLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3pCLE9BQU8sUUFBUSxNQUFNLG1CQUFtQixDQUFDO0FBQ3pDLE9BQU8sRUFBQyxLQUFLLElBQUksU0FBUyxFQUFDLE1BQU0sTUFBTSxDQUFDO0FBQ3hDLE9BQU8sRUFDTCxtQkFBbUIsRUFDbkIsZ0NBQWdDLEVBQ2hDLGlDQUFpQyxHQUNsQyxNQUFNLGdCQUFnQixDQUFDO0FBQ3hCLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFFakM7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFNLENBQUMsS0FBSyxVQUFVLHlCQUF5QixDQUFDLGFBQXFCO0lBQ25FLG1FQUFtRTtJQUNuRSxNQUFNLFlBQVksR0FBRyxzQkFBc0IsQ0FBQztJQUM1QyxNQUFNLHdCQUF3QixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLGdDQUFnQyxDQUFDLENBQUM7SUFDNUYsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxpQ0FBaUMsQ0FBQyxDQUFDO0lBRXpGLElBQUksQ0FBQztRQUNILE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyx3QkFBd0IsRUFBRSxNQUFNLENBQUMsQ0FBUSxDQUFDO1FBQ3pGLDBFQUEwRTtRQUMxRSxJQUFJLFdBQVcsQ0FBQyxJQUFJLEtBQUssbUJBQW1CLEVBQUUsQ0FBQztZQUM3QyxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFFRCxNQUFNLGVBQWUsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLG9CQUFvQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRXRFLElBQUksY0FBaUQsQ0FBQztRQUN0RCxJQUFJLENBQUM7WUFDSCxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBRWpELElBQUksUUFBUSxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDaEMsTUFBTSxLQUFLLENBQUMsdUVBQXVFLENBQUMsQ0FBQztZQUN2RixDQUFDO1lBQ0QsY0FBYyxHQUFHLFFBQVEsQ0FBQyxNQUFpQyxDQUFDO1FBQzlELENBQUM7UUFBQyxNQUFNLENBQUM7WUFDUCxjQUFjLEdBQUcsU0FBUyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQzlDLENBQUM7UUFFRCxNQUFNLGtCQUFrQixHQUN0QixXQUFXLEVBQUUsWUFBWSxFQUFFLENBQUMsbUJBQW1CLENBQUM7WUFDaEQsV0FBVyxFQUFFLGVBQWUsRUFBRSxDQUFDLG1CQUFtQixDQUFDO1lBQ25ELFdBQVcsRUFBRSxvQkFBb0IsRUFBRSxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDM0QsTUFBTSxlQUFlLEdBQUcsY0FBYyxDQUFDLEdBQUcsbUJBQW1CLElBQUksa0JBQWtCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQztRQUUvRixJQUFJLFlBQVksS0FBSyxlQUFlLEVBQUUsQ0FBQztZQUNyQyxHQUFHLENBQUMsS0FBSyxDQUFDLCtFQUErRSxDQUFDLENBQUM7WUFDM0YsR0FBRyxDQUFDLEtBQUssQ0FBQyw2REFBNkQsQ0FBQyxDQUFDO1lBQ3pFLEdBQUcsQ0FBQyxLQUFLLENBQUMsZ0ZBQWdGLENBQUMsQ0FBQztZQUM1RixPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQ1gsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNiLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCBsb2NrZmlsZSBmcm9tICdAeWFybnBrZy9sb2NrZmlsZSc7XG5pbXBvcnQge3BhcnNlIGFzIHBhcnNlWWFtbH0gZnJvbSAneWFtbCc7XG5pbXBvcnQge1xuICBuZ0Rldk5wbVBhY2thZ2VOYW1lLFxuICB3b3Jrc3BhY2VSZWxhdGl2ZVBhY2thZ2VKc29uUGF0aCxcbiAgd29ya3NwYWNlUmVsYXRpdmVZYXJuTG9ja0ZpbGVQYXRoLFxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQge0xvZ30gZnJvbSAnLi9sb2dnaW5nLmpzJztcblxuLyoqXG4gKiBWZXJpZmllcyB0aGF0IHRoZSBgbmctZGV2YCB0b29sIGlzIHVwLXRvLWRhdGUgaW4gdGhlIHdvcmtzcGFjZS4gVGhlIGNoZWNrIHdpbGwgY29tcGFyZVxuICogdGhlIGxvY2FsIHZlcnNpb24gb2YgdGhlIHRvb2wgYWdhaW5zdCB0aGUgcmVxdWVzdGVkIHZlcnNpb24gaW4gdGhlIHdvcmtzcGFjZSBsb2NrIGZpbGUuXG4gKlxuICogVGhpcyBjaGVjayBpcyBoZWxwZnVsIGVuc3VyaW5nIHRoYXQgdGhlIGNhcmV0YWtlciBkb2VzIG5vdCBhY2NpZGVudGFsbHkgcnVuIHdpdGggYW4gb2xkZXJcbiAqIGxvY2FsIHZlcnNpb24gb2YgYG5nLWRldmAgZHVlIHRvIG5vdCBydW5uaW5nIGB5YXJuYCBhZnRlciBjaGVja2luZyBvdXQgbmV3IHJldmlzaW9ucy5cbiAqXG4gKiBAcmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyBzdWNjZXNzIG9yIGZhaWx1cmUuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB2ZXJpZnlOZ0RldlRvb2xJc1VwVG9EYXRlKHdvcmtzcGFjZVBhdGg6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAvLyBUaGUgcGxhY2Vob2xkZXIgd2lsbCBiZSByZXBsYWNlZCBieSB0aGUgYHBrZ19ucG1gIHN1YnN0aXR1dGlvbnMuXG4gIGNvbnN0IGxvY2FsVmVyc2lvbiA9IGAwLjAuMC17U0NNX0hFQURfU0hBfWA7XG4gIGNvbnN0IHdvcmtzcGFjZVBhY2thZ2VKc29uRmlsZSA9IHBhdGguam9pbih3b3Jrc3BhY2VQYXRoLCB3b3Jrc3BhY2VSZWxhdGl2ZVBhY2thZ2VKc29uUGF0aCk7XG4gIGNvbnN0IHdvcmtzcGFjZURpckxvY2tGaWxlID0gcGF0aC5qb2luKHdvcmtzcGFjZVBhdGgsIHdvcmtzcGFjZVJlbGF0aXZlWWFybkxvY2tGaWxlUGF0aCk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBwYWNrYWdlSnNvbiA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHdvcmtzcGFjZVBhY2thZ2VKc29uRmlsZSwgJ3V0ZjgnKSkgYXMgYW55O1xuICAgIC8vIElmIHdlIGFyZSBvcGVyYXRpbmcgaW4gdGhlIGFjdHVhbCBkZXYtaW5mcmEgcmVwbywgYWx3YXlzIHJldHVybiBgdHJ1ZWAuXG4gICAgaWYgKHBhY2thZ2VKc29uLm5hbWUgPT09IG5nRGV2TnBtUGFja2FnZU5hbWUpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGNvbnN0IGxvY2tGaWxlQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyh3b3Jrc3BhY2VEaXJMb2NrRmlsZSwgJ3V0ZjgnKTtcblxuICAgIGxldCBsb2NrRmlsZU9iamVjdDogUmVjb3JkPHN0cmluZywge3ZlcnNpb246IHN0cmluZ30+O1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBsb2NrRmlsZSA9IGxvY2tmaWxlLnBhcnNlKGxvY2tGaWxlQ29udGVudCk7XG5cbiAgICAgIGlmIChsb2NrRmlsZS50eXBlICE9PSAnc3VjY2VzcycpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ1VuYWJsZSB0byBwYXJzZSB3b3Jrc3BhY2UgbG9jayBmaWxlLiBQbGVhc2UgZW5zdXJlIHRoZSBmaWxlIGlzIHZhbGlkLicpO1xuICAgICAgfVxuICAgICAgbG9ja0ZpbGVPYmplY3QgPSBsb2NrRmlsZS5vYmplY3QgYXMgbG9ja2ZpbGUuTG9ja0ZpbGVPYmplY3Q7XG4gICAgfSBjYXRjaCB7XG4gICAgICBsb2NrRmlsZU9iamVjdCA9IHBhcnNlWWFtbChsb2NrRmlsZUNvbnRlbnQpO1xuICAgIH1cblxuICAgIGNvbnN0IGRldkluZnJhUGtnVmVyc2lvbiA9XG4gICAgICBwYWNrYWdlSnNvbj8uZGVwZW5kZW5jaWVzPy5bbmdEZXZOcG1QYWNrYWdlTmFtZV0gPz9cbiAgICAgIHBhY2thZ2VKc29uPy5kZXZEZXBlbmRlbmNpZXM/LltuZ0Rldk5wbVBhY2thZ2VOYW1lXSA/P1xuICAgICAgcGFja2FnZUpzb24/Lm9wdGlvbmFsRGVwZW5kZW5jaWVzPy5bbmdEZXZOcG1QYWNrYWdlTmFtZV07XG4gICAgY29uc3QgZXhwZWN0ZWRWZXJzaW9uID0gbG9ja0ZpbGVPYmplY3RbYCR7bmdEZXZOcG1QYWNrYWdlTmFtZX1AJHtkZXZJbmZyYVBrZ1ZlcnNpb259YF0udmVyc2lvbjtcblxuICAgIGlmIChsb2NhbFZlcnNpb24gIT09IGV4cGVjdGVkVmVyc2lvbikge1xuICAgICAgTG9nLmVycm9yKCcgIOKcmCAgIFlvdXIgbG9jYWxseSBpbnN0YWxsZWQgdmVyc2lvbiBvZiB0aGUgYG5nLWRldmAgdG9vbCBpcyBvdXRkYXRlZCBhbmQgbm90Jyk7XG4gICAgICBMb2cuZXJyb3IoJyAgICAgIG1hdGNoaW5nIHdpdGggdGhlIHZlcnNpb24gaW4gdGhlIGBwYWNrYWdlLmpzb25gIGZpbGUuJyk7XG4gICAgICBMb2cuZXJyb3IoJyAgICAgIFJlLWluc3RhbGwgdGhlIGRlcGVuZGVuY2llcyB0byBlbnN1cmUgeW91IGFyZSB1c2luZyB0aGUgY29ycmVjdCB2ZXJzaW9uLicpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIExvZy5lcnJvcihlKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cbiJdfQ==