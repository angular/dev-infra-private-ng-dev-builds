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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3V0LWx0cy1wYXRjaC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL3B1Ymxpc2gvYWN0aW9ucy9jdXQtbHRzLXBhdGNoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sUUFBUSxNQUFNLFVBQVUsQ0FBQztBQUVoQyxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sMEJBQTBCLENBQUM7QUFFbkQsT0FBTyxFQUNMLG1DQUFtQyxHQUVwQyxNQUFNLHVDQUF1QyxDQUFDO0FBQy9DLE9BQU8sRUFBQyxhQUFhLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFNUM7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyw2QkFBOEIsU0FBUSxhQUFhO0lBQWhFOztRQUNFLHlFQUF5RTtRQUN6RSxnQkFBVyxHQUFHLG1DQUFtQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQTJFakUsQ0FBQztJQXpFVSxLQUFLLENBQUMsY0FBYztRQUMzQixNQUFNLEVBQUMsTUFBTSxFQUFDLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDO1FBQ3hDLE9BQU8sK0NBQStDLE1BQU0sQ0FBQyxNQUFNLFdBQVcsQ0FBQztJQUNqRixDQUFDO0lBRVEsS0FBSyxDQUFDLE9BQU87UUFDcEIsTUFBTSxTQUFTLEdBQUcsTUFBTSxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztRQUN6RCxNQUFNLFVBQVUsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN6RCxNQUFNLDZCQUE2QixHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUM7UUFFeEQsTUFBTSxFQUFDLFdBQVcsRUFBRSxZQUFZLEVBQUUscUJBQXFCLEVBQUUsZ0JBQWdCLEVBQUMsR0FDeEUsTUFBTSxJQUFJLENBQUMsNkJBQTZCLENBQ3RDLFVBQVUsRUFDViw2QkFBNkIsRUFDN0IsU0FBUyxDQUFDLElBQUksQ0FDZixDQUFDO1FBRUosTUFBTSxJQUFJLENBQUMsaUNBQWlDLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDMUQsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUNoQixxQkFBcUIsRUFDckIsWUFBWSxFQUNaLGdCQUFnQixFQUNoQixTQUFTLENBQUMsSUFBSSxFQUNkLFNBQVMsQ0FBQyxVQUFVLEVBQ3BCLEVBQUMsb0JBQW9CLEVBQUUsS0FBSyxFQUFDLENBQzlCLENBQUM7UUFDRixNQUFNLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxZQUFZLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzdFLENBQUM7SUFFRCxpRkFBaUY7SUFDekUsS0FBSyxDQUFDLHlCQUF5QjtRQUNyQyxNQUFNLEVBQUMsTUFBTSxFQUFFLFFBQVEsRUFBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUNsRCxNQUFNLG1CQUFtQixHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBRXhGLHdGQUF3RjtRQUN4RixxRkFBcUY7UUFDckYsa0RBQWtEO1FBQ2xELElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUMxQixtQkFBbUIsQ0FBQyxJQUFJLENBQUMsRUFBQyxJQUFJLEVBQUUseUNBQXlDLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBQyxDQUFDLENBQUM7UUFDM0YsQ0FBQztRQUVELE1BQU0sRUFBQyxlQUFlLEVBQUUsaUJBQWlCLEVBQUMsR0FBRyxNQUFNLFFBQVEsQ0FBQyxNQUFNLENBRy9EO1lBQ0Q7Z0JBQ0UsSUFBSSxFQUFFLGlCQUFpQjtnQkFDdkIsSUFBSSxFQUFFLE1BQU07Z0JBQ1osT0FBTyxFQUFFLGdFQUFnRTtnQkFDekUsT0FBTyxFQUFFLG1CQUFtQjthQUM3QjtZQUNEO2dCQUNFLElBQUksRUFBRSxtQkFBbUI7Z0JBQ3pCLElBQUksRUFBRSxNQUFNO2dCQUNaLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLGVBQWUsS0FBSyxJQUFJO2dCQUN2QyxPQUFPLEVBQUUsOEVBQThFO2dCQUN2RixPQUFPLEVBQUUsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ3ZFO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxlQUFlLElBQUksaUJBQWlCLENBQUM7SUFDOUMsQ0FBQztJQUVELHdEQUF3RDtJQUNoRCxzQkFBc0IsQ0FBQyxNQUFpQjtRQUM5QyxPQUFPLEVBQUMsSUFBSSxFQUFFLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLFVBQVUsTUFBTSxDQUFDLElBQUksR0FBRyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUMsQ0FBQztJQUNqRixDQUFDO0lBRUQsTUFBTSxDQUFVLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBNEI7UUFDekQsK0VBQStFO1FBQy9FLGlGQUFpRjtRQUNqRix3RUFBd0U7UUFDeEUsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IGlucXVpcmVyIGZyb20gJ2lucXVpcmVyJztcblxuaW1wb3J0IHtzZW12ZXJJbmN9IGZyb20gJy4uLy4uLy4uL3V0aWxzL3NlbXZlci5qcyc7XG5pbXBvcnQge0FjdGl2ZVJlbGVhc2VUcmFpbnN9IGZyb20gJy4uLy4uL3ZlcnNpb25pbmcvYWN0aXZlLXJlbGVhc2UtdHJhaW5zLmpzJztcbmltcG9ydCB7XG4gIGZldGNoTG9uZ1Rlcm1TdXBwb3J0QnJhbmNoZXNGcm9tTnBtLFxuICBMdHNCcmFuY2gsXG59IGZyb20gJy4uLy4uL3ZlcnNpb25pbmcvbG9uZy10ZXJtLXN1cHBvcnQuanMnO1xuaW1wb3J0IHtSZWxlYXNlQWN0aW9ufSBmcm9tICcuLi9hY3Rpb25zLmpzJztcblxuLyoqXG4gKiBSZWxlYXNlIGFjdGlvbiB0aGF0IGN1dHMgYSBuZXcgcGF0Y2ggcmVsZWFzZSBmb3IgYW4gYWN0aXZlIHJlbGVhc2UtdHJhaW4gaW4gdGhlIGxvbmctdGVybVxuICogc3VwcG9ydCBwaGFzZS4gVGhlIHBhdGNoIHNlZ21lbnQgaXMgaW5jcmVtZW50ZWQuIFRoZSBjaGFuZ2Vsb2cgaXMgZ2VuZXJhdGVkIGZvciB0aGUgbmV3XG4gKiBwYXRjaCB2ZXJzaW9uLCBidXQgYWxzbyBuZWVkcyB0byBiZSBjaGVycnktcGlja2VkIGludG8gdGhlIG5leHQgZGV2ZWxvcG1lbnQgYnJhbmNoLlxuICovXG5leHBvcnQgY2xhc3MgQ3V0TG9uZ1Rlcm1TdXBwb3J0UGF0Y2hBY3Rpb24gZXh0ZW5kcyBSZWxlYXNlQWN0aW9uIHtcbiAgLyoqIFByb21pc2UgcmVzb2x2aW5nIGFuIG9iamVjdCBkZXNjcmliaW5nIGxvbmctdGVybSBzdXBwb3J0IGJyYW5jaGVzLiAqL1xuICBsdHNCcmFuY2hlcyA9IGZldGNoTG9uZ1Rlcm1TdXBwb3J0QnJhbmNoZXNGcm9tTnBtKHRoaXMuY29uZmlnKTtcblxuICBvdmVycmlkZSBhc3luYyBnZXREZXNjcmlwdGlvbigpIHtcbiAgICBjb25zdCB7YWN0aXZlfSA9IGF3YWl0IHRoaXMubHRzQnJhbmNoZXM7XG4gICAgcmV0dXJuIGBDdXQgYSBuZXcgcmVsZWFzZSBmb3IgYW4gYWN0aXZlIExUUyBicmFuY2ggKCR7YWN0aXZlLmxlbmd0aH0gYWN0aXZlKS5gO1xuICB9XG5cbiAgb3ZlcnJpZGUgYXN5bmMgcGVyZm9ybSgpIHtcbiAgICBjb25zdCBsdHNCcmFuY2ggPSBhd2FpdCB0aGlzLl9wcm9tcHRGb3JUYXJnZXRMdHNCcmFuY2goKTtcbiAgICBjb25zdCBuZXdWZXJzaW9uID0gc2VtdmVySW5jKGx0c0JyYW5jaC52ZXJzaW9uLCAncGF0Y2gnKTtcbiAgICBjb25zdCBjb21wYXJlVmVyc2lvbkZvclJlbGVhc2VOb3RlcyA9IGx0c0JyYW5jaC52ZXJzaW9uO1xuXG4gICAgY29uc3Qge3B1bGxSZXF1ZXN0LCByZWxlYXNlTm90ZXMsIGJ1aWx0UGFja2FnZXNXaXRoSW5mbywgYmVmb3JlU3RhZ2luZ1NoYX0gPVxuICAgICAgYXdhaXQgdGhpcy5jaGVja291dEJyYW5jaEFuZFN0YWdlVmVyc2lvbihcbiAgICAgICAgbmV3VmVyc2lvbixcbiAgICAgICAgY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXMsXG4gICAgICAgIGx0c0JyYW5jaC5uYW1lLFxuICAgICAgKTtcblxuICAgIGF3YWl0IHRoaXMucHJvbXB0QW5kV2FpdEZvclB1bGxSZXF1ZXN0TWVyZ2VkKHB1bGxSZXF1ZXN0KTtcbiAgICBhd2FpdCB0aGlzLnB1Ymxpc2goXG4gICAgICBidWlsdFBhY2thZ2VzV2l0aEluZm8sXG4gICAgICByZWxlYXNlTm90ZXMsXG4gICAgICBiZWZvcmVTdGFnaW5nU2hhLFxuICAgICAgbHRzQnJhbmNoLm5hbWUsXG4gICAgICBsdHNCcmFuY2gubnBtRGlzdFRhZyxcbiAgICAgIHtzaG93QXNMYXRlc3RPbkdpdEh1YjogZmFsc2V9LFxuICAgICk7XG4gICAgYXdhaXQgdGhpcy5jaGVycnlQaWNrQ2hhbmdlbG9nSW50b05leHRCcmFuY2gocmVsZWFzZU5vdGVzLCBsdHNCcmFuY2gubmFtZSk7XG4gIH1cblxuICAvKiogUHJvbXB0cyB0aGUgdXNlciB0byBzZWxlY3QgYW4gTFRTIGJyYW5jaCBmb3Igd2hpY2ggYSBwYXRjaCBzaG91bGQgYnV0IGN1dC4gKi9cbiAgcHJpdmF0ZSBhc3luYyBfcHJvbXB0Rm9yVGFyZ2V0THRzQnJhbmNoKCk6IFByb21pc2U8THRzQnJhbmNoPiB7XG4gICAgY29uc3Qge2FjdGl2ZSwgaW5hY3RpdmV9ID0gYXdhaXQgdGhpcy5sdHNCcmFuY2hlcztcbiAgICBjb25zdCBhY3RpdmVCcmFuY2hDaG9pY2VzID0gYWN0aXZlLm1hcCgoYnJhbmNoKSA9PiB0aGlzLl9nZXRDaG9pY2VGb3JMdHNCcmFuY2goYnJhbmNoKSk7XG5cbiAgICAvLyBJZiB0aGVyZSBhcmUgaW5hY3RpdmUgTFRTIGJyYW5jaGVzLCB3ZSBhbGxvdyB0aGVtIHRvIGJlIHNlbGVjdGVkLiBJbiBzb21lIHNpdHVhdGlvbnMsXG4gICAgLy8gcGF0Y2ggcmVsZWFzZXMgYXJlIHN0aWxsIGN1dCBmb3IgaW5hY3RpdmUgTFRTIGJyYW5jaGVzLiBlLmcuIHdoZW4gdGhlIExUUyBkdXJhdGlvblxuICAgIC8vIGhhcyBiZWVuIGluY3JlYXNlZCBkdWUgdG8gZXhjZXB0aW9uYWwgZXZlbnRzICgpXG4gICAgaWYgKGluYWN0aXZlLmxlbmd0aCAhPT0gMCkge1xuICAgICAgYWN0aXZlQnJhbmNoQ2hvaWNlcy5wdXNoKHtuYW1lOiAnSW5hY3RpdmUgTFRTIHZlcnNpb25zIChub3QgcmVjb21tZW5kZWQpJywgdmFsdWU6IG51bGx9KTtcbiAgICB9XG5cbiAgICBjb25zdCB7YWN0aXZlTHRzQnJhbmNoLCBpbmFjdGl2ZUx0c0JyYW5jaH0gPSBhd2FpdCBpbnF1aXJlci5wcm9tcHQ8e1xuICAgICAgYWN0aXZlTHRzQnJhbmNoOiBMdHNCcmFuY2ggfCBudWxsO1xuICAgICAgaW5hY3RpdmVMdHNCcmFuY2g6IEx0c0JyYW5jaDtcbiAgICB9PihbXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdhY3RpdmVMdHNCcmFuY2gnLFxuICAgICAgICB0eXBlOiAnbGlzdCcsXG4gICAgICAgIG1lc3NhZ2U6ICdQbGVhc2Ugc2VsZWN0IGEgdmVyc2lvbiBmb3Igd2hpY2ggeW91IHdhbnQgdG8gY3V0IGFuIExUUyBwYXRjaCcsXG4gICAgICAgIGNob2ljZXM6IGFjdGl2ZUJyYW5jaENob2ljZXMsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnaW5hY3RpdmVMdHNCcmFuY2gnLFxuICAgICAgICB0eXBlOiAnbGlzdCcsXG4gICAgICAgIHdoZW46IChvKSA9PiBvLmFjdGl2ZUx0c0JyYW5jaCA9PT0gbnVsbCxcbiAgICAgICAgbWVzc2FnZTogJ1BsZWFzZSBzZWxlY3QgYW4gaW5hY3RpdmUgTFRTIHZlcnNpb24gZm9yIHdoaWNoIHlvdSB3YW50IHRvIGN1dCBhbiBMVFMgcGF0Y2gnLFxuICAgICAgICBjaG9pY2VzOiBpbmFjdGl2ZS5tYXAoKGJyYW5jaCkgPT4gdGhpcy5fZ2V0Q2hvaWNlRm9yTHRzQnJhbmNoKGJyYW5jaCkpLFxuICAgICAgfSxcbiAgICBdKTtcbiAgICByZXR1cm4gYWN0aXZlTHRzQnJhbmNoID8/IGluYWN0aXZlTHRzQnJhbmNoO1xuICB9XG5cbiAgLyoqIEdldHMgYW4gaW5xdWlyZXIgY2hvaWNlIGZvciB0aGUgZ2l2ZW4gTFRTIGJyYW5jaC4gKi9cbiAgcHJpdmF0ZSBfZ2V0Q2hvaWNlRm9yTHRzQnJhbmNoKGJyYW5jaDogTHRzQnJhbmNoKToge25hbWU6IHN0cmluZzsgdmFsdWU6IEx0c0JyYW5jaCB8IG51bGx9IHtcbiAgICByZXR1cm4ge25hbWU6IGB2JHticmFuY2gudmVyc2lvbi5tYWpvcn0gKGZyb20gJHticmFuY2gubmFtZX0pYCwgdmFsdWU6IGJyYW5jaH07XG4gIH1cblxuICBzdGF0aWMgb3ZlcnJpZGUgYXN5bmMgaXNBY3RpdmUoX2FjdGl2ZTogQWN0aXZlUmVsZWFzZVRyYWlucykge1xuICAgIC8vIExUUyBwYXRjaCB2ZXJzaW9ucyBjYW4gYmUgb25seSBjdXQgaWYgdGhlcmUgYXJlIHJlbGVhc2UgdHJhaW5zIGluIExUUyBwaGFzZS5cbiAgICAvLyBUaGlzIGFjdGlvbiBpcyBhbHdheXMgc2VsZWN0YWJsZSBhcyB3ZSBzdXBwb3J0IHB1Ymxpc2hpbmcgb2Ygb2xkIExUUyBicmFuY2hlcyxcbiAgICAvLyBhbmQgaGF2ZSBwcm9tcHQgZm9yIHNlbGVjdGluZyBhbiBMVFMgYnJhbmNoIHdoZW4gdGhlIGFjdGlvbiBwZXJmb3Jtcy5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuIl19