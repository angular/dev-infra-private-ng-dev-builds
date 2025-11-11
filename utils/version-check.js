import * as path from 'path';
import * as fs from 'fs';
import lockfile from '@yarnpkg/lockfile';
import { parse as parseYaml } from 'yaml';
import { ngDevNpmPackageName, workspaceRelativePackageJsonPath } from './constants.js';
import { Log } from './logging.js';
import { tryGetPackageId } from '@pnpm/dependency-path';
import { determineRepoBaseDirFromCwd } from './repo-directory.js';
let verified = false;
export async function ngDevVersionMiddleware() {
    if (verified) {
        return;
    }
    await verifyNgDevToolIsUpToDate(determineRepoBaseDirFromCwd());
    verified = true;
}
export async function verifyNgDevToolIsUpToDate(workspacePath) {
    const localVersion = `0.0.0-{SCM_HEAD_SHA}`;
    if (!!process.env['LOCAL_NG_DEV_BUILD']) {
        Log.debug('Skipping ng-dev version check as this is a locally generated version.');
        return true;
    }
    const workspacePackageJsonFile = path.join(workspacePath, workspaceRelativePackageJsonPath);
    const pnpmLockFile = path.join(workspacePath, 'pnpm-lock.yaml');
    const yarnLockFile = path.join(workspacePath, 'yarn.lock');
    const isPnpmMigrated = fs.existsSync(pnpmLockFile) && !fs.existsSync(yarnLockFile);
    const expectedVersion = isPnpmMigrated
        ? getExpectedVersionFromPnpmLock(workspacePackageJsonFile, pnpmLockFile)
        : getExpectedVersionFromYarnLock(workspacePackageJsonFile, yarnLockFile);
    Log.debug('Checking ng-dev version in lockfile and in the running script:');
    Log.debug(`  Local: ${localVersion}`);
    Log.debug(`  Expected: ${expectedVersion}`);
    if (localVersion !== expectedVersion) {
        Log.warn('  ⚠   Your locally installed version of the `ng-dev` tool is outdated and not');
        Log.warn('      matching with the version in the `package.json` file.');
        Log.warn('      Re-install the dependencies to ensure you are using the correct version.');
        return false;
    }
    return true;
}
function getExpectedVersionFromYarnLock(workspacePackageJsonFile, lockFilePath) {
    try {
        const packageJson = JSON.parse(fs.readFileSync(workspacePackageJsonFile, 'utf8'));
        if (packageJson.name === ngDevNpmPackageName) {
            return true;
        }
        const lockFileContent = fs.readFileSync(lockFilePath, 'utf8');
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
        return lockFileObject[`${ngDevNpmPackageName}@${devInfraPkgVersion}`].version;
    }
    catch (e) {
        Log.debug('Could not find expected ng-dev version from `yarn.lock` file:', e);
        return null;
    }
}
function getExpectedVersionFromPnpmLock(workspacePackageJsonFile, lockFilePath) {
    try {
        const packageJson = JSON.parse(fs.readFileSync(workspacePackageJsonFile, 'utf8'));
        if (packageJson.name === ngDevNpmPackageName) {
            return true;
        }
        const lockFileContent = fs.readFileSync(lockFilePath, 'utf8');
        const lockFile = parseYaml(lockFileContent);
        const importers = lockFile['importers']['.'];
        const depEntry = importers.dependencies?.['@angular/ng-dev'] ??
            importers.devDependencies?.['@angular/ng-dev'] ??
            importers.optionalDependencies?.['@angular/ng-dev'];
        const packageId = tryGetPackageId(depEntry.version);
        return lockFile['packages'][`@angular/ng-dev@${packageId}`].version;
    }
    catch (e) {
        Log.debug('Could not find expected ng-dev version from `pnpm-lock.yaml` file:', e);
        return null;
    }
}
//# sourceMappingURL=version-check.js.map