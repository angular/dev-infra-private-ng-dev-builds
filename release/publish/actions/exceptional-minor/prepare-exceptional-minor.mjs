/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import semver from 'semver';
import { workspaceRelativePackageJsonPath } from '../../../../utils/constants.js';
import { green, Log } from '../../../../utils/logging.js';
import { exceptionalMinorPackageIndicator } from '../../../versioning/version-branches.js';
import { ReleaseAction } from '../../actions.js';
/**
 * Release action for initiating an exceptional minor release-train. This
 * action is active when a new major is already in-progress but another
 * minor is suddenly needed for the previous major.
 *
 * The action will create a new branch based on the existing "latest"
 * release-train. No release will be published immediately to allow for
 * changes to be made. Once changes have been made, an exceptional minor
 * can switch into the `release-candidate` phase, and then become "latest".
 *
 * More details can be found here: http://go/angular-exceptional-minor.
 */
export class PrepareExceptionalMinorAction extends ReleaseAction {
    constructor() {
        super(...arguments);
        this._patch = this.active.latest;
        this._baseBranch = this._patch.branchName;
        this._patchVersion = this._patch.version;
        this._newBranch = `${this._patchVersion.major}.${this._patchVersion.minor + 1}.x`;
        this._newVersion = semver.parse(`${this._patchVersion.major}.${this._patchVersion.minor + 1}.0-next.0`);
    }
    async getDescription() {
        return `Prepare an exceptional minor based on the existing "${this._baseBranch}" branch (${this._newBranch}).`;
    }
    async perform() {
        const latestBaseBranchSha = await this.getLatestCommitOfBranch(this._baseBranch);
        await this.assertPassingGithubStatus(latestBaseBranchSha, this._baseBranch);
        await this.checkoutUpstreamBranch(this._baseBranch);
        await this.createLocalBranchFromHead(this._newBranch);
        await this.updateProjectVersion(this._newVersion, (pkgJson) => {
            pkgJson[exceptionalMinorPackageIndicator] = true;
        });
        await this.createCommit(`build: prepare exceptional minor branch: ${this._newBranch}`, [
            workspaceRelativePackageJsonPath,
            ...this.getAspectLockFiles(),
        ]);
        await this.pushHeadToRemoteBranch(this._newBranch);
        Log.info(green(`  ✓   Version branch "${this._newBranch}" created.`));
        Log.info(green(`      Exceptional minor release-train is now active.`));
    }
    static async isActive(active) {
        if (active.exceptionalMinor !== null) {
            return false;
        }
        // If a FF/RC train is in-progress and it's for a major, we allow
        // for an exceptional minor.
        if (active.releaseCandidate !== null) {
            return active.releaseCandidate.isMajor;
        }
        // Otherwise if there is no FF/RC train and `next` is for a major,
        // an exceptional minor is allowed.
        return active.next.isMajor;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlcGFyZS1leGNlcHRpb25hbC1taW5vci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL3B1Ymxpc2gvYWN0aW9ucy9leGNlcHRpb25hbC1taW5vci9wcmVwYXJlLWV4Y2VwdGlvbmFsLW1pbm9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUMsZ0NBQWdDLEVBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNoRixPQUFPLEVBQUMsS0FBSyxFQUFFLEdBQUcsRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBRXhELE9BQU8sRUFBQyxnQ0FBZ0MsRUFBQyxNQUFNLHlDQUF5QyxDQUFDO0FBQ3pGLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUUvQzs7Ozs7Ozs7Ozs7R0FXRztBQUNILE1BQU0sT0FBTyw2QkFBOEIsU0FBUSxhQUFhO0lBQWhFOztRQUNVLFdBQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUM1QixnQkFBVyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO1FBQ3JDLGtCQUFhLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7UUFDcEMsZUFBVSxHQUFHLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUM7UUFDN0UsZ0JBQVcsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUNoQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxHQUFHLENBQUMsV0FBVyxDQUN0RSxDQUFDO0lBeUNMLENBQUM7SUF2Q0MsS0FBSyxDQUFDLGNBQWM7UUFDbEIsT0FBTyx1REFBdUQsSUFBSSxDQUFDLFdBQVcsYUFBYSxJQUFJLENBQUMsVUFBVSxJQUFJLENBQUM7SUFDakgsQ0FBQztJQUVELEtBQUssQ0FBQyxPQUFPO1FBQ1gsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFakYsTUFBTSxJQUFJLENBQUMseUJBQXlCLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRTVFLE1BQU0sSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNwRCxNQUFNLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDdEQsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFO1lBQzVELE9BQU8sQ0FBQyxnQ0FBZ0MsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUNuRCxDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyw0Q0FBNEMsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFO1lBQ3JGLGdDQUFnQztZQUNoQyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtTQUM3QixDQUFDLENBQUM7UUFFSCxNQUFNLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFbkQsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMseUJBQXlCLElBQUksQ0FBQyxVQUFVLFlBQVksQ0FBQyxDQUFDLENBQUM7UUFDdEUsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsc0RBQXNELENBQUMsQ0FBQyxDQUFDO0lBQzFFLENBQUM7SUFFRCxNQUFNLENBQVUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUEyQjtRQUN4RCxJQUFJLE1BQU0sQ0FBQyxnQkFBZ0IsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUNyQyxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFDRCxpRUFBaUU7UUFDakUsNEJBQTRCO1FBQzVCLElBQUksTUFBTSxDQUFDLGdCQUFnQixLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3JDLE9BQU8sTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQztRQUN6QyxDQUFDO1FBQ0Qsa0VBQWtFO1FBQ2xFLG1DQUFtQztRQUNuQyxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO0lBQzdCLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XG5pbXBvcnQge3dvcmtzcGFjZVJlbGF0aXZlUGFja2FnZUpzb25QYXRofSBmcm9tICcuLi8uLi8uLi8uLi91dGlscy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHtncmVlbiwgTG9nfSBmcm9tICcuLi8uLi8uLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7QWN0aXZlUmVsZWFzZVRyYWluc30gZnJvbSAnLi4vLi4vLi4vdmVyc2lvbmluZy9hY3RpdmUtcmVsZWFzZS10cmFpbnMuanMnO1xuaW1wb3J0IHtleGNlcHRpb25hbE1pbm9yUGFja2FnZUluZGljYXRvcn0gZnJvbSAnLi4vLi4vLi4vdmVyc2lvbmluZy92ZXJzaW9uLWJyYW5jaGVzLmpzJztcbmltcG9ydCB7UmVsZWFzZUFjdGlvbn0gZnJvbSAnLi4vLi4vYWN0aW9ucy5qcyc7XG5cbi8qKlxuICogUmVsZWFzZSBhY3Rpb24gZm9yIGluaXRpYXRpbmcgYW4gZXhjZXB0aW9uYWwgbWlub3IgcmVsZWFzZS10cmFpbi4gVGhpc1xuICogYWN0aW9uIGlzIGFjdGl2ZSB3aGVuIGEgbmV3IG1ham9yIGlzIGFscmVhZHkgaW4tcHJvZ3Jlc3MgYnV0IGFub3RoZXJcbiAqIG1pbm9yIGlzIHN1ZGRlbmx5IG5lZWRlZCBmb3IgdGhlIHByZXZpb3VzIG1ham9yLlxuICpcbiAqIFRoZSBhY3Rpb24gd2lsbCBjcmVhdGUgYSBuZXcgYnJhbmNoIGJhc2VkIG9uIHRoZSBleGlzdGluZyBcImxhdGVzdFwiXG4gKiByZWxlYXNlLXRyYWluLiBObyByZWxlYXNlIHdpbGwgYmUgcHVibGlzaGVkIGltbWVkaWF0ZWx5IHRvIGFsbG93IGZvclxuICogY2hhbmdlcyB0byBiZSBtYWRlLiBPbmNlIGNoYW5nZXMgaGF2ZSBiZWVuIG1hZGUsIGFuIGV4Y2VwdGlvbmFsIG1pbm9yXG4gKiBjYW4gc3dpdGNoIGludG8gdGhlIGByZWxlYXNlLWNhbmRpZGF0ZWAgcGhhc2UsIGFuZCB0aGVuIGJlY29tZSBcImxhdGVzdFwiLlxuICpcbiAqIE1vcmUgZGV0YWlscyBjYW4gYmUgZm91bmQgaGVyZTogaHR0cDovL2dvL2FuZ3VsYXItZXhjZXB0aW9uYWwtbWlub3IuXG4gKi9cbmV4cG9ydCBjbGFzcyBQcmVwYXJlRXhjZXB0aW9uYWxNaW5vckFjdGlvbiBleHRlbmRzIFJlbGVhc2VBY3Rpb24ge1xuICBwcml2YXRlIF9wYXRjaCA9IHRoaXMuYWN0aXZlLmxhdGVzdDtcbiAgcHJpdmF0ZSBfYmFzZUJyYW5jaCA9IHRoaXMuX3BhdGNoLmJyYW5jaE5hbWU7XG4gIHByaXZhdGUgX3BhdGNoVmVyc2lvbiA9IHRoaXMuX3BhdGNoLnZlcnNpb247XG4gIHByaXZhdGUgX25ld0JyYW5jaCA9IGAke3RoaXMuX3BhdGNoVmVyc2lvbi5tYWpvcn0uJHt0aGlzLl9wYXRjaFZlcnNpb24ubWlub3IgKyAxfS54YDtcbiAgcHJpdmF0ZSBfbmV3VmVyc2lvbiA9IHNlbXZlci5wYXJzZShcbiAgICBgJHt0aGlzLl9wYXRjaFZlcnNpb24ubWFqb3J9LiR7dGhpcy5fcGF0Y2hWZXJzaW9uLm1pbm9yICsgMX0uMC1uZXh0LjBgLFxuICApITtcblxuICBhc3luYyBnZXREZXNjcmlwdGlvbigpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiBgUHJlcGFyZSBhbiBleGNlcHRpb25hbCBtaW5vciBiYXNlZCBvbiB0aGUgZXhpc3RpbmcgXCIke3RoaXMuX2Jhc2VCcmFuY2h9XCIgYnJhbmNoICgke3RoaXMuX25ld0JyYW5jaH0pLmA7XG4gIH1cblxuICBhc3luYyBwZXJmb3JtKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGxhdGVzdEJhc2VCcmFuY2hTaGEgPSBhd2FpdCB0aGlzLmdldExhdGVzdENvbW1pdE9mQnJhbmNoKHRoaXMuX2Jhc2VCcmFuY2gpO1xuXG4gICAgYXdhaXQgdGhpcy5hc3NlcnRQYXNzaW5nR2l0aHViU3RhdHVzKGxhdGVzdEJhc2VCcmFuY2hTaGEsIHRoaXMuX2Jhc2VCcmFuY2gpO1xuXG4gICAgYXdhaXQgdGhpcy5jaGVja291dFVwc3RyZWFtQnJhbmNoKHRoaXMuX2Jhc2VCcmFuY2gpO1xuICAgIGF3YWl0IHRoaXMuY3JlYXRlTG9jYWxCcmFuY2hGcm9tSGVhZCh0aGlzLl9uZXdCcmFuY2gpO1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUHJvamVjdFZlcnNpb24odGhpcy5fbmV3VmVyc2lvbiwgKHBrZ0pzb24pID0+IHtcbiAgICAgIHBrZ0pzb25bZXhjZXB0aW9uYWxNaW5vclBhY2thZ2VJbmRpY2F0b3JdID0gdHJ1ZTtcbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMuY3JlYXRlQ29tbWl0KGBidWlsZDogcHJlcGFyZSBleGNlcHRpb25hbCBtaW5vciBicmFuY2g6ICR7dGhpcy5fbmV3QnJhbmNofWAsIFtcbiAgICAgIHdvcmtzcGFjZVJlbGF0aXZlUGFja2FnZUpzb25QYXRoLFxuICAgICAgLi4udGhpcy5nZXRBc3BlY3RMb2NrRmlsZXMoKSxcbiAgICBdKTtcblxuICAgIGF3YWl0IHRoaXMucHVzaEhlYWRUb1JlbW90ZUJyYW5jaCh0aGlzLl9uZXdCcmFuY2gpO1xuXG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgVmVyc2lvbiBicmFuY2ggXCIke3RoaXMuX25ld0JyYW5jaH1cIiBjcmVhdGVkLmApKTtcbiAgICBMb2cuaW5mbyhncmVlbihgICAgICAgRXhjZXB0aW9uYWwgbWlub3IgcmVsZWFzZS10cmFpbiBpcyBub3cgYWN0aXZlLmApKTtcbiAgfVxuXG4gIHN0YXRpYyBvdmVycmlkZSBhc3luYyBpc0FjdGl2ZShhY3RpdmU6IEFjdGl2ZVJlbGVhc2VUcmFpbnMpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBpZiAoYWN0aXZlLmV4Y2VwdGlvbmFsTWlub3IgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gSWYgYSBGRi9SQyB0cmFpbiBpcyBpbi1wcm9ncmVzcyBhbmQgaXQncyBmb3IgYSBtYWpvciwgd2UgYWxsb3dcbiAgICAvLyBmb3IgYW4gZXhjZXB0aW9uYWwgbWlub3IuXG4gICAgaWYgKGFjdGl2ZS5yZWxlYXNlQ2FuZGlkYXRlICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gYWN0aXZlLnJlbGVhc2VDYW5kaWRhdGUuaXNNYWpvcjtcbiAgICB9XG4gICAgLy8gT3RoZXJ3aXNlIGlmIHRoZXJlIGlzIG5vIEZGL1JDIHRyYWluIGFuZCBgbmV4dGAgaXMgZm9yIGEgbWFqb3IsXG4gICAgLy8gYW4gZXhjZXB0aW9uYWwgbWlub3IgaXMgYWxsb3dlZC5cbiAgICByZXR1cm4gYWN0aXZlLm5leHQuaXNNYWpvcjtcbiAgfVxufVxuIl19