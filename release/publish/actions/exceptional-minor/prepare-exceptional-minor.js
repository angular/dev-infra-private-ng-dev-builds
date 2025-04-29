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
        const { sha: latestBaseBranchSha } = await this.getLatestCommitOfBranch(this._baseBranch);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlcGFyZS1leGNlcHRpb25hbC1taW5vci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL3B1Ymxpc2gvYWN0aW9ucy9leGNlcHRpb25hbC1taW5vci9wcmVwYXJlLWV4Y2VwdGlvbmFsLW1pbm9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUMsZ0NBQWdDLEVBQUMsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNoRixPQUFPLEVBQUMsS0FBSyxFQUFFLEdBQUcsRUFBQyxNQUFNLDhCQUE4QixDQUFDO0FBRXhELE9BQU8sRUFBQyxnQ0FBZ0MsRUFBQyxNQUFNLHlDQUF5QyxDQUFDO0FBQ3pGLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUUvQzs7Ozs7Ozs7Ozs7R0FXRztBQUNILE1BQU0sT0FBTyw2QkFBOEIsU0FBUSxhQUFhO0lBQWhFOztRQUNVLFdBQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUM1QixnQkFBVyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO1FBQ3JDLGtCQUFhLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7UUFDcEMsZUFBVSxHQUFHLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUM7UUFDN0UsZ0JBQVcsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUNoQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxHQUFHLENBQUMsV0FBVyxDQUN0RSxDQUFDO0lBeUNMLENBQUM7SUF2Q0MsS0FBSyxDQUFDLGNBQWM7UUFDbEIsT0FBTyx1REFBdUQsSUFBSSxDQUFDLFdBQVcsYUFBYSxJQUFJLENBQUMsVUFBVSxJQUFJLENBQUM7SUFDakgsQ0FBQztJQUVELEtBQUssQ0FBQyxPQUFPO1FBQ1gsTUFBTSxFQUFDLEdBQUcsRUFBRSxtQkFBbUIsRUFBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUV4RixNQUFNLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFNUUsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3BELE1BQU0sSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUN0RCxNQUFNLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDNUQsT0FBTyxDQUFDLGdDQUFnQyxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQ25ELENBQUMsQ0FBQyxDQUFDO1FBRUgsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLDRDQUE0QyxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUU7WUFDckYsZ0NBQWdDO1lBQ2hDLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixFQUFFO1NBQzdCLENBQUMsQ0FBQztRQUVILE1BQU0sSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUVuRCxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsSUFBSSxDQUFDLFVBQVUsWUFBWSxDQUFDLENBQUMsQ0FBQztRQUN0RSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxzREFBc0QsQ0FBQyxDQUFDLENBQUM7SUFDMUUsQ0FBQztJQUVELE1BQU0sQ0FBVSxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQTJCO1FBQ3hELElBQUksTUFBTSxDQUFDLGdCQUFnQixLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3JDLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUNELGlFQUFpRTtRQUNqRSw0QkFBNEI7UUFDNUIsSUFBSSxNQUFNLENBQUMsZ0JBQWdCLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDckMsT0FBTyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDO1FBQ3pDLENBQUM7UUFDRCxrRUFBa0U7UUFDbEUsbUNBQW1DO1FBQ25DLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDN0IsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBzZW12ZXIgZnJvbSAnc2VtdmVyJztcbmltcG9ydCB7d29ya3NwYWNlUmVsYXRpdmVQYWNrYWdlSnNvblBhdGh9IGZyb20gJy4uLy4uLy4uLy4uL3V0aWxzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQge2dyZWVuLCBMb2d9IGZyb20gJy4uLy4uLy4uLy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuaW1wb3J0IHtBY3RpdmVSZWxlYXNlVHJhaW5zfSBmcm9tICcuLi8uLi8uLi92ZXJzaW9uaW5nL2FjdGl2ZS1yZWxlYXNlLXRyYWlucy5qcyc7XG5pbXBvcnQge2V4Y2VwdGlvbmFsTWlub3JQYWNrYWdlSW5kaWNhdG9yfSBmcm9tICcuLi8uLi8uLi92ZXJzaW9uaW5nL3ZlcnNpb24tYnJhbmNoZXMuanMnO1xuaW1wb3J0IHtSZWxlYXNlQWN0aW9ufSBmcm9tICcuLi8uLi9hY3Rpb25zLmpzJztcblxuLyoqXG4gKiBSZWxlYXNlIGFjdGlvbiBmb3IgaW5pdGlhdGluZyBhbiBleGNlcHRpb25hbCBtaW5vciByZWxlYXNlLXRyYWluLiBUaGlzXG4gKiBhY3Rpb24gaXMgYWN0aXZlIHdoZW4gYSBuZXcgbWFqb3IgaXMgYWxyZWFkeSBpbi1wcm9ncmVzcyBidXQgYW5vdGhlclxuICogbWlub3IgaXMgc3VkZGVubHkgbmVlZGVkIGZvciB0aGUgcHJldmlvdXMgbWFqb3IuXG4gKlxuICogVGhlIGFjdGlvbiB3aWxsIGNyZWF0ZSBhIG5ldyBicmFuY2ggYmFzZWQgb24gdGhlIGV4aXN0aW5nIFwibGF0ZXN0XCJcbiAqIHJlbGVhc2UtdHJhaW4uIE5vIHJlbGVhc2Ugd2lsbCBiZSBwdWJsaXNoZWQgaW1tZWRpYXRlbHkgdG8gYWxsb3cgZm9yXG4gKiBjaGFuZ2VzIHRvIGJlIG1hZGUuIE9uY2UgY2hhbmdlcyBoYXZlIGJlZW4gbWFkZSwgYW4gZXhjZXB0aW9uYWwgbWlub3JcbiAqIGNhbiBzd2l0Y2ggaW50byB0aGUgYHJlbGVhc2UtY2FuZGlkYXRlYCBwaGFzZSwgYW5kIHRoZW4gYmVjb21lIFwibGF0ZXN0XCIuXG4gKlxuICogTW9yZSBkZXRhaWxzIGNhbiBiZSBmb3VuZCBoZXJlOiBodHRwOi8vZ28vYW5ndWxhci1leGNlcHRpb25hbC1taW5vci5cbiAqL1xuZXhwb3J0IGNsYXNzIFByZXBhcmVFeGNlcHRpb25hbE1pbm9yQWN0aW9uIGV4dGVuZHMgUmVsZWFzZUFjdGlvbiB7XG4gIHByaXZhdGUgX3BhdGNoID0gdGhpcy5hY3RpdmUubGF0ZXN0O1xuICBwcml2YXRlIF9iYXNlQnJhbmNoID0gdGhpcy5fcGF0Y2guYnJhbmNoTmFtZTtcbiAgcHJpdmF0ZSBfcGF0Y2hWZXJzaW9uID0gdGhpcy5fcGF0Y2gudmVyc2lvbjtcbiAgcHJpdmF0ZSBfbmV3QnJhbmNoID0gYCR7dGhpcy5fcGF0Y2hWZXJzaW9uLm1ham9yfS4ke3RoaXMuX3BhdGNoVmVyc2lvbi5taW5vciArIDF9LnhgO1xuICBwcml2YXRlIF9uZXdWZXJzaW9uID0gc2VtdmVyLnBhcnNlKFxuICAgIGAke3RoaXMuX3BhdGNoVmVyc2lvbi5tYWpvcn0uJHt0aGlzLl9wYXRjaFZlcnNpb24ubWlub3IgKyAxfS4wLW5leHQuMGAsXG4gICkhO1xuXG4gIGFzeW5jIGdldERlc2NyaXB0aW9uKCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIGBQcmVwYXJlIGFuIGV4Y2VwdGlvbmFsIG1pbm9yIGJhc2VkIG9uIHRoZSBleGlzdGluZyBcIiR7dGhpcy5fYmFzZUJyYW5jaH1cIiBicmFuY2ggKCR7dGhpcy5fbmV3QnJhbmNofSkuYDtcbiAgfVxuXG4gIGFzeW5jIHBlcmZvcm0oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qge3NoYTogbGF0ZXN0QmFzZUJyYW5jaFNoYX0gPSBhd2FpdCB0aGlzLmdldExhdGVzdENvbW1pdE9mQnJhbmNoKHRoaXMuX2Jhc2VCcmFuY2gpO1xuXG4gICAgYXdhaXQgdGhpcy5hc3NlcnRQYXNzaW5nR2l0aHViU3RhdHVzKGxhdGVzdEJhc2VCcmFuY2hTaGEsIHRoaXMuX2Jhc2VCcmFuY2gpO1xuXG4gICAgYXdhaXQgdGhpcy5jaGVja291dFVwc3RyZWFtQnJhbmNoKHRoaXMuX2Jhc2VCcmFuY2gpO1xuICAgIGF3YWl0IHRoaXMuY3JlYXRlTG9jYWxCcmFuY2hGcm9tSGVhZCh0aGlzLl9uZXdCcmFuY2gpO1xuICAgIGF3YWl0IHRoaXMudXBkYXRlUHJvamVjdFZlcnNpb24odGhpcy5fbmV3VmVyc2lvbiwgKHBrZ0pzb24pID0+IHtcbiAgICAgIHBrZ0pzb25bZXhjZXB0aW9uYWxNaW5vclBhY2thZ2VJbmRpY2F0b3JdID0gdHJ1ZTtcbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMuY3JlYXRlQ29tbWl0KGBidWlsZDogcHJlcGFyZSBleGNlcHRpb25hbCBtaW5vciBicmFuY2g6ICR7dGhpcy5fbmV3QnJhbmNofWAsIFtcbiAgICAgIHdvcmtzcGFjZVJlbGF0aXZlUGFja2FnZUpzb25QYXRoLFxuICAgICAgLi4udGhpcy5nZXRBc3BlY3RMb2NrRmlsZXMoKSxcbiAgICBdKTtcblxuICAgIGF3YWl0IHRoaXMucHVzaEhlYWRUb1JlbW90ZUJyYW5jaCh0aGlzLl9uZXdCcmFuY2gpO1xuXG4gICAgTG9nLmluZm8oZ3JlZW4oYCAg4pyTICAgVmVyc2lvbiBicmFuY2ggXCIke3RoaXMuX25ld0JyYW5jaH1cIiBjcmVhdGVkLmApKTtcbiAgICBMb2cuaW5mbyhncmVlbihgICAgICAgRXhjZXB0aW9uYWwgbWlub3IgcmVsZWFzZS10cmFpbiBpcyBub3cgYWN0aXZlLmApKTtcbiAgfVxuXG4gIHN0YXRpYyBvdmVycmlkZSBhc3luYyBpc0FjdGl2ZShhY3RpdmU6IEFjdGl2ZVJlbGVhc2VUcmFpbnMpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBpZiAoYWN0aXZlLmV4Y2VwdGlvbmFsTWlub3IgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gSWYgYSBGRi9SQyB0cmFpbiBpcyBpbi1wcm9ncmVzcyBhbmQgaXQncyBmb3IgYSBtYWpvciwgd2UgYWxsb3dcbiAgICAvLyBmb3IgYW4gZXhjZXB0aW9uYWwgbWlub3IuXG4gICAgaWYgKGFjdGl2ZS5yZWxlYXNlQ2FuZGlkYXRlICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gYWN0aXZlLnJlbGVhc2VDYW5kaWRhdGUuaXNNYWpvcjtcbiAgICB9XG4gICAgLy8gT3RoZXJ3aXNlIGlmIHRoZXJlIGlzIG5vIEZGL1JDIHRyYWluIGFuZCBgbmV4dGAgaXMgZm9yIGEgbWFqb3IsXG4gICAgLy8gYW4gZXhjZXB0aW9uYWwgbWlub3IgaXMgYWxsb3dlZC5cbiAgICByZXR1cm4gYWN0aXZlLm5leHQuaXNNYWpvcjtcbiAgfVxufVxuIl19