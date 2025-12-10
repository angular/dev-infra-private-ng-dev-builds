import * as path from 'path';
import * as fs from 'fs';
import { parse as parseYaml } from 'yaml';
import { workspaceRelativePackageJsonPath } from './constants.js';
import { Log } from './logging.js';
import { tryGetPackageId } from '@pnpm/dependency-path';
import { determineRepoBaseDirFromCwd } from './repo-directory.js';
import { GitClient } from './git/git-client.js';
const localVersion = `0.0.0-{SCM_HEAD_SHA}`;
let verified = false;
export async function ngDevVersionMiddleware() {
    if (verified) {
        return;
    }
    await verifyNgDevToolIsUpToDate(determineRepoBaseDirFromCwd());
    verified = true;
}
export async function verifyNgDevToolIsUpToDate(workspacePath) {
    const packageJsonPath = path.join(workspacePath, workspaceRelativePackageJsonPath);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    if (packageJson.name === '@angular/build-tooling') {
        Log.debug('Skipping ng-dev version check as this is a locally generated version.');
        return true;
    }
    const expectedVersion = await getExpectedVersionFromPnpmLockUpstream();
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
async function getExpectedVersionFromPnpmLockUpstream() {
    const git = await GitClient.get();
    try {
        const { data } = await git.github.repos.getContent({
            repo: git.remoteConfig.name,
            owner: git.remoteConfig.owner,
            ref: git.remoteConfig.mainBranchName,
            mediaType: { format: 'application/vnd.github.raw+json' },
            path: 'pnpm-lock.yaml',
        });
        if (Array.isArray(data) || data.type !== 'file') {
            throw Error(`A non-single file of content was retrieved from Github when the pnpm-lock.yaml file was requested`);
        }
        const lockFile = parseYaml(Buffer.from(data.content, data.encoding).toString('utf-8'));
        const importers = lockFile['importers']['.'];
        const depEntry = importers.dependencies?.['@angular/ng-dev'] ??
            importers.devDependencies?.['@angular/ng-dev'] ??
            importers.optionalDependencies?.['@angular/ng-dev'];
        const packageId = tryGetPackageId(depEntry.version);
        return lockFile['packages'][`@angular/ng-dev@${packageId}`].version;
    }
    catch (e) {
        Log.debug('Could not find expected ng-dev version from `pnpm-lock.yaml` file:', e);
        return 'unknown';
    }
}
//# sourceMappingURL=version-check.js.map