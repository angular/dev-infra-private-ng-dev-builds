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
import { updateRenovateConfig } from '../renovate-config-updates.js';
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
        const { sha: beforeStagingSha } = await this.getLatestCommitOfBranch(nextBranchName);
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
        const filesToCommit = [
            workspaceRelativePackageJsonPath,
            ...this.getAspectLockFiles(),
        ];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJhbmNoLW9mZi1uZXh0LWJyYW5jaC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL3B1Ymxpc2gvYWN0aW9ucy9zaGFyZWQvYnJhbmNoLW9mZi1uZXh0LWJyYW5jaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFFNUIsT0FBTyxFQUFDLEtBQUssRUFBRSxHQUFHLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUN4RCxPQUFPLEVBQUMsZ0NBQWdDLEVBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNoRixPQUFPLEVBQWUsOEJBQThCLEVBQUMsTUFBTSxpQ0FBaUMsQ0FBQztBQUU3RixPQUFPLEVBQ0wsNkNBQTZDLEVBQzdDLHFDQUFxQyxHQUN0QyxNQUFNLHlCQUF5QixDQUFDO0FBQ2pDLE9BQU8sRUFBQywwQkFBMEIsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBQ3pFLE9BQU8sRUFBQyxnQ0FBZ0MsRUFBQyxNQUFNLHNDQUFzQyxDQUFDO0FBQ3RGLE9BQU8sRUFBQyxtQkFBbUIsRUFBQyxNQUFNLDhDQUE4QyxDQUFDO0FBQ2pGLE9BQU8sRUFBQyxvQkFBb0IsRUFBQyxNQUFNLCtCQUErQixDQUFDO0FBRW5FOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLE9BQWdCLDZCQUE4QixTQUFRLDBCQUEwQjtJQUF0Rjs7UUFJRSw4RUFBOEU7UUFDOUUsbUZBQW1GO1FBQ25GLHFGQUFxRjtRQUM3RSxvQkFBZSxHQUFHLElBQUksMEJBQTBCLENBQ3RELElBQUksbUJBQW1CLENBQUMsRUFBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFDLENBQUMsRUFDakUsSUFBSSxDQUFDLEdBQUcsRUFDUixJQUFJLENBQUMsTUFBTSxFQUNYLElBQUksQ0FBQyxVQUFVLENBQ2hCLENBQUM7UUFDTSxr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LElBQUksT0FBTyxDQUFDLEtBQUssSUFBSSxDQUN0QyxDQUFDO1FBRUYsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO1lBQ3ZCLGFBQWEsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUN6QyxDQUFDO1FBRUQsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLGlCQUFpQixFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQzFELE1BQU0sSUFBSSxDQUFDLDhCQUE4QixDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRXhELE1BQU0sYUFBYSxHQUFHLHFDQUFxQyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVsRixNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsYUFBYSxFQUFFLENBQUMsOEJBQThCLENBQUMsQ0FBQyxDQUFDO1FBRXpFLElBQUksc0JBQXNCLEdBQ3hCLHVEQUF1RDtZQUN2RCxHQUFHLElBQUksQ0FBQyxZQUFZLDREQUE0RDtZQUNoRixnRUFBZ0U7WUFDaEUsSUFBSSxVQUFVLGFBQWEsVUFBVSw4Q0FBOEMsQ0FBQztRQUV0RixNQUFNLHFCQUFxQixHQUFHLE1BQU0sSUFBSSxDQUFDLHFDQUFxQyxDQUM1RSxVQUFVLEVBQ1Ysc0JBQXNCLGNBQWMsRUFBRSxFQUN0QyxxREFBcUQsY0FBYyxJQUFJLEVBQ3ZFLHNCQUFzQixDQUN2QixDQUFDO1FBRUYsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsd0NBQXdDLFVBQVUsNEJBQTRCLENBQUMsQ0FBQyxDQUFDO1FBRWhHLE9BQU8scUJBQXFCLENBQUM7SUFDL0IsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBzZW12ZXIgZnJvbSAnc2VtdmVyJztcblxuaW1wb3J0IHtncmVlbiwgTG9nfSBmcm9tICcuLi8uLi8uLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7d29ya3NwYWNlUmVsYXRpdmVQYWNrYWdlSnNvblBhdGh9IGZyb20gJy4uLy4uLy4uLy4uL3V0aWxzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQge1JlbGVhc2VOb3Rlcywgd29ya3NwYWNlUmVsYXRpdmVDaGFuZ2Vsb2dQYXRofSBmcm9tICcuLi8uLi8uLi9ub3Rlcy9yZWxlYXNlLW5vdGVzLmpzJztcbmltcG9ydCB7UHVsbFJlcXVlc3R9IGZyb20gJy4uLy4uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHtcbiAgZ2V0Q29tbWl0TWVzc2FnZUZvckV4Y2VwdGlvbmFsTmV4dFZlcnNpb25CdW1wLFxuICBnZXRSZWxlYXNlTm90ZUNoZXJyeVBpY2tDb21taXRNZXNzYWdlLFxufSBmcm9tICcuLi8uLi9jb21taXQtbWVzc2FnZS5qcyc7XG5pbXBvcnQge0N1dE5wbU5leHRQcmVyZWxlYXNlQWN0aW9ufSBmcm9tICcuLi9jdXQtbnBtLW5leHQtcHJlcmVsZWFzZS5qcyc7XG5pbXBvcnQge0N1dE5wbU5leHRSZWxlYXNlQ2FuZGlkYXRlQWN0aW9ufSBmcm9tICcuLi9jdXQtbnBtLW5leHQtcmVsZWFzZS1jYW5kaWRhdGUuanMnO1xuaW1wb3J0IHtBY3RpdmVSZWxlYXNlVHJhaW5zfSBmcm9tICcuLi8uLi8uLi92ZXJzaW9uaW5nL2FjdGl2ZS1yZWxlYXNlLXRyYWlucy5qcyc7XG5pbXBvcnQge3VwZGF0ZVJlbm92YXRlQ29uZmlnfSBmcm9tICcuLi9yZW5vdmF0ZS1jb25maWctdXBkYXRlcy5qcyc7XG5cbi8qKlxuICogQmFzZSBhY3Rpb24gdGhhdCBjYW4gYmUgdXNlZCB0byBtb3ZlIHRoZSBuZXh0IHJlbGVhc2UtdHJhaW4gaW50byB0aGUgZGVkaWNhdGVkIEZGL1JDXG4gKiByZWxlYXNlLXRyYWluIHdoaWxlIGFsc28gY3V0dGluZyBhIHJlbGVhc2UgdG8gbW92ZSB0aGUgdHJhaW4gaW50byB0aGUgYGZlYXR1cmUtZnJlZXplYFxuICogb3IgYHJlbGVhc2UtY2FuZGlkYXRlYCBwaGFzZS5cbiAqXG4gKiBUaGlzIG1lYW5zIHRoYXQgYSBuZXcgdmVyc2lvbiBicmFuY2ggaXMgY3JlYXRlZCBiYXNlZCBvbiB0aGUgbmV4dCBicmFuY2gsIGFuZCBhIG5ld1xuICogcHJlLXJlbGVhc2UgKGVpdGhlciBSQyBvciBhbm90aGVyIGBuZXh0YCkgaXMgY3V0LSBpbmRpY2F0aW5nIHRoZSBuZXcgcGhhc2UuXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCcmFuY2hPZmZOZXh0QnJhbmNoQmFzZUFjdGlvbiBleHRlbmRzIEN1dE5wbU5leHRQcmVyZWxlYXNlQWN0aW9uIHtcbiAgLyoqIFBoYXNlIHdoaWNoIHRoZSByZWxlYXNlLXRyYWluIGN1cnJlbnRseSBpbiB0aGUgYG5leHRgIHBoYXNlIHdpbGwgbW92ZSBpbnRvLiAqL1xuICBhYnN0cmFjdCBuZXdQaGFzZU5hbWU6ICdmZWF0dXJlLWZyZWV6ZScgfCAncmVsZWFzZS1jYW5kaWRhdGUnO1xuXG4gIC8vIEluc3RhbmNlcyBvZiB0aGUgYWN0aW9uIGZvciBjdXR0aW5nIGEgTlBNIG5leHQgcHJlLXJlbGVhc2VzLiBXZSB3aWxsIHJlLXVzZVxuICAvLyB0aGVzZSBmb3IgZGV0ZXJtaW5pbmcgdGhlIFwibmV3IHZlcnNpb25zXCIgYW5kIFwicmVsZWFzZSBub3RlcyBjb21wYXJpc29uIHZlcnNpb25cIi5cbiAgLy8gVGhpcyBoZWxwcyBhdm9pZGluZyBkdXBsaWNhdGlvbiwgZXNwZWNpYWxseSBzaW5jZSB0aGVyZSBhcmUgaXMgc29tZSBzcGVjaWFsIGxvZ2ljLlxuICBwcml2YXRlIF9uZXh0UHJlcmVsZWFzZSA9IG5ldyBDdXROcG1OZXh0UHJlcmVsZWFzZUFjdGlvbihcbiAgICBuZXcgQWN0aXZlUmVsZWFzZVRyYWlucyh7Li4udGhpcy5hY3RpdmUsIHJlbGVhc2VDYW5kaWRhdGU6IG51bGx9KSxcbiAgICB0aGlzLmdpdCxcbiAgICB0aGlzLmNvbmZpZyxcbiAgICB0aGlzLnByb2plY3REaXIsXG4gICk7XG4gIHByaXZhdGUgX3JjUHJlcmVsZWFzZSA9IG5ldyBDdXROcG1OZXh0UmVsZWFzZUNhbmRpZGF0ZUFjdGlvbihcbiAgICBuZXcgQWN0aXZlUmVsZWFzZVRyYWlucyh7Li4udGhpcy5hY3RpdmUsIHJlbGVhc2VDYW5kaWRhdGU6IHRoaXMuYWN0aXZlLm5leHR9KSxcbiAgICB0aGlzLmdpdCxcbiAgICB0aGlzLmNvbmZpZyxcbiAgICB0aGlzLnByb2plY3REaXIsXG4gICk7XG5cbiAgb3ZlcnJpZGUgYXN5bmMgZ2V0RGVzY3JpcHRpb24oKSB7XG4gICAgY29uc3Qge2JyYW5jaE5hbWV9ID0gdGhpcy5hY3RpdmUubmV4dDtcbiAgICBjb25zdCBuZXdWZXJzaW9uID0gYXdhaXQgdGhpcy5fY29tcHV0ZU5ld1ZlcnNpb24oKTtcbiAgICByZXR1cm4gYE1vdmUgdGhlIFwiJHticmFuY2hOYW1lfVwiIGJyYW5jaCBpbnRvICR7dGhpcy5uZXdQaGFzZU5hbWV9IHBoYXNlICh2JHtuZXdWZXJzaW9ufSkuYDtcbiAgfVxuXG4gIG92ZXJyaWRlIGFzeW5jIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgbmV4dEJyYW5jaE5hbWUgPSB0aGlzLmFjdGl2ZS5uZXh0LmJyYW5jaE5hbWU7XG4gICAgY29uc3QgY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXMgPSBhd2FpdCB0aGlzLl9jb21wdXRlUmVsZWFzZU5vdGVDb21wYXJlVmVyc2lvbigpO1xuICAgIGNvbnN0IG5ld1ZlcnNpb24gPSBhd2FpdCB0aGlzLl9jb21wdXRlTmV3VmVyc2lvbigpO1xuICAgIGNvbnN0IG5ld0JyYW5jaCA9IGAke25ld1ZlcnNpb24ubWFqb3J9LiR7bmV3VmVyc2lvbi5taW5vcn0ueGA7XG4gICAgY29uc3Qge3NoYTogYmVmb3JlU3RhZ2luZ1NoYX0gPSBhd2FpdCB0aGlzLmdldExhdGVzdENvbW1pdE9mQnJhbmNoKG5leHRCcmFuY2hOYW1lKTtcblxuICAgIC8vIFZlcmlmeSB0aGUgY3VycmVudCBuZXh0IGJyYW5jaCBoYXMgYSBwYXNzaW5nIHN0YXR1cywgYmVmb3JlIHdlIGJyYW5jaCBvZmYuXG4gICAgYXdhaXQgdGhpcy5hc3NlcnRQYXNzaW5nR2l0aHViU3RhdHVzKGJlZm9yZVN0YWdpbmdTaGEsIG5leHRCcmFuY2hOYW1lKTtcblxuICAgIC8vIEJyYW5jaC1vZmYgdGhlIG5leHQgYnJhbmNoIGludG8gYSBuZXcgdmVyc2lvbiBicmFuY2guXG4gICAgYXdhaXQgdGhpcy5fY3JlYXRlTmV3VmVyc2lvbkJyYW5jaEZyb21OZXh0KG5ld0JyYW5jaCk7XG5cbiAgICAvLyBTdGFnZSB0aGUgbmV3IHZlcnNpb24gZm9yIHRoZSBuZXdseSBjcmVhdGVkIGJyYW5jaCwgYW5kIHB1c2ggY2hhbmdlcyB0byBhXG4gICAgLy8gZm9yayBpbiBvcmRlciB0byBjcmVhdGUgYSBzdGFnaW5nIHB1bGwgcmVxdWVzdC4gTm90ZSB0aGF0IHdlIHJlLXVzZSB0aGUgbmV3bHlcbiAgICAvLyBjcmVhdGVkIGJyYW5jaCBpbnN0ZWFkIG9mIHJlLWZldGNoaW5nIGZyb20gdGhlIHVwc3RyZWFtLlxuICAgIGNvbnN0IHtwdWxsUmVxdWVzdCwgcmVsZWFzZU5vdGVzLCBidWlsdFBhY2thZ2VzV2l0aEluZm99ID1cbiAgICAgIGF3YWl0IHRoaXMuc3RhZ2VWZXJzaW9uRm9yQnJhbmNoQW5kQ3JlYXRlUHVsbFJlcXVlc3QoXG4gICAgICAgIG5ld1ZlcnNpb24sXG4gICAgICAgIGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzLFxuICAgICAgICBuZXdCcmFuY2gsXG4gICAgICApO1xuXG4gICAgLy8gV2FpdCBmb3IgdGhlIHN0YWdpbmcgUFIgdG8gYmUgbWVyZ2VkLiBUaGVuIHB1Ymxpc2ggdGhlIGZlYXR1cmUtZnJlZXplIG5leHQgcHJlLXJlbGVhc2UuIEZpbmFsbHksXG4gICAgLy8gY2hlcnJ5LXBpY2sgdGhlIHJlbGVhc2Ugbm90ZXMgaW50byB0aGUgbmV4dCBicmFuY2ggaW4gY29tYmluYXRpb24gd2l0aCBidW1waW5nIHRoZSB2ZXJzaW9uIHRvXG4gICAgLy8gdGhlIG5leHQgbWlub3IgdG9vLlxuICAgIGF3YWl0IHRoaXMucHJvbXB0QW5kV2FpdEZvclB1bGxSZXF1ZXN0TWVyZ2VkKHB1bGxSZXF1ZXN0KTtcbiAgICBhd2FpdCB0aGlzLnB1Ymxpc2goYnVpbHRQYWNrYWdlc1dpdGhJbmZvLCByZWxlYXNlTm90ZXMsIGJlZm9yZVN0YWdpbmdTaGEsIG5ld0JyYW5jaCwgJ25leHQnLCB7XG4gICAgICBzaG93QXNMYXRlc3RPbkdpdEh1YjogZmFsc2UsXG4gICAgfSk7XG5cbiAgICBjb25zdCBicmFuY2hPZmZQdWxsUmVxdWVzdCA9IGF3YWl0IHRoaXMuX2NyZWF0ZU5leHRCcmFuY2hVcGRhdGVQdWxsUmVxdWVzdChcbiAgICAgIHJlbGVhc2VOb3RlcyxcbiAgICAgIG5ld1ZlcnNpb24sXG4gICAgKTtcbiAgICBhd2FpdCB0aGlzLnByb21wdEFuZFdhaXRGb3JQdWxsUmVxdWVzdE1lcmdlZChicmFuY2hPZmZQdWxsUmVxdWVzdCk7XG4gIH1cblxuICAvKiogQ29tcHV0ZXMgdGhlIG5ldyB2ZXJzaW9uIGZvciB0aGUgcmVsZWFzZS10cmFpbiBiZWluZyBicmFuY2hlZC1vZmYuICovXG4gIHByaXZhdGUgYXN5bmMgX2NvbXB1dGVOZXdWZXJzaW9uKCk6IFByb21pc2U8c2VtdmVyLlNlbVZlcj4ge1xuICAgIGlmICh0aGlzLm5ld1BoYXNlTmFtZSA9PT0gJ2ZlYXR1cmUtZnJlZXplJykge1xuICAgICAgcmV0dXJuIHRoaXMuX25leHRQcmVyZWxlYXNlLmdldE5ld1ZlcnNpb24oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuX3JjUHJlcmVsZWFzZS5nZXROZXdWZXJzaW9uKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEdldHMgdGhlIHJlbGVhc2Ugbm90ZXMgY29tcGFyZSB2ZXJzaW9uIGZvciB0aGUgYnJhbmNoaW5nLW9mZiByZWxlYXNlLiAqL1xuICBwcml2YXRlIGFzeW5jIF9jb21wdXRlUmVsZWFzZU5vdGVDb21wYXJlVmVyc2lvbigpOiBQcm9taXNlPHNlbXZlci5TZW1WZXI+IHtcbiAgICAvLyBSZWdhcmRsZXNzIG9mIHRoZSBuZXcgcGhhc2UsIHRoZSByZWxlYXNlIG5vdGVzIGNvbXBhcmUgdmVyc2lvbiBzaG91bGRcbiAgICAvLyBhbHdheXMgYmUgdGhlIG9uZSBhcyBpZiBhIHByZS1yZWxlYXNlIGlzIGN1dCBvbiB0aGUgYG5leHRgIGJyYW5jaC5cbiAgICAvLyBXZSBjYW5ub3QgcmVseSBvbiB0aGUgYEN1dE5wbU5leHRSZWxlYXNlQ2FuZGlkYXRlQWN0aW9uYCBoZXJlIGJlY2F1c2UgaXRcbiAgICAvLyBhc3N1bWVzIGEgcHVibGlzaGVkIHJlbGVhc2UgZm9yIHRoZSB0cmFpbi4gVGhpcyBpcyBub3QgZ3VhcmFudGVlZC5cbiAgICByZXR1cm4gYXdhaXQgdGhpcy5fbmV4dFByZXJlbGVhc2UucmVsZWFzZU5vdGVzQ29tcGFyZVZlcnNpb247XG4gIH1cblxuICAvKiogQ3JlYXRlcyBhIG5ldyB2ZXJzaW9uIGJyYW5jaCBmcm9tIHRoZSBuZXh0IGJyYW5jaC4gKi9cbiAgcHJpdmF0ZSBhc3luYyBfY3JlYXRlTmV3VmVyc2lvbkJyYW5jaEZyb21OZXh0KG5ld0JyYW5jaDogc3RyaW5nKSB7XG4gICAgY29uc3Qge2JyYW5jaE5hbWU6IG5leHRCcmFuY2h9ID0gdGhpcy5hY3RpdmUubmV4dDtcbiAgICBhd2FpdCB0aGlzLmNoZWNrb3V0VXBzdHJlYW1CcmFuY2gobmV4dEJyYW5jaCk7XG4gICAgYXdhaXQgdGhpcy5jcmVhdGVMb2NhbEJyYW5jaEZyb21IZWFkKG5ld0JyYW5jaCk7XG4gICAgYXdhaXQgdGhpcy5wdXNoSGVhZFRvUmVtb3RlQnJhbmNoKG5ld0JyYW5jaCk7XG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgVmVyc2lvbiBicmFuY2ggXCIke25ld0JyYW5jaH1cIiBjcmVhdGVkLmApKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgcHVsbCByZXF1ZXN0IGZvciB0aGUgbmV4dCBicmFuY2ggdGhhdCBidW1wcyB0aGUgdmVyc2lvbiB0byB0aGUgbmV4dFxuICAgKiBtaW5vciwgYW5kIGNoZXJyeS1waWNrcyB0aGUgY2hhbmdlbG9nIGZvciB0aGUgbmV3bHkgYnJhbmNoZWQtb2ZmIHJlbGVhc2UtY2FuZGlkYXRlXG4gICAqIG9yIGZlYXR1cmUtZnJlZXplIHZlcnNpb24uXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIF9jcmVhdGVOZXh0QnJhbmNoVXBkYXRlUHVsbFJlcXVlc3QoXG4gICAgcmVsZWFzZU5vdGVzOiBSZWxlYXNlTm90ZXMsXG4gICAgbmV3VmVyc2lvbjogc2VtdmVyLlNlbVZlcixcbiAgKTogUHJvbWlzZTxQdWxsUmVxdWVzdD4ge1xuICAgIGNvbnN0IHticmFuY2hOYW1lOiBuZXh0QnJhbmNoLCB2ZXJzaW9ufSA9IHRoaXMuYWN0aXZlLm5leHQ7XG4gICAgLy8gV2UgaW5jcmVhc2UgdGhlIHZlcnNpb24gZm9yIHRoZSBuZXh0IGJyYW5jaCB0byB0aGUgbmV4dCBtaW5vci4gVGhlIHRlYW0gY2FuIGRlY2lkZVxuICAgIC8vIGxhdGVyIGlmIHRoZXkgd2FudCBuZXh0IHRvIGJlIGEgbWFqb3IgdGhyb3VnaCB0aGUgYENvbmZpZ3VyZSBOZXh0IGFzIE1ham9yYCByZWxlYXNlIGFjdGlvbi5cbiAgICBjb25zdCBuZXdOZXh0VmVyc2lvbiA9IHNlbXZlci5wYXJzZShgJHt2ZXJzaW9uLm1ham9yfS4ke3ZlcnNpb24ubWlub3IgKyAxfS4wLW5leHQuMGApITtcbiAgICBjb25zdCBidW1wQ29tbWl0TWVzc2FnZSA9IGdldENvbW1pdE1lc3NhZ2VGb3JFeGNlcHRpb25hbE5leHRWZXJzaW9uQnVtcChuZXdOZXh0VmVyc2lvbik7XG5cbiAgICBhd2FpdCB0aGlzLmNoZWNrb3V0VXBzdHJlYW1CcmFuY2gobmV4dEJyYW5jaCk7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVQcm9qZWN0VmVyc2lvbihuZXdOZXh0VmVyc2lvbik7XG5cbiAgICAvLyBDcmVhdGUgYW4gaW5kaXZpZHVhbCBjb21taXQgZm9yIHRoZSBuZXh0IHZlcnNpb24gYnVtcC4gVGhlIGNoYW5nZWxvZyBzaG91bGQgZ28gaW50b1xuICAgIC8vIGEgc2VwYXJhdGUgY29tbWl0IHRoYXQgbWFrZXMgaXQgY2xlYXIgd2hlcmUgdGhlIGNoYW5nZWxvZyBpcyBjaGVycnktcGlja2VkIGZyb20uXG4gICAgY29uc3QgZmlsZXNUb0NvbW1pdDogc3RyaW5nW10gPSBbXG4gICAgICB3b3Jrc3BhY2VSZWxhdGl2ZVBhY2thZ2VKc29uUGF0aCxcbiAgICAgIC4uLnRoaXMuZ2V0QXNwZWN0TG9ja0ZpbGVzKCksXG4gICAgXTtcblxuICAgIGNvbnN0IHJlbm92YXRlQ29uZmlnUGF0aCA9IGF3YWl0IHVwZGF0ZVJlbm92YXRlQ29uZmlnKFxuICAgICAgdGhpcy5wcm9qZWN0RGlyLFxuICAgICAgYCR7dmVyc2lvbi5tYWpvcn0uJHt2ZXJzaW9uLm1pbm9yfS54YCxcbiAgICApO1xuXG4gICAgaWYgKHJlbm92YXRlQ29uZmlnUGF0aCkge1xuICAgICAgZmlsZXNUb0NvbW1pdC5wdXNoKHJlbm92YXRlQ29uZmlnUGF0aCk7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5jcmVhdGVDb21taXQoYnVtcENvbW1pdE1lc3NhZ2UsIGZpbGVzVG9Db21taXQpO1xuICAgIGF3YWl0IHRoaXMucHJlcGVuZFJlbGVhc2VOb3Rlc1RvQ2hhbmdlbG9nKHJlbGVhc2VOb3Rlcyk7XG5cbiAgICBjb25zdCBjb21taXRNZXNzYWdlID0gZ2V0UmVsZWFzZU5vdGVDaGVycnlQaWNrQ29tbWl0TWVzc2FnZShyZWxlYXNlTm90ZXMudmVyc2lvbik7XG5cbiAgICBhd2FpdCB0aGlzLmNyZWF0ZUNvbW1pdChjb21taXRNZXNzYWdlLCBbd29ya3NwYWNlUmVsYXRpdmVDaGFuZ2Vsb2dQYXRoXSk7XG5cbiAgICBsZXQgbmV4dFB1bGxSZXF1ZXN0TWVzc2FnZSA9XG4gICAgICBgVGhlIHByZXZpb3VzIFwibmV4dFwiIHJlbGVhc2UtdHJhaW4gaGFzIG1vdmVkIGludG8gdGhlIGAgK1xuICAgICAgYCR7dGhpcy5uZXdQaGFzZU5hbWV9IHBoYXNlLiBUaGlzIFBSIHVwZGF0ZXMgdGhlIG5leHQgYnJhbmNoIHRvIHRoZSBzdWJzZXF1ZW50IGAgK1xuICAgICAgYHJlbGVhc2UtdHJhaW4uXFxuXFxuQWxzbyB0aGlzIFBSIGNoZXJyeS1waWNrcyB0aGUgY2hhbmdlbG9nIGZvciBgICtcbiAgICAgIGB2JHtuZXdWZXJzaW9ufSBpbnRvIHRoZSAke25leHRCcmFuY2h9IGJyYW5jaCBzbyB0aGF0IHRoZSBjaGFuZ2Vsb2cgaXMgdXAgdG8gZGF0ZS5gO1xuXG4gICAgY29uc3QgbmV4dFVwZGF0ZVB1bGxSZXF1ZXN0ID0gYXdhaXQgdGhpcy5wdXNoQ2hhbmdlc1RvRm9ya0FuZENyZWF0ZVB1bGxSZXF1ZXN0KFxuICAgICAgbmV4dEJyYW5jaCxcbiAgICAgIGBuZXh0LXJlbGVhc2UtdHJhaW4tJHtuZXdOZXh0VmVyc2lvbn1gLFxuICAgICAgYFVwZGF0ZSBuZXh0IGJyYW5jaCB0byByZWZsZWN0IG5ldyByZWxlYXNlLXRyYWluIFwidiR7bmV3TmV4dFZlcnNpb259XCIuYCxcbiAgICAgIG5leHRQdWxsUmVxdWVzdE1lc3NhZ2UsXG4gICAgKTtcblxuICAgIExvZy5pbmZvKGdyZWVuKGAgIOKckyAgIFB1bGwgcmVxdWVzdCBmb3IgdXBkYXRpbmcgdGhlIFwiJHtuZXh0QnJhbmNofVwiIGJyYW5jaCBoYXMgYmVlbiBjcmVhdGVkLmApKTtcblxuICAgIHJldHVybiBuZXh0VXBkYXRlUHVsbFJlcXVlc3Q7XG4gIH1cbn1cbiJdfQ==