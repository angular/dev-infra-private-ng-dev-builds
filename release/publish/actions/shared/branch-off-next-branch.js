import semver from 'semver';
import { green, Log } from '../../../../utils/logging.js';
import { workspaceRelativePackageJsonPath } from '../../../../utils/constants.js';
import { workspaceRelativeChangelogPath } from '../../../notes/release-notes.js';
import { getCommitMessageForExceptionalNextVersionBump, getReleaseNoteCherryPickCommitMessage, } from '../../commit-message.js';
import { CutNpmNextPrereleaseAction } from '../cut-npm-next-prerelease.js';
import { CutNpmNextReleaseCandidateAction } from '../cut-npm-next-release-candidate.js';
import { ActiveReleaseTrains } from '../../../versioning/active-release-trains.js';
import { updateRenovateConfig } from '../renovate-config-updates.js';
export class BranchOffNextBranchBaseAction extends CutNpmNextPrereleaseAction {
    constructor() {
        super(...arguments);
        this._nextPrerelease = new CutNpmNextPrereleaseAction(new ActiveReleaseTrains({ ...this.active, releaseCandidate: null }), this.git, this.config, this.projectDir);
        this._rcPrerelease = new CutNpmNextReleaseCandidateAction(new ActiveReleaseTrains({ ...this.active, releaseCandidate: this.active.next }), this.git, this.config, this.projectDir);
    }
    async getDescription() {
        const { branchName } = this.active.next;
        const newVersion = await this._computeNewVersion();
        return `Move the "${branchName}" branch into ${this.newPhaseName} phase (v${newVersion}).`;
    }
    async perform() {
        const nextBranchName = this.active.next.branchName;
        const compareVersionForReleaseNotes = await this._computeReleaseNoteCompareVersion();
        const newVersion = await this._computeNewVersion();
        const newBranch = `${newVersion.major}.${newVersion.minor}.x`;
        const { sha: beforeStagingSha } = await this.getLatestCommitOfBranch(nextBranchName);
        await this.assertPassingGithubStatus(beforeStagingSha, nextBranchName);
        await this._createNewVersionBranchFromNext(newBranch);
        const { pullRequest, releaseNotes, builtPackagesWithInfo } = await this.stageVersionForBranchAndCreatePullRequest(newVersion, compareVersionForReleaseNotes, newBranch);
        await this.promptAndWaitForPullRequestMerged(pullRequest);
        await this.publish(builtPackagesWithInfo, releaseNotes, beforeStagingSha, newBranch, 'next', {
            showAsLatestOnGitHub: false,
        });
        const branchOffPullRequest = await this._createNextBranchUpdatePullRequest(releaseNotes, newVersion);
        await this.promptAndWaitForPullRequestMerged(branchOffPullRequest);
    }
    async _computeNewVersion() {
        if (this.newPhaseName === 'feature-freeze') {
            return this._nextPrerelease.getNewVersion();
        }
        else {
            return this._rcPrerelease.getNewVersion();
        }
    }
    async _computeReleaseNoteCompareVersion() {
        return await this._nextPrerelease.releaseNotesCompareVersion;
    }
    async _createNewVersionBranchFromNext(newBranch) {
        const { branchName: nextBranch } = this.active.next;
        await this.checkoutUpstreamBranch(nextBranch);
        await this.createLocalBranchFromHead(newBranch);
        await this.pushHeadToRemoteBranch(newBranch);
        Log.info(green(`  ✓   Version branch "${newBranch}" created.`));
    }
    async _createNextBranchUpdatePullRequest(releaseNotes, newVersion) {
        const { branchName: nextBranch, version } = this.active.next;
        const newNextVersion = semver.parse(`${version.major}.${version.minor + 1}.0-next.0`);
        const bumpCommitMessage = getCommitMessageForExceptionalNextVersionBump(newNextVersion);
        await this.checkoutUpstreamBranch(nextBranch);
        await this.updateProjectVersion(newNextVersion);
        const filesToCommit = [workspaceRelativePackageJsonPath];
        const renovateConfigPath = await updateRenovateConfig(this.projectDir, `${version.major}.${version.minor}.x`);
        if (renovateConfigPath) {
            filesToCommit.push(renovateConfigPath);
        }
        await this.createCommit(bumpCommitMessage, filesToCommit);
        await this.prependReleaseNotesToChangelog(releaseNotes);
        const commitMessage = getReleaseNoteCherryPickCommitMessage(releaseNotes.version);
        await this.createCommit(commitMessage, [workspaceRelativeChangelogPath]);
        let nextPullRequestMessage = `The previous "next" release-train has moved into the ` +
            `${this.newPhaseName} phase. This PR updates the next branch to the subsequent ` +
            `release-train.\n\nAlso this PR cherry-picks the changelog for ` +
            `v${newVersion} into the ${nextBranch} branch so that the changelog is up to date.`;
        const nextUpdatePullRequest = await this.pushChangesToForkAndCreatePullRequest(nextBranch, `next-release-train-${newNextVersion}`, `Update next branch to reflect new release-train "v${newNextVersion}".`, nextPullRequestMessage);
        Log.info(green(`  ✓   Pull request for updating the "${nextBranch}" branch has been created.`));
        return nextUpdatePullRequest;
    }
}
//# sourceMappingURL=branch-off-next-branch.js.map