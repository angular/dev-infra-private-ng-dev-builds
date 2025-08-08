import * as fs from 'fs';
import { GitClient } from '../../utils/git/git-client.js';
import semver from 'semver';
import { createExperimentalSemver } from '../../release/versioning/experimental-versions.js';
import { join } from 'path';
export async function printEnvStamp(mode, includeVersion) {
    const git = await GitClient.get();
    console.info(`BUILD_SCM_BRANCH ${getCurrentBranch(git)}`);
    console.info(`BUILD_SCM_COMMIT_SHA ${getCurrentSha(git)}`);
    console.info(`BUILD_SCM_HASH ${getCurrentSha(git)}`);
    console.info(`BUILD_SCM_ABBREV_HASH ${getCurrentAbbrevSha(git)}`);
    console.info(`BUILD_SCM_BRANCH ${getCurrentBranchOrRevision(git)}`);
    console.info(`BUILD_SCM_LOCAL_CHANGES ${hasLocalChanges(git)}`);
    console.info(`BUILD_SCM_USER ${getCurrentGitUser(git)}`);
    if (includeVersion === true) {
        const { version, experimentalVersion } = getSCMVersions(git, mode);
        console.info(`STABLE_PROJECT_VERSION ${version}`);
        console.info(`STABLE_PROJECT_EXPERIMENTAL_VERSION ${experimentalVersion}`);
    }
}
function hasLocalChanges(git) {
    try {
        return git.hasUncommittedChanges();
    }
    catch {
        return true;
    }
}
function getSCMVersions(git, mode) {
    const version = getVersionFromWorkspacePackageJson(git).format();
    const experimentalVersion = createExperimentalSemver(version).format();
    if (mode === 'release') {
        return {
            version,
            experimentalVersion,
        };
    }
    const headShaAbbreviated = getCurrentSha(git).slice(0, 7);
    const localChanges = hasLocalChanges(git) ? '-with-local-changes' : '';
    return {
        version: `${version}+sha-${headShaAbbreviated}${localChanges}`,
        experimentalVersion: `${experimentalVersion}+sha-${headShaAbbreviated}${localChanges}`,
    };
}
function getCurrentSha(git) {
    try {
        return git.run(['rev-parse', 'HEAD']).stdout.trim();
    }
    catch {
        return '';
    }
}
function getCurrentAbbrevSha(git) {
    try {
        return git.run(['rev-parse', '--short', 'HEAD']).stdout.trim();
    }
    catch {
        return '';
    }
}
function getCurrentBranchOrRevision(git) {
    try {
        return git.getCurrentBranchOrRevision();
    }
    catch {
        return '';
    }
}
function getCurrentBranch(git) {
    try {
        return git.run(['symbolic-ref', '--short', 'HEAD']).stdout.trim();
    }
    catch {
        return '';
    }
}
function getCurrentGitUser(git) {
    try {
        let userName = git.runGraceful(['config', 'user.name']).stdout.trim() || 'Unknown User';
        let userEmail = git.runGraceful(['config', 'user.email']).stdout.trim() || 'unknown_email';
        return `${userName} <${userEmail}>`;
    }
    catch {
        return '';
    }
}
function getVersionFromWorkspacePackageJson(git) {
    const packageJsonPath = join(git.baseDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.version === undefined) {
        throw new Error(`No workspace version found in: ${packageJsonPath}`);
    }
    return new semver.SemVer(packageJson.version);
}
//# sourceMappingURL=env-stamp.js.map