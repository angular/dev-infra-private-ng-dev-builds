/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import semver from 'semver';
import { Log } from '../../../../utils/logging.js';
import { Prompt } from '../../../../utils/prompt.js';
import { getLtsNpmDistTagOfMajor } from '../../../versioning/long-term-support.js';
import { convertVersionBranchToSemVer, isVersionBranch, } from '../../../versioning/version-branches.js';
import { FatalReleaseActionError } from '../../actions-error.js';
import { ReleaseAction } from '../../actions.js';
/**
 * SPECIAL: Action should only be used by dev-infra members.
 *
 * Release action that cuts a new minor for an LTS major. The new LTS
 * minor branch is required to be created beforehand.
 */
export class SpecialCutLongTermSupportMinorAction extends ReleaseAction {
    async getDescription() {
        return `SPECIAL: Cut a new release for an LTS minor.`;
    }
    async perform() {
        const ltsBranch = await this._askForVersionBranch('Please specify the target LTS branch:');
        const compareVersionForReleaseNotes = semver.parse(await Prompt.input('Compare version for release'));
        const newVersion = semver.parse(`${ltsBranch.branchVersion.major}.${ltsBranch.branchVersion.minor}.0`);
        const { pullRequest, releaseNotes, builtPackagesWithInfo, beforeStagingSha } = await this.checkoutBranchAndStageVersion(newVersion, compareVersionForReleaseNotes, ltsBranch.branch);
        await this.promptAndWaitForPullRequestMerged(pullRequest);
        await this.publish(builtPackagesWithInfo, releaseNotes, beforeStagingSha, ltsBranch.branch, getLtsNpmDistTagOfMajor(newVersion.major), { showAsLatestOnGitHub: false });
        await this.cherryPickChangelogIntoNextBranch(releaseNotes, ltsBranch.branch);
    }
    async _askForVersionBranch(message) {
        const branch = await Prompt.input(message);
        if (!isVersionBranch(branch)) {
            Log.error('Invalid release branch specified.');
            throw new FatalReleaseActionError();
        }
        const branchVersion = convertVersionBranchToSemVer(branch);
        if (branchVersion === null) {
            Log.error('Could not parse version branch.');
            throw new FatalReleaseActionError();
        }
        return { branch, branchVersion };
    }
    static async isActive(_active) {
        // Only enabled if explicitly enabled for dev-infra team.
        return process.env['NG_DEV_SPECIAL_RELEASE_ACTIONS'] === '1';
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3V0LWx0cy1taW5vci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL3B1Ymxpc2gvYWN0aW9ucy9zcGVjaWFsL2N1dC1sdHMtbWlub3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSw4QkFBOEIsQ0FBQztBQUNqRCxPQUFPLEVBQUMsTUFBTSxFQUFDLE1BQU0sNkJBQTZCLENBQUM7QUFHbkQsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sMENBQTBDLENBQUM7QUFDakYsT0FBTyxFQUNMLDRCQUE0QixFQUM1QixlQUFlLEdBQ2hCLE1BQU0seUNBQXlDLENBQUM7QUFDakQsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDL0QsT0FBTyxFQUFDLGFBQWEsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBRS9DOzs7OztHQUtHO0FBQ0gsTUFBTSxPQUFPLG9DQUFxQyxTQUFRLGFBQWE7SUFDNUQsS0FBSyxDQUFDLGNBQWM7UUFDM0IsT0FBTyw4Q0FBOEMsQ0FBQztJQUN4RCxDQUFDO0lBRVEsS0FBSyxDQUFDLE9BQU87UUFDcEIsTUFBTSxTQUFTLEdBQUcsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsdUNBQXVDLENBQUMsQ0FBQztRQUMzRixNQUFNLDZCQUE2QixHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQ2hELE1BQU0sTUFBTSxDQUFDLEtBQUssQ0FBQyw2QkFBNkIsQ0FBQyxDQUNqRCxDQUFDO1FBRUgsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FDN0IsR0FBRyxTQUFTLENBQUMsYUFBYSxDQUFDLEtBQUssSUFBSSxTQUFTLENBQUMsYUFBYSxDQUFDLEtBQUssSUFBSSxDQUNyRSxDQUFDO1FBRUgsTUFBTSxFQUFDLFdBQVcsRUFBRSxZQUFZLEVBQUUscUJBQXFCLEVBQUUsZ0JBQWdCLEVBQUMsR0FDeEUsTUFBTSxJQUFJLENBQUMsNkJBQTZCLENBQ3RDLFVBQVUsRUFDViw2QkFBNkIsRUFDN0IsU0FBUyxDQUFDLE1BQU0sQ0FDakIsQ0FBQztRQUVKLE1BQU0sSUFBSSxDQUFDLGlDQUFpQyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzFELE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FDaEIscUJBQXFCLEVBQ3JCLFlBQVksRUFDWixnQkFBZ0IsRUFDaEIsU0FBUyxDQUFDLE1BQU0sRUFDaEIsdUJBQXVCLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUN6QyxFQUFDLG9CQUFvQixFQUFFLEtBQUssRUFBQyxDQUM5QixDQUFDO1FBQ0YsTUFBTSxJQUFJLENBQUMsaUNBQWlDLENBQUMsWUFBWSxFQUFFLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMvRSxDQUFDO0lBRU8sS0FBSyxDQUFDLG9CQUFvQixDQUFDLE9BQWU7UUFJaEQsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzNDLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUM3QixHQUFHLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7WUFDL0MsTUFBTSxJQUFJLHVCQUF1QixFQUFFLENBQUM7UUFDdEMsQ0FBQztRQUVELE1BQU0sYUFBYSxHQUFHLDRCQUE0QixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzNELElBQUksYUFBYSxLQUFLLElBQUksRUFBRSxDQUFDO1lBQzNCLEdBQUcsQ0FBQyxLQUFLLENBQUMsaUNBQWlDLENBQUMsQ0FBQztZQUM3QyxNQUFNLElBQUksdUJBQXVCLEVBQUUsQ0FBQztRQUN0QyxDQUFDO1FBQ0QsT0FBTyxFQUFDLE1BQU0sRUFBRSxhQUFhLEVBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRUQsTUFBTSxDQUFVLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBNEI7UUFDekQseURBQXlEO1FBQ3pELE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQ0FBZ0MsQ0FBQyxLQUFLLEdBQUcsQ0FBQztJQUMvRCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xuaW1wb3J0IHtMb2d9IGZyb20gJy4uLy4uLy4uLy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuaW1wb3J0IHtQcm9tcHR9IGZyb20gJy4uLy4uLy4uLy4uL3V0aWxzL3Byb21wdC5qcyc7XG5cbmltcG9ydCB7QWN0aXZlUmVsZWFzZVRyYWluc30gZnJvbSAnLi4vLi4vLi4vdmVyc2lvbmluZy9hY3RpdmUtcmVsZWFzZS10cmFpbnMuanMnO1xuaW1wb3J0IHtnZXRMdHNOcG1EaXN0VGFnT2ZNYWpvcn0gZnJvbSAnLi4vLi4vLi4vdmVyc2lvbmluZy9sb25nLXRlcm0tc3VwcG9ydC5qcyc7XG5pbXBvcnQge1xuICBjb252ZXJ0VmVyc2lvbkJyYW5jaFRvU2VtVmVyLFxuICBpc1ZlcnNpb25CcmFuY2gsXG59IGZyb20gJy4uLy4uLy4uL3ZlcnNpb25pbmcvdmVyc2lvbi1icmFuY2hlcy5qcyc7XG5pbXBvcnQge0ZhdGFsUmVsZWFzZUFjdGlvbkVycm9yfSBmcm9tICcuLi8uLi9hY3Rpb25zLWVycm9yLmpzJztcbmltcG9ydCB7UmVsZWFzZUFjdGlvbn0gZnJvbSAnLi4vLi4vYWN0aW9ucy5qcyc7XG5cbi8qKlxuICogU1BFQ0lBTDogQWN0aW9uIHNob3VsZCBvbmx5IGJlIHVzZWQgYnkgZGV2LWluZnJhIG1lbWJlcnMuXG4gKlxuICogUmVsZWFzZSBhY3Rpb24gdGhhdCBjdXRzIGEgbmV3IG1pbm9yIGZvciBhbiBMVFMgbWFqb3IuIFRoZSBuZXcgTFRTXG4gKiBtaW5vciBicmFuY2ggaXMgcmVxdWlyZWQgdG8gYmUgY3JlYXRlZCBiZWZvcmVoYW5kLlxuICovXG5leHBvcnQgY2xhc3MgU3BlY2lhbEN1dExvbmdUZXJtU3VwcG9ydE1pbm9yQWN0aW9uIGV4dGVuZHMgUmVsZWFzZUFjdGlvbiB7XG4gIG92ZXJyaWRlIGFzeW5jIGdldERlc2NyaXB0aW9uKCkge1xuICAgIHJldHVybiBgU1BFQ0lBTDogQ3V0IGEgbmV3IHJlbGVhc2UgZm9yIGFuIExUUyBtaW5vci5gO1xuICB9XG5cbiAgb3ZlcnJpZGUgYXN5bmMgcGVyZm9ybSgpIHtcbiAgICBjb25zdCBsdHNCcmFuY2ggPSBhd2FpdCB0aGlzLl9hc2tGb3JWZXJzaW9uQnJhbmNoKCdQbGVhc2Ugc3BlY2lmeSB0aGUgdGFyZ2V0IExUUyBicmFuY2g6Jyk7XG4gICAgY29uc3QgY29tcGFyZVZlcnNpb25Gb3JSZWxlYXNlTm90ZXMgPSBzZW12ZXIucGFyc2UoXG4gICAgICBhd2FpdCBQcm9tcHQuaW5wdXQoJ0NvbXBhcmUgdmVyc2lvbiBmb3IgcmVsZWFzZScpLFxuICAgICkhO1xuXG4gICAgY29uc3QgbmV3VmVyc2lvbiA9IHNlbXZlci5wYXJzZShcbiAgICAgIGAke2x0c0JyYW5jaC5icmFuY2hWZXJzaW9uLm1ham9yfS4ke2x0c0JyYW5jaC5icmFuY2hWZXJzaW9uLm1pbm9yfS4wYCxcbiAgICApITtcblxuICAgIGNvbnN0IHtwdWxsUmVxdWVzdCwgcmVsZWFzZU5vdGVzLCBidWlsdFBhY2thZ2VzV2l0aEluZm8sIGJlZm9yZVN0YWdpbmdTaGF9ID1cbiAgICAgIGF3YWl0IHRoaXMuY2hlY2tvdXRCcmFuY2hBbmRTdGFnZVZlcnNpb24oXG4gICAgICAgIG5ld1ZlcnNpb24sXG4gICAgICAgIGNvbXBhcmVWZXJzaW9uRm9yUmVsZWFzZU5vdGVzLFxuICAgICAgICBsdHNCcmFuY2guYnJhbmNoLFxuICAgICAgKTtcblxuICAgIGF3YWl0IHRoaXMucHJvbXB0QW5kV2FpdEZvclB1bGxSZXF1ZXN0TWVyZ2VkKHB1bGxSZXF1ZXN0KTtcbiAgICBhd2FpdCB0aGlzLnB1Ymxpc2goXG4gICAgICBidWlsdFBhY2thZ2VzV2l0aEluZm8sXG4gICAgICByZWxlYXNlTm90ZXMsXG4gICAgICBiZWZvcmVTdGFnaW5nU2hhLFxuICAgICAgbHRzQnJhbmNoLmJyYW5jaCxcbiAgICAgIGdldEx0c05wbURpc3RUYWdPZk1ham9yKG5ld1ZlcnNpb24ubWFqb3IpLFxuICAgICAge3Nob3dBc0xhdGVzdE9uR2l0SHViOiBmYWxzZX0sXG4gICAgKTtcbiAgICBhd2FpdCB0aGlzLmNoZXJyeVBpY2tDaGFuZ2Vsb2dJbnRvTmV4dEJyYW5jaChyZWxlYXNlTm90ZXMsIGx0c0JyYW5jaC5icmFuY2gpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBfYXNrRm9yVmVyc2lvbkJyYW5jaChtZXNzYWdlOiBzdHJpbmcpOiBQcm9taXNlPHtcbiAgICBicmFuY2g6IHN0cmluZztcbiAgICBicmFuY2hWZXJzaW9uOiBzZW12ZXIuU2VtVmVyO1xuICB9PiB7XG4gICAgY29uc3QgYnJhbmNoID0gYXdhaXQgUHJvbXB0LmlucHV0KG1lc3NhZ2UpO1xuICAgIGlmICghaXNWZXJzaW9uQnJhbmNoKGJyYW5jaCkpIHtcbiAgICAgIExvZy5lcnJvcignSW52YWxpZCByZWxlYXNlIGJyYW5jaCBzcGVjaWZpZWQuJyk7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxSZWxlYXNlQWN0aW9uRXJyb3IoKTtcbiAgICB9XG5cbiAgICBjb25zdCBicmFuY2hWZXJzaW9uID0gY29udmVydFZlcnNpb25CcmFuY2hUb1NlbVZlcihicmFuY2gpO1xuICAgIGlmIChicmFuY2hWZXJzaW9uID09PSBudWxsKSB7XG4gICAgICBMb2cuZXJyb3IoJ0NvdWxkIG5vdCBwYXJzZSB2ZXJzaW9uIGJyYW5jaC4nKTtcbiAgICAgIHRocm93IG5ldyBGYXRhbFJlbGVhc2VBY3Rpb25FcnJvcigpO1xuICAgIH1cbiAgICByZXR1cm4ge2JyYW5jaCwgYnJhbmNoVmVyc2lvbn07XG4gIH1cblxuICBzdGF0aWMgb3ZlcnJpZGUgYXN5bmMgaXNBY3RpdmUoX2FjdGl2ZTogQWN0aXZlUmVsZWFzZVRyYWlucykge1xuICAgIC8vIE9ubHkgZW5hYmxlZCBpZiBleHBsaWNpdGx5IGVuYWJsZWQgZm9yIGRldi1pbmZyYSB0ZWFtLlxuICAgIHJldHVybiBwcm9jZXNzLmVudlsnTkdfREVWX1NQRUNJQUxfUkVMRUFTRV9BQ1RJT05TJ10gPT09ICcxJztcbiAgfVxufVxuIl19