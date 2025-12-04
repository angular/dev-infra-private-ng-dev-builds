import semver from 'semver';
import { fetchProjectNpmPackageInfo } from '../../versioning/npm-registry.js';
import { ReleaseAction } from '../actions.js';
import { ExternalCommands } from '../external-commands.js';
import { getReleaseTagForVersion } from '../../versioning/version-tags.js';
export class TagRecentMajorAsLatest extends ReleaseAction {
    async getDescription() {
        return `Retag recently published major v${this.active.latest.version} as "latest" in NPM.`;
    }
    async perform() {
        await this.updateGithubReleaseEntryToStable(this.active.latest.version);
        await this.checkoutUpstreamBranch(this.active.latest.branchName);
        await this.installDependenciesForCurrentBranch();
        await ExternalCommands.invokeSetNpmDist(this.projectDir, 'latest', this.active.latest.version);
    }
    async updateGithubReleaseEntryToStable(version) {
        const releaseTagName = getReleaseTagForVersion(version);
        const { data: releaseInfo } = await this.git.github.repos.getReleaseByTag({
            ...this.git.remoteParams,
            tag: releaseTagName,
        });
        await this.git.github.repos.updateRelease({
            ...this.git.remoteParams,
            release_id: releaseInfo.id,
            prerelease: false,
        });
    }
    static async isActive({ latest }, config) {
        if (latest.version.minor !== 0 || latest.version.patch !== 0) {
            return false;
        }
        const packageInfo = await fetchProjectNpmPackageInfo(config);
        const npmLatestVersion = semver.parse(packageInfo['dist-tags']['latest']);
        return npmLatestVersion !== null && npmLatestVersion.major === latest.version.major - 1;
    }
}
//# sourceMappingURL=tag-recent-major-as-latest.js.map