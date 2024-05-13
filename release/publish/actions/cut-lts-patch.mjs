/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import inquirer from 'inquirer';
import { semverInc } from '../../../utils/semver.js';
import { fetchLongTermSupportBranchesFromNpm, } from '../../versioning/long-term-support.js';
import { ReleaseAction } from '../actions.js';
/**
 * Release action that cuts a new patch release for an active release-train in the long-term
 * support phase. The patch segment is incremented. The changelog is generated for the new
 * patch version, but also needs to be cherry-picked into the next development branch.
 */
export class CutLongTermSupportPatchAction extends ReleaseAction {
    constructor() {
        super(...arguments);
        /** Promise resolving an object describing long-term support branches. */
        this.ltsBranches = fetchLongTermSupportBranchesFromNpm(this.config);
    }
    async getDescription() {
        const { active } = await this.ltsBranches;
        return `Cut a new release for an active LTS branch (${active.length} active).`;
    }
    async perform() {
        const ltsBranch = await this._promptForTargetLtsBranch();
        const newVersion = semverInc(ltsBranch.version, 'patch');
        const compareVersionForReleaseNotes = ltsBranch.version;
        const { pullRequest, releaseNotes, builtPackagesWithInfo, beforeStagingSha } = await this.checkoutBranchAndStageVersion(newVersion, compareVersionForReleaseNotes, ltsBranch.name);
        await this.promptAndWaitForPullRequestMerged(pullRequest);
        await this.publish(builtPackagesWithInfo, releaseNotes, beforeStagingSha, ltsBranch.name, ltsBranch.npmDistTag, { showAsLatestOnGitHub: false });
        await this.cherryPickChangelogIntoNextBranch(releaseNotes, ltsBranch.name);
    }
    /** Prompts the user to select an LTS branch for which a patch should but cut. */
    async _promptForTargetLtsBranch() {
        const { active, inactive } = await this.ltsBranches;
        const activeBranchChoices = active.map((branch) => this._getChoiceForLtsBranch(branch));
        // If there are inactive LTS branches, we allow them to be selected. In some situations,
        // patch releases are still cut for inactive LTS branches. e.g. when the LTS duration
        // has been increased due to exceptional events ()
        if (inactive.length !== 0) {
            activeBranchChoices.push({ name: 'Inactive LTS versions (not recommended)', value: null });
        }
        const { activeLtsBranch, inactiveLtsBranch } = await inquirer.prompt([
            {
                name: 'activeLtsBranch',
                type: 'list',
                message: 'Please select a version for which you want to cut an LTS patch',
                choices: activeBranchChoices,
            },
            {
                name: 'inactiveLtsBranch',
                type: 'list',
                when: (o) => o.activeLtsBranch === null,
                message: 'Please select an inactive LTS version for which you want to cut an LTS patch',
                choices: inactive.map((branch) => this._getChoiceForLtsBranch(branch)),
            },
        ]);
        return activeLtsBranch ?? inactiveLtsBranch;
    }
    /** Gets an inquirer choice for the given LTS branch. */
    _getChoiceForLtsBranch(branch) {
        return { name: `v${branch.version.major} (from ${branch.name})`, value: branch };
    }
    static async isActive(_active) {
        // LTS patch versions can be only cut if there are release trains in LTS phase.
        // This action is always selectable as we support publishing of old LTS branches,
        // and have prompt for selecting an LTS branch when the action performs.
        return true;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3V0LWx0cy1wYXRjaC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL3B1Ymxpc2gvYWN0aW9ucy9jdXQtbHRzLXBhdGNoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sUUFBNkIsTUFBTSxVQUFVLENBQUM7QUFFckQsT0FBTyxFQUFDLFNBQVMsRUFBQyxNQUFNLDBCQUEwQixDQUFDO0FBRW5ELE9BQU8sRUFDTCxtQ0FBbUMsR0FFcEMsTUFBTSx1Q0FBdUMsQ0FBQztBQUMvQyxPQUFPLEVBQUMsYUFBYSxFQUFDLE1BQU0sZUFBZSxDQUFDO0FBRTVDOzs7O0dBSUc7QUFDSCxNQUFNLE9BQU8sNkJBQThCLFNBQVEsYUFBYTtJQUFoRTs7UUFDRSx5RUFBeUU7UUFDekUsZ0JBQVcsR0FBRyxtQ0FBbUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUEyRWpFLENBQUM7SUF6RVUsS0FBSyxDQUFDLGNBQWM7UUFDM0IsTUFBTSxFQUFDLE1BQU0sRUFBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUN4QyxPQUFPLCtDQUErQyxNQUFNLENBQUMsTUFBTSxXQUFXLENBQUM7SUFDakYsQ0FBQztJQUVRLEtBQUssQ0FBQyxPQUFPO1FBQ3BCLE1BQU0sU0FBUyxHQUFHLE1BQU0sSUFBSSxDQUFDLHlCQUF5QixFQUFFLENBQUM7UUFDekQsTUFBTSxVQUFVLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDekQsTUFBTSw2QkFBNkIsR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDO1FBRXhELE1BQU0sRUFBQyxXQUFXLEVBQUUsWUFBWSxFQUFFLHFCQUFxQixFQUFFLGdCQUFnQixFQUFDLEdBQ3hFLE1BQU0sSUFBSSxDQUFDLDZCQUE2QixDQUN0QyxVQUFVLEVBQ1YsNkJBQTZCLEVBQzdCLFNBQVMsQ0FBQyxJQUFJLENBQ2YsQ0FBQztRQUVKLE1BQU0sSUFBSSxDQUFDLGlDQUFpQyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzFELE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FDaEIscUJBQXFCLEVBQ3JCLFlBQVksRUFDWixnQkFBZ0IsRUFDaEIsU0FBUyxDQUFDLElBQUksRUFDZCxTQUFTLENBQUMsVUFBVSxFQUNwQixFQUFDLG9CQUFvQixFQUFFLEtBQUssRUFBQyxDQUM5QixDQUFDO1FBQ0YsTUFBTSxJQUFJLENBQUMsaUNBQWlDLENBQUMsWUFBWSxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM3RSxDQUFDO0lBRUQsaUZBQWlGO0lBQ3pFLEtBQUssQ0FBQyx5QkFBeUI7UUFDckMsTUFBTSxFQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUM7UUFDbEQsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUV4Rix3RkFBd0Y7UUFDeEYscUZBQXFGO1FBQ3JGLGtEQUFrRDtRQUNsRCxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDMUIsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEVBQUMsSUFBSSxFQUFFLHlDQUF5QyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDO1FBQzNGLENBQUM7UUFFRCxNQUFNLEVBQUMsZUFBZSxFQUFFLGlCQUFpQixFQUFDLEdBQUcsTUFBTSxRQUFRLENBQUMsTUFBTSxDQUcvRDtZQUNEO2dCQUNFLElBQUksRUFBRSxpQkFBaUI7Z0JBQ3ZCLElBQUksRUFBRSxNQUFNO2dCQUNaLE9BQU8sRUFBRSxnRUFBZ0U7Z0JBQ3pFLE9BQU8sRUFBRSxtQkFBbUI7YUFDN0I7WUFDRDtnQkFDRSxJQUFJLEVBQUUsbUJBQW1CO2dCQUN6QixJQUFJLEVBQUUsTUFBTTtnQkFDWixJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxlQUFlLEtBQUssSUFBSTtnQkFDdkMsT0FBTyxFQUFFLDhFQUE4RTtnQkFDdkYsT0FBTyxFQUFFLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsQ0FBQzthQUN2RTtTQUNGLENBQUMsQ0FBQztRQUNILE9BQU8sZUFBZSxJQUFJLGlCQUFpQixDQUFDO0lBQzlDLENBQUM7SUFFRCx3REFBd0Q7SUFDaEQsc0JBQXNCLENBQUMsTUFBaUI7UUFDOUMsT0FBTyxFQUFDLElBQUksRUFBRSxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxVQUFVLE1BQU0sQ0FBQyxJQUFJLEdBQUcsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFDLENBQUM7SUFDakYsQ0FBQztJQUVELE1BQU0sQ0FBVSxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQTRCO1FBQ3pELCtFQUErRTtRQUMvRSxpRkFBaUY7UUFDakYsd0VBQXdFO1FBQ3hFLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCBpbnF1aXJlciwge0xpc3RDaG9pY2VPcHRpb25zfSBmcm9tICdpbnF1aXJlcic7XG5cbmltcG9ydCB7c2VtdmVySW5jfSBmcm9tICcuLi8uLi8uLi91dGlscy9zZW12ZXIuanMnO1xuaW1wb3J0IHtBY3RpdmVSZWxlYXNlVHJhaW5zfSBmcm9tICcuLi8uLi92ZXJzaW9uaW5nL2FjdGl2ZS1yZWxlYXNlLXRyYWlucy5qcyc7XG5pbXBvcnQge1xuICBmZXRjaExvbmdUZXJtU3VwcG9ydEJyYW5jaGVzRnJvbU5wbSxcbiAgTHRzQnJhbmNoLFxufSBmcm9tICcuLi8uLi92ZXJzaW9uaW5nL2xvbmctdGVybS1zdXBwb3J0LmpzJztcbmltcG9ydCB7UmVsZWFzZUFjdGlvbn0gZnJvbSAnLi4vYWN0aW9ucy5qcyc7XG5cbi8qKlxuICogUmVsZWFzZSBhY3Rpb24gdGhhdCBjdXRzIGEgbmV3IHBhdGNoIHJlbGVhc2UgZm9yIGFuIGFjdGl2ZSByZWxlYXNlLXRyYWluIGluIHRoZSBsb25nLXRlcm1cbiAqIHN1cHBvcnQgcGhhc2UuIFRoZSBwYXRjaCBzZWdtZW50IGlzIGluY3JlbWVudGVkLiBUaGUgY2hhbmdlbG9nIGlzIGdlbmVyYXRlZCBmb3IgdGhlIG5ld1xuICogcGF0Y2ggdmVyc2lvbiwgYnV0IGFsc28gbmVlZHMgdG8gYmUgY2hlcnJ5LXBpY2tlZCBpbnRvIHRoZSBuZXh0IGRldmVsb3BtZW50IGJyYW5jaC5cbiAqL1xuZXhwb3J0IGNsYXNzIEN1dExvbmdUZXJtU3VwcG9ydFBhdGNoQWN0aW9uIGV4dGVuZHMgUmVsZWFzZUFjdGlvbiB7XG4gIC8qKiBQcm9taXNlIHJlc29sdmluZyBhbiBvYmplY3QgZGVzY3JpYmluZyBsb25nLXRlcm0gc3VwcG9ydCBicmFuY2hlcy4gKi9cbiAgbHRzQnJhbmNoZXMgPSBmZXRjaExvbmdUZXJtU3VwcG9ydEJyYW5jaGVzRnJvbU5wbSh0aGlzLmNvbmZpZyk7XG5cbiAgb3ZlcnJpZGUgYXN5bmMgZ2V0RGVzY3JpcHRpb24oKSB7XG4gICAgY29uc3Qge2FjdGl2ZX0gPSBhd2FpdCB0aGlzLmx0c0JyYW5jaGVzO1xuICAgIHJldHVybiBgQ3V0IGEgbmV3IHJlbGVhc2UgZm9yIGFuIGFjdGl2ZSBMVFMgYnJhbmNoICgke2FjdGl2ZS5sZW5ndGh9IGFjdGl2ZSkuYDtcbiAgfVxuXG4gIG92ZXJyaWRlIGFzeW5jIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgbHRzQnJhbmNoID0gYXdhaXQgdGhpcy5fcHJvbXB0Rm9yVGFyZ2V0THRzQnJhbmNoKCk7XG4gICAgY29uc3QgbmV3VmVyc2lvbiA9IHNlbXZlckluYyhsdHNCcmFuY2gudmVyc2lvbiwgJ3BhdGNoJyk7XG4gICAgY29uc3QgY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXMgPSBsdHNCcmFuY2gudmVyc2lvbjtcblxuICAgIGNvbnN0IHtwdWxsUmVxdWVzdCwgcmVsZWFzZU5vdGVzLCBidWlsdFBhY2thZ2VzV2l0aEluZm8sIGJlZm9yZVN0YWdpbmdTaGF9ID1cbiAgICAgIGF3YWl0IHRoaXMuY2hlY2tvdXRCcmFuY2hBbmRTdGFnZVZlcnNpb24oXG4gICAgICAgIG5ld1ZlcnNpb24sXG4gICAgICAgIGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzLFxuICAgICAgICBsdHNCcmFuY2gubmFtZSxcbiAgICAgICk7XG5cbiAgICBhd2FpdCB0aGlzLnByb21wdEFuZFdhaXRGb3JQdWxsUmVxdWVzdE1lcmdlZChwdWxsUmVxdWVzdCk7XG4gICAgYXdhaXQgdGhpcy5wdWJsaXNoKFxuICAgICAgYnVpbHRQYWNrYWdlc1dpdGhJbmZvLFxuICAgICAgcmVsZWFzZU5vdGVzLFxuICAgICAgYmVmb3JlU3RhZ2luZ1NoYSxcbiAgICAgIGx0c0JyYW5jaC5uYW1lLFxuICAgICAgbHRzQnJhbmNoLm5wbURpc3RUYWcsXG4gICAgICB7c2hvd0FzTGF0ZXN0T25HaXRIdWI6IGZhbHNlfSxcbiAgICApO1xuICAgIGF3YWl0IHRoaXMuY2hlcnJ5UGlja0NoYW5nZWxvZ0ludG9OZXh0QnJhbmNoKHJlbGVhc2VOb3RlcywgbHRzQnJhbmNoLm5hbWUpO1xuICB9XG5cbiAgLyoqIFByb21wdHMgdGhlIHVzZXIgdG8gc2VsZWN0IGFuIExUUyBicmFuY2ggZm9yIHdoaWNoIGEgcGF0Y2ggc2hvdWxkIGJ1dCBjdXQuICovXG4gIHByaXZhdGUgYXN5bmMgX3Byb21wdEZvclRhcmdldEx0c0JyYW5jaCgpOiBQcm9taXNlPEx0c0JyYW5jaD4ge1xuICAgIGNvbnN0IHthY3RpdmUsIGluYWN0aXZlfSA9IGF3YWl0IHRoaXMubHRzQnJhbmNoZXM7XG4gICAgY29uc3QgYWN0aXZlQnJhbmNoQ2hvaWNlcyA9IGFjdGl2ZS5tYXAoKGJyYW5jaCkgPT4gdGhpcy5fZ2V0Q2hvaWNlRm9yTHRzQnJhbmNoKGJyYW5jaCkpO1xuXG4gICAgLy8gSWYgdGhlcmUgYXJlIGluYWN0aXZlIExUUyBicmFuY2hlcywgd2UgYWxsb3cgdGhlbSB0byBiZSBzZWxlY3RlZC4gSW4gc29tZSBzaXR1YXRpb25zLFxuICAgIC8vIHBhdGNoIHJlbGVhc2VzIGFyZSBzdGlsbCBjdXQgZm9yIGluYWN0aXZlIExUUyBicmFuY2hlcy4gZS5nLiB3aGVuIHRoZSBMVFMgZHVyYXRpb25cbiAgICAvLyBoYXMgYmVlbiBpbmNyZWFzZWQgZHVlIHRvIGV4Y2VwdGlvbmFsIGV2ZW50cyAoKVxuICAgIGlmIChpbmFjdGl2ZS5sZW5ndGggIT09IDApIHtcbiAgICAgIGFjdGl2ZUJyYW5jaENob2ljZXMucHVzaCh7bmFtZTogJ0luYWN0aXZlIExUUyB2ZXJzaW9ucyAobm90IHJlY29tbWVuZGVkKScsIHZhbHVlOiBudWxsfSk7XG4gICAgfVxuXG4gICAgY29uc3Qge2FjdGl2ZUx0c0JyYW5jaCwgaW5hY3RpdmVMdHNCcmFuY2h9ID0gYXdhaXQgaW5xdWlyZXIucHJvbXB0PHtcbiAgICAgIGFjdGl2ZUx0c0JyYW5jaDogTHRzQnJhbmNoIHwgbnVsbDtcbiAgICAgIGluYWN0aXZlTHRzQnJhbmNoOiBMdHNCcmFuY2g7XG4gICAgfT4oW1xuICAgICAge1xuICAgICAgICBuYW1lOiAnYWN0aXZlTHRzQnJhbmNoJyxcbiAgICAgICAgdHlwZTogJ2xpc3QnLFxuICAgICAgICBtZXNzYWdlOiAnUGxlYXNlIHNlbGVjdCBhIHZlcnNpb24gZm9yIHdoaWNoIHlvdSB3YW50IHRvIGN1dCBhbiBMVFMgcGF0Y2gnLFxuICAgICAgICBjaG9pY2VzOiBhY3RpdmVCcmFuY2hDaG9pY2VzLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ2luYWN0aXZlTHRzQnJhbmNoJyxcbiAgICAgICAgdHlwZTogJ2xpc3QnLFxuICAgICAgICB3aGVuOiAobykgPT4gby5hY3RpdmVMdHNCcmFuY2ggPT09IG51bGwsXG4gICAgICAgIG1lc3NhZ2U6ICdQbGVhc2Ugc2VsZWN0IGFuIGluYWN0aXZlIExUUyB2ZXJzaW9uIGZvciB3aGljaCB5b3Ugd2FudCB0byBjdXQgYW4gTFRTIHBhdGNoJyxcbiAgICAgICAgY2hvaWNlczogaW5hY3RpdmUubWFwKChicmFuY2gpID0+IHRoaXMuX2dldENob2ljZUZvckx0c0JyYW5jaChicmFuY2gpKSxcbiAgICAgIH0sXG4gICAgXSk7XG4gICAgcmV0dXJuIGFjdGl2ZUx0c0JyYW5jaCA/PyBpbmFjdGl2ZUx0c0JyYW5jaDtcbiAgfVxuXG4gIC8qKiBHZXRzIGFuIGlucXVpcmVyIGNob2ljZSBmb3IgdGhlIGdpdmVuIExUUyBicmFuY2guICovXG4gIHByaXZhdGUgX2dldENob2ljZUZvckx0c0JyYW5jaChicmFuY2g6IEx0c0JyYW5jaCk6IExpc3RDaG9pY2VPcHRpb25zIHtcbiAgICByZXR1cm4ge25hbWU6IGB2JHticmFuY2gudmVyc2lvbi5tYWpvcn0gKGZyb20gJHticmFuY2gubmFtZX0pYCwgdmFsdWU6IGJyYW5jaH07XG4gIH1cblxuICBzdGF0aWMgb3ZlcnJpZGUgYXN5bmMgaXNBY3RpdmUoX2FjdGl2ZTogQWN0aXZlUmVsZWFzZVRyYWlucykge1xuICAgIC8vIExUUyBwYXRjaCB2ZXJzaW9ucyBjYW4gYmUgb25seSBjdXQgaWYgdGhlcmUgYXJlIHJlbGVhc2UgdHJhaW5zIGluIExUUyBwaGFzZS5cbiAgICAvLyBUaGlzIGFjdGlvbiBpcyBhbHdheXMgc2VsZWN0YWJsZSBhcyB3ZSBzdXBwb3J0IHB1Ymxpc2hpbmcgb2Ygb2xkIExUUyBicmFuY2hlcyxcbiAgICAvLyBhbmQgaGF2ZSBwcm9tcHQgZm9yIHNlbGVjdGluZyBhbiBMVFMgYnJhbmNoIHdoZW4gdGhlIGFjdGlvbiBwZXJmb3Jtcy5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuIl19