/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import semver from 'semver';
import { green, Log } from '../../../../utils/logging.js';
import { workspaceRelativePackageJsonPath } from '../../../../utils/constants.js';
import { workspaceRelativeChangelogPath } from '../../../notes/release-notes.js';
import { getCommitMessageForExceptionalNextVersionBump, getReleaseNoteCherryPickCommitMessage, } from '../../commit-message.js';
import { CutNpmNextPrereleaseAction } from '../cut-npm-next-prerelease.js';
import { CutNpmNextReleaseCandidateAction } from '../cut-npm-next-release-candidate.js';
import { ActiveReleaseTrains } from '../../../versioning/active-release-trains.js';
/**
 * Base action that can be used to move the next release-train into the dedicated FF/RC
 * release-train while also cutting a release to move the train into the `feature-freeze`
 * or `release-candidate` phase.
 *
 * This means that a new version branch is created based on the next branch, and a new
 * pre-release (either RC or another `next`) is cut- indicating the new phase.
 */
export class BranchOffNextBranchBaseAction extends CutNpmNextPrereleaseAction {
    constructor() {
        super(...arguments);
        // Instances of the action for cutting a NPM next pre-releases. We will re-use
        // these for determining the "new versions" and "release notes comparison version".
        // This helps avoiding duplication, especially since there are is some special logic.
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
        const beforeStagingSha = await this.getLatestCommitOfBranch(nextBranchName);
        // Verify the current next branch has a passing status, before we branch off.
        await this.assertPassingGithubStatus(beforeStagingSha, nextBranchName);
        // Branch-off the next branch into a new version branch.
        await this._createNewVersionBranchFromNext(newBranch);
        // Stage the new version for the newly created branch, and push changes to a
        // fork in order to create a staging pull request. Note that we re-use the newly
        // created branch instead of re-fetching from the upstream.
        const { pullRequest, releaseNotes, builtPackagesWithInfo } = await this.stageVersionForBranchAndCreatePullRequest(newVersion, compareVersionForReleaseNotes, newBranch);
        // Wait for the staging PR to be merged. Then publish the feature-freeze next pre-release. Finally,
        // cherry-pick the release notes into the next branch in combination with bumping the version to
        // the next minor too.
        await this.promptAndWaitForPullRequestMerged(pullRequest);
        await this.publish(builtPackagesWithInfo, releaseNotes, beforeStagingSha, newBranch, 'next', {
            showAsLatestOnGitHub: false,
        });
        const branchOffPullRequest = await this._createNextBranchUpdatePullRequest(releaseNotes, newVersion);
        await this.promptAndWaitForPullRequestMerged(branchOffPullRequest);
    }
    /** Computes the new version for the release-train being branched-off. */
    async _computeNewVersion() {
        if (this.newPhaseName === 'feature-freeze') {
            return this._nextPrerelease.getNewVersion();
        }
        else {
            return this._rcPrerelease.getNewVersion();
        }
    }
    /** Gets the release notes compare version for the branching-off release. */
    async _computeReleaseNoteCompareVersion() {
        // Regardless of the new phase, the release notes compare version should
        // always be the one as if a pre-release is cut on the `next` branch.
        // We cannot rely on the `CutNpmNextReleaseCandidateAction` here because it
        // assumes a published release for the train. This is not guaranteed.
        return await this._nextPrerelease.releaseNotesCompareVersion;
    }
    /** Creates a new version branch from the next branch. */
    async _createNewVersionBranchFromNext(newBranch) {
        const { branchName: nextBranch } = this.active.next;
        await this.checkoutUpstreamBranch(nextBranch);
        await this.createLocalBranchFromHead(newBranch);
        await this.pushHeadToRemoteBranch(newBranch);
        Log.info(green(`  ✓   Version branch "${newBranch}" created.`));
    }
    /**
     * Creates a pull request for the next branch that bumps the version to the next
     * minor, and cherry-picks the changelog for the newly branched-off release-candidate
     * or feature-freeze version.
     */
    async _createNextBranchUpdatePullRequest(releaseNotes, newVersion) {
        const { branchName: nextBranch, version } = this.active.next;
        // We increase the version for the next branch to the next minor. The team can decide
        // later if they want next to be a major through the `Configure Next as Major` release action.
        const newNextVersion = semver.parse(`${version.major}.${version.minor + 1}.0-next.0`);
        const bumpCommitMessage = getCommitMessageForExceptionalNextVersionBump(newNextVersion);
        await this.checkoutUpstreamBranch(nextBranch);
        await this.updateProjectVersion(newNextVersion);
        // Create an individual commit for the next version bump. The changelog should go into
        // a separate commit that makes it clear where the changelog is cherry-picked from.
        await this.createCommit(bumpCommitMessage, [
            workspaceRelativePackageJsonPath,
            ...this.getAspectLockFiles(),
        ]);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJhbmNoLW9mZi1uZXh0LWJyYW5jaC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL3B1Ymxpc2gvYWN0aW9ucy9zaGFyZWQvYnJhbmNoLW9mZi1uZXh0LWJyYW5jaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFFNUIsT0FBTyxFQUFDLEtBQUssRUFBRSxHQUFHLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUN4RCxPQUFPLEVBQUMsZ0NBQWdDLEVBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNoRixPQUFPLEVBQWUsOEJBQThCLEVBQUMsTUFBTSxpQ0FBaUMsQ0FBQztBQUU3RixPQUFPLEVBQ0wsNkNBQTZDLEVBQzdDLHFDQUFxQyxHQUN0QyxNQUFNLHlCQUF5QixDQUFDO0FBQ2pDLE9BQU8sRUFBQywwQkFBMEIsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ3pFLE9BQU8sRUFBQyxnQ0FBZ0MsRUFBQyxNQUFNLHNDQUFzQyxDQUFDO0FBQ3RGLE9BQU8sRUFBQyxtQkFBbUIsRUFBQyxNQUFNLDhDQUE4QyxDQUFDO0FBRWpGOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLE9BQWdCLDZCQUE4QixTQUFRLDBCQUEwQjtJQUF0Rjs7UUFJRSw4RUFBOEU7UUFDOUUsbUZBQW1GO1FBQ25GLHFGQUFxRjtRQUM3RSxvQkFBZSxHQUFHLElBQUksMEJBQTBCLENBQ3RELElBQUksbUJBQW1CLENBQUMsRUFBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFDLENBQUMsRUFDakUsSUFBSSxDQUFDLEdBQUcsRUFDUixJQUFJLENBQUMsTUFBTSxFQUNYLElBQUksQ0FBQyxVQUFVLENBQ2hCLENBQUM7UUFDTSxrQkFBYSxHQUFHLElBQUksZ0NBQWdDLENBQzFELElBQUksbUJBQW1CLENBQUMs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QUFJLENBQUMsWUFBWSxDQUFDLGFBQWEsRUFBRSxDQUFDLDhCQUE4QixDQUFDLENBQUMsQ0FBQztRQUV6RSxJQUFJLHNCQUFzQixHQUN4Qix1REFBdUQ7WUFDdkQsR0FBRyxJQUFJLENBQUMsWUFBWSw0REFBNEQ7WUFDaEYsZ0VBQWdFO1lBQ2hFLElBQUksVUFBVSxhQUFhLFVBQVUsOENBQThDLENBQUM7UUFFdEYsTUFBTSxxQkFBcUIsR0FBRyxNQUFNLElBQUksQ0FBQyxxQ0FBcUMsQ0FDNUUsVUFBVSxFQUNWLHNCQUFzQixjQUFjLEVBQUUsRUFDdEMscURBQXFELGNBQWMsSUFBSSxFQUN2RSxzQkFBc0IsQ0FDdkIsQ0FBQztRQUVGLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLHdDQUF3QyxVQUFVLDRCQUE0QixDQUFDLENBQUMsQ0FBQztRQUVoRyxPQUFPLHFCQUFxQixDQUFDO0lBQy9CLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XG5cbmltcG9ydCB7Z3JlZW4sIExvZ30gZnJvbSAnLi4vLi4vLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge3dvcmtzcGFjZVJlbGF0aXZlUGFja2FnZUpzb25QYXRofSBmcm9tICcuLi8uLi8uLi8uLi91dGlscy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHtSZWxlYXNlTm90ZXMsIHdvcmtzcGFjZVJlbGF0aXZlQ2hhbmdlbG9nUGF0aH0gZnJvbSAnLi4vLi4vLi4vbm90ZXMvcmVsZWFzZS1ub3Rlcy5qcyc7XG5pbXBvcnQge1B1bGxSZXF1ZXN0fSBmcm9tICcuLi8uLi9hY3Rpb25zLmpzJztcbmltcG9ydCB7XG4gIGdldENvbW1pdE1lc3NhZ2VGb3JFeGNlcHRpb25hbE5leHRWZXJzaW9uQnVtcCxcbiAgZ2V0UmVsZWFzZU5vdGVDaGVycnlQaWNrQ29tbWl0TWVzc2FnZSxcbn0gZnJvbSAnLi4vLi4vY29tbWl0LW1lc3NhZ2UuanMnO1xuaW1wb3J0IHtDdXROcG1OZXh0UHJlcmVsZWFzZUFjdGlvbn0gZnJvbSAnLi4vY3V0LW5wbS1uZXh0LXByZXJlbGVhc2UuanMnO1xuaW1wb3J0IHtDdXROcG1OZXh0UmVsZWFzZUNhbmRpZGF0ZUFjdGlvbn0gZnJvbSAnLi4vY3V0LW5wbS1uZXh0LXJlbGVhc2UtY2FuZGlkYXRlLmpzJztcbmltcG9ydCB7QWN0aXZlUmVsZWFzZVRyYWluc30gZnJvbSAnLi4vLi4vLi4vdmVyc2lvbmluZy9hY3RpdmUtcmVsZWFzZS10cmFpbnMuanMnO1xuXG4vKipcbiAqIEJhc2UgYWN0aW9uIHRoYXQgY2FuIGJlIHVzZWQgdG8gbW92ZSB0aGUgbmV4dCByZWxlYXNlLXRyYWluIGludG8gdGhlIGRlZGljYXRlZCBGRi9SQ1xuICogcmVsZWFzZS10cmFpbiB3aGlsZSBhbHNvIGN1dHRpbmcgYSByZWxlYXNlIHRvIG1vdmUgdGhlIHRyYWluIGludG8gdGhlIGBmZWF0dXJlLWZyZWV6ZWBcbiAqIG9yIGByZWxlYXNlLWNhbmRpZGF0ZWAgcGhhc2UuXG4gKlxuICogVGhpcyBtZWFucyB0aGF0IGEgbmV3IHZlcnNpb24gYnJhbmNoIGlzIGNyZWF0ZWQgYmFzZWQgb24gdGhlIG5leHQgYnJhbmNoLCBhbmQgYSBuZXdcbiAqIHByZS1yZWxlYXNlIChlaXRoZXIgUkMgb3IgYW5vdGhlciBgbmV4dGApIGlzIGN1dC0gaW5kaWNhdGluZyB0aGUgbmV3IHBoYXNlLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQnJhbmNoT2ZmTmV4dEJyYW5jaEJhc2VBY3Rpb24gZXh0ZW5kcyBDdXROcG1OZXh0UHJlcmVsZWFzZUFjdGlvbiB7XG4gIC8qKiBQaGFzZSB3aGljaCB0aGUgcmVsZWFzZS10cmFpbiBjdXJyZW50bHkgaW4gdGhlIGBuZXh0YCBwaGFzZSB3aWxsIG1vdmUgaW50by4gKi9cbiAgYWJzdHJhY3QgbmV3UGhhc2VOYW1lOiAnZmVhdHVyZS1mcmVlemUnIHwgJ3JlbGVhc2UtY2FuZGlkYXRlJztcblxuICAvLyBJbnN0YW5jZXMgb2YgdGhlIGFjdGlvbiBmb3IgY3V0dGluZyBhIE5QTSBuZXh0IHByZS1yZWxlYXNlcy4gV2Ugd2lsbCByZS11c2VcbiAgLy8gdGhlc2UgZm9yIGRldGVybWluaW5nIHRoZSBcIm5ldyB2ZXJzaW9uc1wiIGFuZCBcInJlbGVhc2Ugbm90ZXMgY29tcGFyaXNvbiB2ZXJzaW9uXCIuXG4gIC8vIFRoaXMgaGVscHMgYXZvaWRpbmcgZHVwbGljYXRpb24sIGVzcGVjaWFsbHkgc2luY2UgdGhlcmUgYXJlIGlzIHNvbWUgc3BlY2lhbCBsb2dpYy5cbiAgcHJpdmF0ZSBfbmV4dFByZXJlbGVhc2UgPSBuZXcgQ3V0TnBtTmV4dFByZXJlbGVhc2VBY3Rpb24oXG4gICAgbmV3IEFjdGl2ZVJlbGVhc2VUcmFpbnMoey4uLnRoaXMuYWN0aXZlLCByZWxlYXNlQ2FuZGlkYXRlOiBudWxsfSksXG4gICAgdGhpcy5naXQsXG4gICAgdGhpcy5jb25maWcsXG4gICAgdGhpcy5wcm9qZWN0RGlyLFxuICApO1xuICBwcml2YXRlIF9yY1ByZXJlbGVhc2UgPSBuZXcgQ3V0TnBtTmV4dFJlbGVhc2VDYW5kaWRhdGVBY3Rpb24oXG4gICAgbmV3IEFjdGl2ZVJlbGVhc2VUcmFpbnMoey4uLnRoaXMuYWN0aXZlLCByZWxlYXNlQ2FuZGlkYXRlOiB0aGlzLmFjdGl2ZS5uZXh0fSksXG4gICAgdGhpcy5naXQsXG4gICAgdGhpcy5jb25maWcsXG4gICAgdGhpcy5wcm9qZWN0RGlyLFxuICApO1xuXG4gIG92ZXJyaWRlIGFzeW5jIGdldERlc2NyaXB0aW9uKCkge1xuICAgIGNvbnN0IHticmFuY2hOYW1lfSA9IHRoaXMuYWN0aXZlLm5leHQ7XG4gICAgY29uc3QgbmV3VmVyc2lvbiA9IGF3YWl0IHRoaXMuX2NvbXB1dGVOZXdWZXJzaW9uKCk7XG4gICAgcmV0dXJuIGBNb3ZlIHRoZSBcIiR7YnJhbmNoTmFtZX1cIiBicmFuY2ggaW50byAke3RoaXMubmV3UGhhc2VOYW1lfSBwaGFzZSAodiR7bmV3VmVyc2lvbn0pLmA7XG4gIH1cblxuICBvdmVycmlkZSBhc3luYyBwZXJmb3JtKCkge1xuICAgIGNvbnN0IG5leHRCcmFuY2hOYW1lID0gdGhpcy5hY3RpdmUubmV4dC5icmFuY2hOYW1lO1xuICAgIGNvbnN0IGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzID0gYXdhaXQgdGhpcy5fY29tcHV0ZVJlbGVhc2VOb3RlQ29tcGFyZVZlcnNpb24oKTtcbiAgICBjb25zdCBuZXdWZXJzaW9uID0gYXdhaXQgdGhpcy5fY29tcHV0ZU5ld1ZlcnNpb24oKTtcbiAgICBjb25zdCBuZXdCcmFuY2ggPSBgJHtuZXdWZXJzaW9uLm1ham9yfS4ke25ld1ZlcnNpb24ubWlub3J9LnhgO1xuICAgIGNvbnN0IGJlZm9yZVN0YWdpbmdTaGEgPSBhd2FpdCB0aGlzLmdldExhdGVzdENvbW1pdE9mQnJhbmNoKG5leHRCcmFuY2hOYW1lKTtcblxuICAgIC8vIFZlcmlmeSB0aGUgY3VycmVudCBuZXh0IGJyYW5jaCBoYXMgYSBwYXNzaW5nIHN0YXR1cywgYmVmb3JlIHdlIGJyYW5jaCBvZmYuXG4gICAgYXdhaXQgdGhpcy5hc3NlcnRQYXNzaW5nR2l0aHViU3RhdHVzKGJlZm9yZVN0YWdpbmdTaGEsIG5leHRCcmFuY2hOYW1lKTtcblxuICAgIC8vIEJyYW5jaC1vZmYgdGhlIG5leHQgYnJhbmNoIGludG8gYSBuZXcgdmVyc2lvbiBicmFuY2guXG4gICAgYXdhaXQgdGhpcy5fY3JlYXRlTmV3VmVyc2lvbkJyYW5jaEZyb21OZXh0KG5ld0JyYW5jaCk7XG5cbiAgICAvLyBTdGFnZSB0aGUgbmV3IHZlcnNpb24gZm9yIHRoZSBuZXdseSBjcmVhdGVkIGJyYW5jaCwgYW5kIHB1c2ggY2hhbmdlcyB0byBhXG4gICAgLy8gZm9yayBpbiBvcmRlciB0byBjcmVhdGUgYSBzdGFnaW5nIHB1bGwgcmVxdWVzdC4gTm90ZSB0aGF0IHdlIHJlLXVzZSB0aGUgbmV3bHlcbiAgICAvLyBjcmVhdGVkIGJyYW5jaCBpbnN0ZWFkIG9mIHJlLWZldGNoaW5nIGZyb20gdGhlIHVwc3RyZWFtLlxuICAgIGNvbnN0IHtwdWxsUmVxdWVzdCwgcmVsZWFzZU5vdGVzLCBidWlsdFBhY2thZ2VzV2l0aEluZm99ID1cbiAgICAgIGF3YWl0IHRoaXMuc3RhZ2VWZXJzaW9uRm9yQnJhbmNoQW5kQ3JlYXRlUHVsbFJlcXVlc3QoXG4gICAgICAgIG5ld1ZlcnNpb24sXG4gICAgICAgIGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzLFxuICAgICAgICBuZXdCcmFuY2gsXG4gICAgICApO1xuXG4gICAgLy8gV2FpdCBmb3IgdGhlIHN0YWdpbmcgUFIgdG8gYmUgbWVyZ2VkLiBUaGVuIHB1Ymxpc2ggdGhlIGZlYXR1cmUtZnJlZXplIG5leHQgcHJlLXJlbGVhc2UuIEZpbmFsbHksXG4gICAgLy8gY2hlcnJ5LXBpY2sgdGhlIHJlbGVhc2Ugbm90ZXMgaW50byB0aGUgbmV4dCBicmFuY2ggaW4gY29tYmluYXRpb24gd2l0aCBidW1waW5nIHRoZSB2ZXJzaW9uIHRvXG4gICAgLy8gdGhlIG5leHQgbWlub3IgdG9vLlxuICAgIGF3YWl0IHRoaXMucHJvbXB0QW5kV2FpdEZvclB1bGxSZXF1ZXN0TWVyZ2VkKHB1bGxSZXF1ZXN0KTtcbiAgICBhd2FpdCB0aGlzLnB1Ymxpc2goYnVpbHRQYWNrYWdlc1dpdGhJbmZvLCByZWxlYXNlTm90ZXMsIGJlZm9yZVN0YWdpbmdTaGEsIG5ld0JyYW5jaCwgJ25leHQnLCB7XG4gICAgICBzaG93QXNMYXRlc3RPbkdpdEh1YjogZmFsc2UsXG4gICAgfSk7XG5cbiAgICBjb25zdCBicmFuY2hPZmZQdWxsUmVxdWVzdCA9IGF3YWl0IHRoaXMuX2NyZWF0ZU5leHRCcmFuY2hVcGRhdGVQdWxsUmVxdWVzdChcbiAgICAgIHJlbGVhc2VOb3RlcyxcbiAgICAgIG5ld1ZlcnNpb24sXG4gICAgKTtcbiAgICBhd2FpdCB0aGlzLnByb21wdEFuZFdhaXRGb3JQdWxsUmVxdWVzdE1lcmdlZChicmFuY2hPZmZQdWxsUmVxdWVzdCk7XG4gIH1cblxuICAvKiogQ29tcHV0ZXMgdGhlIG5ldyB2ZXJzaW9uIGZvciB0aGUgcmVsZWFzZS10cmFpbiBiZWluZyBicmFuY2hlZC1vZmYuICovXG4gIHByaXZhdGUgYXN5bmMgX2NvbXB1dGVOZXdWZXJzaW9uKCk6IFByb21pc2U8c2VtdmVyLlNlbVZlcj4ge1xuICAgIGlmICh0aGlzLm5ld1BoYXNlTmFtZSA9PT0gJ2ZlYXR1cmUtZnJlZXplJykge1xuICAgICAgcmV0dXJuIHRoaXMuX25leHRQcmVyZWxlYXNlLmdldE5ld1ZlcnNpb24oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuX3JjUHJlcmVsZWFzZS5nZXROZXdWZXJzaW9uKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEdldHMgdGhlIHJlbGVhc2Ugbm90ZXMgY29tcGFyZSB2ZXJzaW9uIGZvciB0aGUgYnJhbmNoaW5nLW9mZiByZWxlYXNlLiAqL1xuICBwcml2YXRlIGFzeW5jIF9jb21wdXRlUmVsZWFzZU5vdGVDb21wYXJlVmVyc2lvbigpOiBQcm9taXNlPHNlbXZlci5TZW1WZXI+IHtcbiAgICAvLyBSZWdhcmRsZXNzIG9mIHRoZSBuZXcgcGhhc2UsIHRoZSByZWxlYXNlIG5vdGVzIGNvbXBhcmUgdmVyc2lvbiBzaG91bGRcbiAgICAvLyBhbHdheXMgYmUgdGhlIG9uZSBhcyBpZiBhIHByZS1yZWxlYXNlIGlzIGN1dCBvbiB0aGUgYG5leHRgIGJyYW5jaC5cbiAgICAvLyBXZSBjYW5ub3QgcmVseSBvbiB0aGUgYEN1dE5wbU5leHRSZWxlYXNlQ2FuZGlkYXRlQWN0aW9uYCBoZXJlIGJlY2F1c2UgaXRcbiAgICAvLyBhc3N1bWVzIGEgcHVibGlzaGVkIHJlbGVhc2UgZm9yIHRoZSB0cmFpbi4gVGhpcyBpcyBub3QgZ3VhcmFudGVlZC5cbiAgICByZXR1cm4gYXdhaXQgdGhpcy5fbmV4dFByZXJlbGVhc2UucmVsZWFzZU5vdGVzQ29tcGFyZVZlcnNpb247XG4gIH1cblxuICAvKiogQ3JlYXRlcyBhIG5ldyB2ZXJzaW9uIGJyYW5jaCBmcm9tIHRoZSBuZXh0IGJyYW5jaC4gKi9cbiAgcHJpdmF0ZSBhc3luYyBfY3JlYXRlTmV3VmVyc2lvbkJyYW5jaEZyb21OZXh0KG5ld0JyYW5jaDogc3RyaW5nKSB7XG4gICAgY29uc3Qge2JyYW5jaE5hbWU6IG5leHRCcmFuY2h9ID0gdGhpcy5hY3RpdmUubmV4dDtcbiAgICBhd2FpdCB0aGlzLmNoZWNrb3V0VXBzdHJlYW1CcmFuY2gobmV4dEJyYW5jaCk7XG4gICAgYXdhaXQgdGhpcy5jcmVhdGVMb2NhbEJyYW5jaEZyb21IZWFkKG5ld0JyYW5jaCk7XG4gICAgYXdhaXQgdGhpcy5wdXNoSGVhZFRvUmVtb3RlQnJhbmNoKG5ld0JyYW5jaCk7XG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgVmVyc2lvbiBicmFuY2ggXCIke25ld0JyYW5jaH1cIiBjcmVhdGVkLmApKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgcHVsbCByZXF1ZXN0IGZvciB0aGUgbmV4dCBicmFuY2ggdGhhdCBidW1wcyB0aGUgdmVyc2lvbiB0byB0aGUgbmV4dFxuICAgKiBtaW5vciwgYW5kIGNoZXJyeS1waWNrcyB0aGUgY2hhbmdlbG9nIGZvciB0aGUgbmV3bHkgYnJhbmNoZWQtb2ZmIHJlbGVhc2UtY2FuZGlkYXRlXG4gICAqIG9yIGZlYXR1cmUtZnJlZXplIHZlcnNpb24uXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIF9jcmVhdGVOZXh0QnJhbmNoVXBkYXRlUHVsbFJlcXVlc3QoXG4gICAgcmVsZWFzZU5vdGVzOiBSZWxlYXNlTm90ZXMsXG4gICAgbmV3VmVyc2lvbjogc2VtdmVyLlNlbVZlcixcbiAgKTogUHJvbWlzZTxQdWxsUmVxdWVzdD4ge1xuICAgIGNvbnN0IHticmFuY2hOYW1lOiBuZXh0QnJhbmNoLCB2ZXJzaW9ufSA9IHRoaXMuYWN0aXZlLm5leHQ7XG4gICAgLy8gV2UgaW5jcmVhc2UgdGhlIHZlcnNpb24gZm9yIHRoZSBuZXh0IGJyYW5jaCB0byB0aGUgbmV4dCBtaW5vci4gVGhlIHRlYW0gY2FuIGRlY2lkZVxuICAgIC8vIGxhdGVyIGlmIHRoZXkgd2FudCBuZXh0IHRvIGJlIGEgbWFqb3IgdGhyb3VnaCB0aGUgYENvbmZpZ3VyZSBOZXh0IGFzIE1ham9yYCByZWxlYXNlIGFjdGlvbi5cbiAgICBjb25zdCBuZXdOZXh0VmVyc2lvbiA9IHNlbXZlci5wYXJzZShgJHt2ZXJzaW9uLm1ham9yfS4ke3ZlcnNpb24ubWlub3IgKyAxfS4wLW5leHQuMGApITtcbiAgICBjb25zdCBidW1wQ29tbWl0TWVzc2FnZSA9IGdldENvbW1pdE1lc3NhZ2VGb3JFeGNlcHRpb25hbE5leHRWZXJzaW9uQnVtcChuZXdOZXh0VmVyc2lvbik7XG5cbiAgICBhd2FpdCB0aGlzLmNoZWNrb3V0VXBzdHJlYW1CcmFuY2gobmV4dEJyYW5jaCk7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVQcm9qZWN0VmVyc2lvbihuZXdOZXh0VmVyc2lvbik7XG5cbiAgICAvLyBDcmVhdGUgYW4gaW5kaXZpZHVhbCBjb21taXQgZm9yIHRoZSBuZXh0IHZlcnNpb24gYnVtcC4gVGhlIGNoYW5nZWxvZyBzaG91bGQgZ28gaW50b1xuICAgIC8vIGEgc2VwYXJhdGUgY29tbWl0IHRoYXQgbWFrZXMgaXQgY2xlYXIgd2hlcmUgdGhlIGNoYW5nZWxvZyBpcyBjaGVycnktcGlja2VkIGZyb20uXG4gICAgYXdhaXQgdGhpcy5jcmVhdGVDb21taXQoYnVtcENvbW1pdE1lc3NhZ2UsIFtcbiAgICAgIHdvcmtzcGFjZVJlbGF0aXZlUGFja2FnZUpzb25QYXRoLFxuICAgICAgLi4udGhpcy5nZXRBc3BlY3RMb2NrRmlsZXMoKSxcbiAgICBdKTtcblxuICAgIGF3YWl0IHRoaXMucHJlcGVuZFJlbGVhc2VOb3Rlc1RvQ2hhbmdlbG9nKHJlbGVhc2VOb3Rlcyk7XG5cbiAgICBjb25zdCBjb21taXRNZXNzYWdlID0gZ2V0UmVsZWFzZU5vdGVDaGVycnlQaWNrQ29tbWl0TWVzc2FnZShyZWxlYXNlTm90ZXMudmVyc2lvbik7XG5cbiAgICBhd2FpdCB0aGlzLmNyZWF0ZUNvbW1pdChjb21taXRNZXNzYWdlLCBbd29ya3NwYWNlUmVsYXRpdmVDaGFuZ2Vsb2dQYXRoXSk7XG5cbiAgICBsZXQgbmV4dFB1bGxSZXF1ZXN0TWVzc2FnZSA9XG4gICAgICBgVGhlIHByZXZpb3VzIFwibmV4dFwiIHJlbGVhc2UtdHJhaW4gaGFzIG1vdmVkIGludG8gdGhlIGAgK1xuICAgICAgYCR7dGhpcy5uZXdQaGFzZU5hbWV9IHBoYXNlLiBUaGlzIFBSIHVwZGF0ZXMgdGhlIG5leHQgYnJhbmNoIHRvIHRoZSBzdWJzZXF1ZW50IGAgK1xuICAgICAgYHJlbGVhc2UtdHJhaW4uXFxuXFxuQWxzbyB0aGlzIFBSIGNoZXJyeS1waWNrcyB0aGUgY2hhbmdlbG9nIGZvciBgICtcbiAgICAgIGB2JHtuZXdWZXJzaW9ufSBpbnRvIHRoZSAke25leHRCcmFuY2h9IGJyYW5jaCBzbyB0aGF0IHRoZSBjaGFuZ2Vsb2cgaXMgdXAgdG8gZGF0ZS5gO1xuXG4gICAgY29uc3QgbmV4dFVwZGF0ZVB1bGxSZXF1ZXN0ID0gYXdhaXQgdGhpcy5wdXNoQ2hhbmdlc1RvRm9ya0FuZENyZWF0ZVB1bGxSZXF1ZXN0KFxuICAgICAgbmV4dEJyYW5jaCxcbiAgICAgIGBuZXh0LXJlbGVhc2UtdHJhaW4tJHtuZXdOZXh0VmVyc2lvbn1gLFxuICAgICAgYFVwZGF0ZSBuZXh0IGJyYW5jaCB0byByZWZsZWN0IG5ldyByZWxlYXNlLXRyYWluIFwidiR7bmV3TmV4dFZlcnNpb259XCIuYCxcbiAgICAgIG5leHRQdWxsUmVxdWVzdE1lc3NhZ2UsXG4gICAgKTtcblxuICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIFB1bGwgcmVxdWVzdCBmb3IgdXBkYXRpbmcgdGhlIFwiJHtuZXh0QnJhbmNofVwiIGJyYW5jaCBoYXMgYmVlbiBjcmVhdGVkLmApKTtcblxuICAgIHJldHVybiBuZXh0VXBkYXRlUHVsbFJlcXVlc3Q7XG4gIH1cbn1cbiJdfQ==