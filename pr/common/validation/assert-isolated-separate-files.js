import { Minimatch } from 'minimatch';
import path from 'path';
import { assertValidCaretakerConfig, } from '../../../utils/config.js';
import { getGoogleSyncConfig } from '../../../utils/g3-sync-config.js';
import { G3Stats } from '../../../utils/g3.js';
import { createPullRequestValidation, PullRequestValidation } from './validation-config.js';
import { fetchPullRequestFilesFromGithub } from '../fetch-pull-request.js';
export const isolatedSeparateFilesValidation = createPullRequestValidation({ name: 'assertIsolatedSeparateFiles', canBeForceIgnored: true }, () => Validation);
class Validation extends PullRequestValidation {
    async assert(config, prNumber, gitClient) {
        try {
            assertValidCaretakerConfig(config);
        }
        catch {
            throw this._createError('No Caretaker Config was found.');
        }
        const g3SyncConfigWithMatchers = await getGsyncConfig(config.caretaker, gitClient);
        if (g3SyncConfigWithMatchers === null) {
            return;
        }
        const diffStats = await getDiffStats(config, g3SyncConfigWithMatchers.config, gitClient);
        if (diffStats === undefined) {
            return;
        }
        const hasSeparateSyncFiles = await PullRequestFiles.create(gitClient, prNumber, g3SyncConfigWithMatchers.config).pullRequestHasSeparateFiles();
        if (diffStats.separateFiles > 0 && !hasSeparateSyncFiles) {
            throw this._createError(`This PR cannot be merged as Shared Primitives code has already been merged. ` +
                `Primitives and Framework code must be merged and synced separately. Try again after a g3sync has finished.`);
        }
        if (diffStats.files > 0 && diffStats.separateFiles === 0 && hasSeparateSyncFiles) {
            throw this._createError(`This PR cannot be merged as Angular framework code has already been merged. ` +
                `Primitives and Framework code must be merged and synced separately. Try again after a g3sync has finished.`);
        }
    }
}
async function getGsyncConfig(config, git) {
    let googleSyncConfig = null;
    if (config.g3SyncConfigPath) {
        try {
            const configPath = path.join(git.baseDir, config.g3SyncConfigPath);
            googleSyncConfig = await getGoogleSyncConfig(configPath);
        }
        catch { }
    }
    return googleSyncConfig;
}
export class PullRequestFiles {
    constructor(git, prNumber, config) {
        this.git = git;
        this.prNumber = prNumber;
        this.config = config;
    }
    async loadPullRequestFiles() {
        const files = await fetchPullRequestFilesFromGithub(this.git, this.prNumber);
        return files?.map((x) => x.path) ?? [];
    }
    async pullRequestHasSeparateFiles() {
        const pullRequestFiles = await this.loadPullRequestFiles();
        const separateFilePatterns = this.config.separateFilePatterns.map((p) => new Minimatch(p));
        for (let path of pullRequestFiles) {
            if (separateFilePatterns.some((p) => p.match(path))) {
                return true;
            }
        }
        return false;
    }
    static create(git, prNumber, config) {
        return new PullRequestFiles(git, prNumber, config);
    }
}
async function getDiffStats(ngDevConfig, googleSyncConfig, git) {
    if (googleSyncConfig && googleSyncConfig.separateFilePatterns.length > 0) {
        return G3Stats.retrieveDiffStats(git, {
            caretaker: ngDevConfig.caretaker,
            github: ngDevConfig.github,
        });
    }
    return;
}
//# sourceMappingURL=assert-isolated-separate-files.js.map