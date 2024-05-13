/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { assertValidReleaseConfig } from '../../../release/config/index.js';
import { getNextBranchName, isVersionBranch, } from '../../../release/versioning/index.js';
import { assertValidGithubConfig, ConfigValidationError, } from '../../../utils/config.js';
import { InvalidTargetBranchError, InvalidTargetLabelError, } from './target-label.js';
import { assertActiveLtsBranch } from './lts-branch.js';
import { Log } from '../../../utils/logging.js';
import { assertValidPullRequestConfig } from '../../config/index.js';
import { targetLabels } from '../labels/target.js';
/**
 * Gets a list of target labels and their configs. The merge tooling will
 * respect match to the appropriate label config and leverage it for determining
 * into which branches a pull request should merge into.
 *
 * The target label configs are implemented according to the design document which
 * specifies versioning, branching and releasing for the Angular organization:
 * https://docs.google.com/document/d/197kVillDwx-RZtSVOBtPb4BBIAw0E9RT3q3v6DZkykU
 *
 * @param api Instance of a Github client. Used to query for the release train branches.
 * @param config Configuration for the Github remote and release packages. Used to fetch
 *   NPM version data when LTS version branches are validated.
 */
export async function getTargetLabelConfigsForActiveReleaseTrains({ latest, releaseCandidate, next, exceptionalMinor }, api, config) {
    assertValidGithubConfig(config);
    assertValidPullRequestConfig(config);
    const nextBranchName = getNextBranchName(config.github);
    const repo = {
        owner: config.github.owner,
        name: config.github.name,
        nextBranchName,
        api,
    };
    const labelConfigs = [
        {
            label: targetLabels.TARGET_MAJOR,
            branches: () => {
                // If `next` is currently not designated to be a major version, we do not
                // allow merging of PRs with `target: major`.
                if (!next.isMajor) {
                    throw new InvalidTargetLabelError(`Unable to merge pull request. The "${nextBranchName}" branch will be released as ` +
                        'a minor version.');
                }
                return [nextBranchName];
            },
        },
        {
            label: targetLabels.TARGET_MINOR,
            branches: (githubTargetBranch) => {
                // If there is an exceptional minor in-progress, and a PR specifically sets
                // its destination to it, along with `target: minor`, then we merge into it.
                // This allows for an exceptional minor train to receive e.g. features.
                // See: http://go/angular-exceptional-minor
                if (githubTargetBranch === exceptionalMinor?.branchName) {
                    return [exceptionalMinor.branchName];
                }
                return [nextBranchName];
            },
        },
        {
            label: targetLabels.TARGET_PATCH,
            branches: (githubTargetBranch) => {
                // If a PR is targeting the latest active version-branch through the Github UI,
                // and is also labeled with `target: patch`, then we merge it directly into the
                // branch without doing any cherry-picking. This is useful if a PR could not be
                // applied cleanly, and a separate PR for the patch branch has been created.
                if (githubTargetBranch === latest.branchName) {
                    return [latest.branchName];
                }
                // Otherwise, patch changes are always merged into the next and patch branch.
                const branches = [nextBranchName, latest.branchName];
                // Additionally, if there is a release-candidate/feature-freeze release-train
                // currently active, also merge the PR into that version-branch.
                if (releaseCandidate !== null) {
                    branches.push(releaseCandidate.branchName);
                }
                // If there is an exceptional minor, patch changes should always go into it.
                // It would be a potential loss of fixes/patches if suddenly the exceptional
                // minor becomes the new patch- but misses some commits.
                // More details here: http://go/angular-exceptional-minor.
                if (exceptionalMinor !== null) {
                    branches.push(exceptionalMinor.branchName);
                }
                return branches;
            },
        },
        {
            label: targetLabels.TARGET_RC,
            branches: (githubTargetBranch) => {
                // The `target: rc` label cannot be applied if there is no active feature-freeze
                // or release-candidate release train.
                if (releaseCandidate === null) {
                    throw new InvalidTargetLabelError(`No active feature-freeze/release-candidate branch. ` +
                        `Unable to merge pull request using "target: rc" label.`);
                }
                // If the PR is targeting the active release-candidate/feature-freeze version branch
                // directly through the Github UI and has the `target: rc` label applied, merge it
                // only into the release candidate branch. This is useful if a PR did not apply cleanly
                // into the release-candidate/feature-freeze branch, and a separate PR has been created.
                if (githubTargetBranch === releaseCandidate.branchName) {
                    return [releaseCandidate.branchName];
                }
                // Otherwise, merge into the next and active release-candidate/feature-freeze branch.
                return [nextBranchName, releaseCandidate.branchName];
            },
        },
        {
            label: targetLabels.TARGET_FEATURE,
            branches: (githubTargetBranch) => {
                if (isVersionBranch(githubTargetBranch) || githubTargetBranch === nextBranchName) {
                    throw new InvalidTargetBranchError('"target: feature" pull requests cannot target a releasable branch');
                }
                return [githubTargetBranch];
            },
        },
    ];
    // LTS branches can only be determined if the release configuration is defined, and must be added
    // after asserting the configuration contains a release config.
    try {
        assertValidReleaseConfig(config);
        labelConfigs.push({
            // LTS changes are rare enough that we won't worry about cherry-picking changes into all
            // active LTS branches for PRs created against any other branch. Instead, PR authors need
            // to manually create separate PRs for desired LTS branches. Additionally, active LT branches
            // commonly diverge quickly. This makes cherry-picking not an option for LTS changes.
            label: targetLabels.TARGET_LTS,
            branches: async (githubTargetBranch) => {
                if (!isVersionBranch(githubTargetBranch)) {
                    throw new InvalidTargetBranchError(`PR cannot be merged as it does not target a long-term support ` +
                        `branch: "${githubTargetBranch}"`);
                }
                if (githubTargetBranch === latest.branchName) {
                    throw new InvalidTargetBranchError(`PR cannot be merged with "target: lts" into patch branch. ` +
                        `Consider changing the label to "target: patch" if this is intentional.`);
                }
                if (releaseCandidate !== null && githubTargetBranch === releaseCandidate.branchName) {
                    throw new InvalidTargetBranchError(`PR cannot be merged with "target: lts" into feature-freeze/release-candidate ` +
                        `branch. Consider changing the label to "target: rc" if this is intentional.`);
                }
                // Assert that the selected branch is an active LTS branch.
                assertValidReleaseConfig(config);
                await assertActiveLtsBranch(repo, config.release, githubTargetBranch);
                return [githubTargetBranch];
            },
        });
    }
    catch (err) {
        if (err instanceof ConfigValidationError) {
            Log.debug('LTS target label not included in target labels as no valid release');
            Log.debug('configuration was found to allow the LTS branches to be determined.');
        }
        else {
            throw err;
        }
    }
    return labelConfigs;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFiZWxzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3ByL2NvbW1vbi90YXJnZXRpbmcvbGFiZWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyx3QkFBd0IsRUFBZ0IsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RixPQUFPLEVBRUwsaUJBQWlCLEVBQ2pCLGVBQWUsR0FFaEIsTUFBTSxzQ0FBc0MsQ0FBQztBQUM5QyxPQUFPLEVBQ0wsdUJBQXVCLEVBQ3ZCLHFCQUFxQixHQUd0QixNQUFNLDBCQUEwQixDQUFDO0FBQ2xDLE9BQU8sRUFDTCx3QkFBd0IsRUFDeEIsdUJBQXVCLEdBRXhCLE1BQU0sbUJBQW1CLENBQUM7QUFFM0IsT0FBTyxFQUFDLHFCQUFxQixFQUFDLE1BQU0saUJBQWlCLENBQUM7QUFFdEQsT0FBTyxFQUFDLEdBQUcsRUFBQyxNQUFNLDJCQUEyQixDQUFDO0FBQzlDLE9BQU8sRUFBQyw0QkFBNEIsRUFBb0IsTUFBTSx1QkFBdUIsQ0FBQztBQUN0RixPQUFPLEVBQUMsWUFBWSxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFFakQ7Ozs7Ozs7Ozs7OztHQVlHO0FBQ0gsTUFBTSxDQUFDLEtBQUssVUFBVSwyQ0FBMkMsQ0FDL0QsRUFBQyxNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFzQixFQUN2RSxHQUFpQixFQUNqQixNQUlFO0lBRUYsdUJBQXVCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDaEMsNEJBQTRCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFckMsTUFBTSxjQUFjLEdBQUcsaUJBQWlCLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3hELE1BQU0sSUFBSSxHQUF1QjtRQUMvQixLQUFLLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLO1FBQzFCLElBQUksRUFBRSxNQUFNLENBQUMs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LENBQUM7Z0JBQ3RFLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1lBQzlCLENBQUM7U0FDRixDQUFDLENBQUM7SUFDTCxDQUFDO0lBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUNiLElBQUksR0FBRyxZQUFZLHFCQUFxQixFQUFFLENBQUM7WUFDekMsR0FBRyxDQUFDLEtBQUssQ0FBQyxvRUFBb0UsQ0FBQyxDQUFDO1lBQ2hGLEdBQUcsQ0FBQyxLQUFLLENBQUMscUVBQXFFLENBQUMsQ0FBQztRQUNuRixDQUFDO2FBQU0sQ0FBQztZQUNOLE1BQU0sR0FBRyxDQUFDO1FBQ1osQ0FBQztJQUNILENBQUM7SUFFRCxPQUFPLFlBQVksQ0FBQztBQUN0QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7YXNzZXJ0VmFsaWRSZWxlYXNlQ29uZmlnLCBSZWxlYXNlQ29uZmlnfSBmcm9tICcuLi8uLi8uLi9yZWxlYXNlL2NvbmZpZy9pbmRleC5qcyc7XG5pbXBvcnQge1xuICBBY3RpdmVSZWxlYXNlVHJhaW5zLFxuICBnZXROZXh0QnJhbmNoTmFtZSxcbiAgaXNWZXJzaW9uQnJhbmNoLFxuICBSZWxlYXNlUmVwb1dpdGhBcGksXG59IGZyb20gJy4uLy4uLy4uL3JlbGVhc2UvdmVyc2lvbmluZy9pbmRleC5qcyc7XG5pbXBvcnQge1xuICBhc3NlcnRWYWxpZEdpdGh1YkNvbmZpZyxcbiAgQ29uZmlnVmFsaWRhdGlvbkVycm9yLFxuICBHaXRodWJDb25maWcsXG4gIE5nRGV2Q29uZmlnLFxufSBmcm9tICcuLi8uLi8uLi91dGlscy9jb25maWcuanMnO1xuaW1wb3J0IHtcbiAgSW52YWxpZFRhcmdldEJyYW5jaEVycm9yLFxuICBJbnZhbGlkVGFyZ2V0TGFiZWxFcnJvcixcbiAgVGFyZ2V0TGFiZWxDb25maWcsXG59IGZyb20gJy4vdGFyZ2V0LWxhYmVsLmpzJztcblxuaW1wb3J0IHthc3NlcnRBY3RpdmVMdHNCcmFuY2h9IGZyb20gJy4vbHRzLWJyYW5jaC5qcyc7XG5pbXBvcnQge0dpdGh1YkNsaWVudH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi5qcyc7XG5pbXBvcnQge0xvZ30gZnJvbSAnLi4vLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge2Fzc2VydFZhbGlkUHVsbFJlcXVlc3RDb25maWcsIFB1bGxSZXF1ZXN0Q29uZmlnfSBmcm9tICcuLi8uLi9jb25maWcvaW5kZXguanMnO1xuaW1wb3J0IHt0YXJnZXRMYWJlbHN9IGZyb20gJy4uL2xhYmVscy90YXJnZXQuanMnO1xuXG4vKipcbiAqIEdldHMgYSBsaXN0IG9mIHRhcmdldCBsYWJlbHMgYW5kIHRoZWlyIGNvbmZpZ3MuIFRoZSBtZXJnZSB0b29saW5nIHdpbGxcbiAqIHJlc3BlY3QgbWF0Y2ggdG8gdGhlIGFwcHJvcHJpYXRlIGxhYmVsIGNvbmZpZyBhbmQgbGV2ZXJhZ2UgaXQgZm9yIGRldGVybWluaW5nXG4gKiBpbnRvIHdoaWNoIGJyYW5jaGVzIGEgcHVsbCByZXF1ZXN0IHNob3VsZCBtZXJnZSBpbnRvLlxuICpcbiAqIFRoZSB0YXJnZXQgbGFiZWwgY29uZmlncyBhcmUgaW1wbGVtZW50ZWQgYWNjb3JkaW5nIHRvIHRoZSBkZXNpZ24gZG9jdW1lbnQgd2hpY2hcbiAqIHNwZWNpZmllcyB2ZXJzaW9uaW5nLCBicmFuY2hpbmcgYW5kIHJlbGVhc2luZyBmb3IgdGhlIEFuZ3VsYXIgb3JnYW5pemF0aW9uOlxuICogaHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vZG9jdW1lbnQvZC8xOTdrVmlsbER3eC1SWnRTVk9CdFBiNEJCSUF3MEU5UlQzcTN2NkRaa3lrVVxuICpcbiAqIEBwYXJhbSBhcGkgSW5zdGFuY2Ugb2YgYSBHaXRodWIgY2xpZW50LiBVc2VkIHRvIHF1ZXJ5IGZvciB0aGUgcmVsZWFzZSB0cmFpbiBicmFuY2hlcy5cbiAqIEBwYXJhbSBjb25maWcgQ29uZmlndXJhdGlvbiBmb3IgdGhlIEdpdGh1YiByZW1vdGUgYW5kIHJlbGVhc2UgcGFja2FnZXMuIFVzZWQgdG8gZmV0Y2hcbiAqICAgTlBNIHZlcnNpb24gZGF0YSB3aGVuIExUUyB2ZXJzaW9uIGJyYW5jaGVzIGFyZSB2YWxpZGF0ZWQuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRUYXJnZXRMYWJlbENvbmZpZ3NGb3JBY3RpdmVSZWxlYXNlVHJhaW5zKFxuICB7bGF0ZXN0LCByZWxlYXNlQ2FuZGlkYXRlLCBuZXh0LCBleGNlcHRpb25hbE1pbm9yfTogQWN0aXZlUmVsZWFzZVRyYWlucyxcbiAgYXBpOiBHaXRodWJDbGllbnQsXG4gIGNvbmZpZzogTmdEZXZDb25maWc8e1xuICAgIGdpdGh1YjogR2l0aHViQ29uZmlnO1xuICAgIHB1bGxSZXF1ZXN0OiBQdWxsUmVxdWVzdENvbmZpZztcbiAgICByZWxlYXNlPzogUmVsZWFzZUNvbmZpZztcbiAgfT4sXG4pOiBQcm9taXNlPFRhcmdldExhYmVsQ29uZmlnW10+IHtcbiAgYXNzZXJ0VmFsaWRHaXRodWJDb25maWcoY29uZmlnKTtcbiAgYXNzZXJ0VmFsaWRQdWxsUmVxdWVzdENvbmZpZyhjb25maWcpO1xuXG4gIGNvbnN0IG5leHRCcmFuY2hOYW1lID0gZ2V0TmV4dEJyYW5jaE5hbWUoY29uZmlnLmdpdGh1Yik7XG4gIGNvbnN0IHJlcG86IFJlbGVhc2VSZXBvV2l0aEFwaSA9IHtcbiAgICBvd25lcjogY29uZmlnLmdpdGh1Yi5vd25lcixcbiAgICBuYW1lOiBjb25maWcuZ2l0aHViLm5hbWUsXG4gICAgbmV4dEJyYW5jaE5hbWUsXG4gICAgYXBpLFxuICB9O1xuXG4gIGNvbnN0IGxhYmVsQ29uZmlnczogVGFyZ2V0TGFiZWxDb25maWdbXSA9IFtcbiAgICB7XG4gICAgICBsYWJlbDogdGFyZ2V0TGFiZWxzLlRBUkdFVF9NQUpPUixcbiAgICAgIGJyYW5jaGVzOiAoKSA9PiB7XG4gICAgICAgIC8vIElmIGBuZXh0YCBpcyBjdXJyZW50bHkgbm90IGRlc2lnbmF0ZWQgdG8gYmUgYSBtYWpvciB2ZXJzaW9uLCB3ZSBkbyBub3RcbiAgICAgICAgLy8gYWxsb3cgbWVyZ2luZyBvZiBQUnMgd2l0aCBgdGFyZ2V0OiBtYWpvcmAuXG4gICAgICAgIGlmICghbmV4dC5pc01ham9yKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEludmFsaWRUYXJnZXRMYWJlbEVycm9yKFxuICAgICAgICAgICAgYFVuYWJsZSB0byBtZXJnZSBwdWxsIHJlcXVlc3QuIFRoZSBcIiR7bmV4dEJyYW5jaE5hbWV9XCIgYnJhbmNoIHdpbGwgYmUgcmVsZWFzZWQgYXMgYCArXG4gICAgICAgICAgICAgICdhIG1pbm9yIHZlcnNpb24uJyxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbbmV4dEJyYW5jaE5hbWVdO1xuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGxhYmVsOiB0YXJnZXRMYWJlbHMuVEFSR0VUX01JTk9SLFxuICAgICAgYnJhbmNoZXM6IChnaXRodWJUYXJnZXRCcmFuY2gpID0+IHtcbiAgICAgICAgLy8gSWYgdGhlcmUgaXMgYW4gZXhjZXB0aW9uYWwgbWlub3IgaW4tcHJvZ3Jlc3MsIGFuZCBhIFBSIHNwZWNpZmljYWxseSBzZXRzXG4gICAgICAgIC8vIGl0cyBkZXN0aW5hdGlvbiB0byBpdCwgYWxvbmcgd2l0aCBgdGFyZ2V0OiBtaW5vcmAsIHRoZW4gd2UgbWVyZ2UgaW50byBpdC5cbiAgICAgICAgLy8gVGhpcyBhbGxvd3MgZm9yIGFuIGV4Y2VwdGlvbmFsIG1pbm9yIHRyYWluIHRvIHJlY2VpdmUgZS5nLiBmZWF0dXJlcy5cbiAgICAgICAgLy8gU2VlOiBodHRwOi8vZ28vYW5ndWxhci1leGNlcHRpb25hbC1taW5vclxuICAgICAgICBpZiAoZ2l0aHViVGFyZ2V0QnJhbmNoID09PSBleGNlcHRpb25hbE1pbm9yPy5icmFuY2hOYW1lKSB7XG4gICAgICAgICAgcmV0dXJuIFtleGNlcHRpb25hbE1pbm9yLmJyYW5jaE5hbWVdO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFtuZXh0QnJhbmNoTmFtZV07XG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgbGFiZWw6IHRhcmdldExhYmVscy5UQVJHRVRfUEFUQ0gsXG4gICAgICBicmFuY2hlczogKGdpdGh1YlRhcmdldEJyYW5jaCkgPT4ge1xuICAgICAgICAvLyBJZiBhIFBSIGlzIHRhcmdldGluZyB0aGUgbGF0ZXN0IGFjdGl2ZSB2ZXJzaW9uLWJyYW5jaCB0aHJvdWdoIHRoZSBHaXRodWIgVUksXG4gICAgICAgIC8vIGFuZCBpcyBhbHNvIGxhYmVsZWQgd2l0aCBgdGFyZ2V0OiBwYXRjaGAsIHRoZW4gd2UgbWVyZ2UgaXQgZGlyZWN0bHkgaW50byB0aGVcbiAgICAgICAgLy8gYnJhbmNoIHdpdGhvdXQgZG9pbmcgYW55IGNoZXJyeS1waWNraW5nLiBUaGlzIGlzIHVzZWZ1bCBpZiBhIFBSIGNvdWxkIG5vdCBiZVxuICAgICAgICAvLyBhcHBsaWVkIGNsZWFubHksIGFuZCBhIHNlcGFyYXRlIFBSIGZvciB0aGUgcGF0Y2ggYnJhbmNoIGhhcyBiZWVuIGNyZWF0ZWQuXG4gICAgICAgIGlmIChnaXRodWJUYXJnZXRCcmFuY2ggPT09IGxhdGVzdC5icmFuY2hOYW1lKSB7XG4gICAgICAgICAgcmV0dXJuIFtsYXRlc3QuYnJhbmNoTmFtZV07XG4gICAgICAgIH1cbiAgICAgICAgLy8gT3RoZXJ3aXNlLCBwYXRjaCBjaGFuZ2VzIGFyZSBhbHdheXMgbWVyZ2VkIGludG8gdGhlIG5leHQgYW5kIHBhdGNoIGJyYW5jaC5cbiAgICAgICAgY29uc3QgYnJhbmNoZXMgPSBbbmV4dEJyYW5jaE5hbWUsIGxhdGVzdC5icmFuY2hOYW1lXTtcbiAgICAgICAgLy8gQWRkaXRpb25hbGx5LCBpZiB0aGVyZSBpcyBhIHJlbGVhc2UtY2FuZGlkYXRlL2ZlYXR1cmUtZnJlZXplIHJlbGVhc2UtdHJhaW5cbiAgICAgICAgLy8gY3VycmVudGx5IGFjdGl2ZSwgYWxzbyBtZXJnZSB0aGUgUFIgaW50byB0aGF0IHZlcnNpb24tYnJhbmNoLlxuICAgICAgICBpZiAocmVsZWFzZUNhbmRpZGF0ZSAhPT0gbnVsbCkge1xuICAgICAgICAgIGJyYW5jaGVzLnB1c2gocmVsZWFzZUNhbmRpZGF0ZS5icmFuY2hOYW1lKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBJZiB0aGVyZSBpcyBhbiBleGNlcHRpb25hbCBtaW5vciwgcGF0Y2ggY2hhbmdlcyBzaG91bGQgYWx3YXlzIGdvIGludG8gaXQuXG4gICAgICAgIC8vIEl0IHdvdWxkIGJlIGEgcG90ZW50aWFsIGxvc3Mgb2YgZml4ZXMvcGF0Y2hlcyBpZiBzdWRkZW5seSB0aGUgZXhjZXB0aW9uYWxcbiAgICAgICAgLy8gbWlub3IgYmVjb21lcyB0aGUgbmV3IHBhdGNoLSBidXQgbWlzc2VzIHNvbWUgY29tbWl0cy5cbiAgICAgICAgLy8gTW9yZSBkZXRhaWxzIGhlcmU6IGh0dHA6Ly9nby9hbmd1bGFyLWV4Y2VwdGlvbmFsLW1pbm9yLlxuICAgICAgICBpZiAoZXhjZXB0aW9uYWxNaW5vciAhPT0gbnVsbCkge1xuICAgICAgICAgIGJyYW5jaGVzLnB1c2goZXhjZXB0aW9uYWxNaW5vci5icmFuY2hOYW1lKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYnJhbmNoZXM7XG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgbGFiZWw6IHRhcmdldExhYmVscy5UQVJHRVRfUkMsXG4gICAgICBicmFuY2hlczogKGdpdGh1YlRhcmdldEJyYW5jaCkgPT4ge1xuICAgICAgICAvLyBUaGUgYHRhcmdldDogcmNgIGxhYmVsIGNhbm5vdCBiZSBhcHBsaWVkIGlmIHRoZXJlIGlzIG5vIGFjdGl2ZSBmZWF0dXJlLWZyZWV6ZVxuICAgICAgICAvLyBvciByZWxlYXNlLWNhbmRpZGF0ZSByZWxlYXNlIHRyYWluLlxuICAgICAgICBpZiAocmVsZWFzZUNhbmRpZGF0ZSA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBJbnZhbGlkVGFyZ2V0TGFiZWxFcnJvcihcbiAgICAgICAgICAgIGBObyBhY3RpdmUgZmVhdHVyZS1mcmVlemUvcmVsZWFzZS1jYW5kaWRhdGUgYnJhbmNoLiBgICtcbiAgICAgICAgICAgICAgYFVuYWJsZSB0byBtZXJnZSBwdWxsIHJlcXVlc3QgdXNpbmcgXCJ0YXJnZXQ6IHJjXCIgbGFiZWwuYCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIC8vIElmIHRoZSBQUiBpcyB0YXJnZXRpbmcgdGhlIGFjdGl2ZSByZWxlYXNlLWNhbmRpZGF0ZS9mZWF0dXJlLWZyZWV6ZSB2ZXJzaW9uIGJyYW5jaFxuICAgICAgICAvLyBkaXJlY3RseSB0aHJvdWdoIHRoZSBHaXRodWIgVUkgYW5kIGhhcyB0aGUgYHRhcmdldDogcmNgIGxhYmVsIGFwcGxpZWQsIG1lcmdlIGl0XG4gICAgICAgIC8vIG9ubHkgaW50byB0aGUgcmVsZWFzZSBjYW5kaWRhdGUgYnJhbmNoLiBUaGlzIGlzIHVzZWZ1bCBpZiBhIFBSIGRpZCBub3QgYXBwbHkgY2xlYW5seVxuICAgICAgICAvLyBpbnRvIHRoZSByZWxlYXNlLWNhbmRpZGF0ZS9mZWF0dXJlLWZyZWV6ZSBicmFuY2gsIGFuZCBhIHNlcGFyYXRlIFBSIGhhcyBiZWVuIGNyZWF0ZWQuXG4gICAgICAgIGlmIChnaXRodWJUYXJnZXRCcmFuY2ggPT09IHJlbGVhc2VDYW5kaWRhdGUuYnJhbmNoTmFtZSkge1xuICAgICAgICAgIHJldHVybiBbcmVsZWFzZUNhbmRpZGF0ZS5icmFuY2hOYW1lXTtcbiAgICAgICAgfVxuICAgICAgICAvLyBPdGhlcndpc2UsIG1lcmdlIGludG8gdGhlIG5leHQgYW5kIGFjdGl2ZSByZWxlYXNlLWNhbmRpZGF0ZS9mZWF0dXJlLWZyZWV6ZSBicmFuY2guXG4gICAgICAgIHJldHVybiBbbmV4dEJyYW5jaE5hbWUsIHJlbGVhc2VDYW5kaWRhdGUuYnJhbmNoTmFtZV07XG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgbGFiZWw6IHRhcmdldExhYmVscy5UQVJHRVRfRkVBVFVSRSxcbiAgICAgIGJyYW5jaGVzOiAoZ2l0aHViVGFyZ2V0QnJhbmNoKSA9PiB7XG4gICAgICAgIGlmIChpc1ZlcnNpb25CcmFuY2goZ2l0aHViVGFyZ2V0QnJhbmNoKSB8fCBnaXRodWJUYXJnZXRCcmFuY2ggPT09IG5leHRCcmFuY2hOYW1lKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEludmFsaWRUYXJnZXRCcmFuY2hFcnJvcihcbiAgICAgICAgICAgICdcInRhcmdldDogZmVhdHVyZVwiIHB1bGwgcmVxdWVzdHMgY2Fubm90IHRhcmdldCBhIHJlbGVhc2FibGUgYnJhbmNoJyxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbZ2l0aHViVGFyZ2V0QnJhbmNoXTtcbiAgICAgIH0sXG4gICAgfSxcbiAgXTtcblxuICAvLyBMVFMgYnJhbmNoZXMgY2FuIG9ubHkgYmUgZGV0ZXJtaW5lZCBpZiB0aGUgcmVsZWFzZSBjb25maWd1cmF0aW9uIGlzIGRlZmluZWQsIGFuZCBtdXN0IGJlIGFkZGVkXG4gIC8vIGFmdGVyIGFzc2VydGluZyB0aGUgY29uZmlndXJhdGlvbiBjb250YWlucyBhIHJlbGVhc2UgY29uZmlnLlxuICB0cnkge1xuICAgIGFzc2VydFZhbGlkUmVsZWFzZUNvbmZpZyhjb25maWcpO1xuICAgIGxhYmVsQ29uZmlncy5wdXNoKHtcbiAgICAgIC8vIExUUyBjaGFuZ2VzIGFyZSByYXJlIGVub3VnaCB0aGF0IHdlIHdvbid0IHdvcnJ5IGFib3V0IGNoZXJyeS1waWNraW5nIGNoYW5nZXMgaW50byBhbGxcbiAgICAgIC8vIGFjdGl2ZSBMVFMgYnJhbmNoZXMgZm9yIFBScyBjcmVhdGVkIGFnYWluc3QgYW55IG90aGVyIGJyYW5jaC4gSW5zdGVhZCwgUFIgYXV0aG9ycyBuZWVkXG4gICAgICAvLyB0byBtYW51YWxseSBjcmVhdGUgc2VwYXJhdGUgUFJzIGZvciBkZXNpcmVkIExUUyBicmFuY2hlcy4gQWRkaXRpb25hbGx5LCBhY3RpdmUgTFQgYnJhbmNoZXNcbiAgICAgIC8vIGNvbW1vbmx5IGRpdmVyZ2UgcXVpY2tseS4gVGhpcyBtYWtlcyBjaGVycnktcGlja2luZyBub3QgYW4gb3B0aW9uIGZvciBMVFMgY2hhbmdlcy5cbiAgICAgIGxhYmVsOiB0YXJnZXRMYWJlbHMuVEFSR0VUX0xUUyxcbiAgICAgIGJyYW5jaGVzOiBhc3luYyAoZ2l0aHViVGFyZ2V0QnJhbmNoKSA9PiB7XG4gICAgICAgIGlmICghaXNWZXJzaW9uQnJhbmNoKGdpdGh1YlRhcmdldEJyYW5jaCkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgSW52YWxpZFRhcmdldEJyYW5jaEVycm9yKFxuICAgICAgICAgICAgYFBSIGNhbm5vdCBiZSBtZXJnZWQgYXMgaXQgZG9lcyBub3QgdGFyZ2V0IGEgbG9uZy10ZXJtIHN1cHBvcnQgYCArXG4gICAgICAgICAgICAgIGBicmFuY2g6IFwiJHtnaXRodWJUYXJnZXRCcmFuY2h9XCJgLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGdpdGh1YlRhcmdldEJyYW5jaCA9PT0gbGF0ZXN0LmJyYW5jaE5hbWUpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgSW52YWxpZFRhcmdldEJyYW5jaEVycm9yKFxuICAgICAgICAgICAgYFBSIGNhbm5vdCBiZSBtZXJnZWQgd2l0aCBcInRhcmdldDogbHRzXCIgaW50byBwYXRjaCBicmFuY2guIGAgK1xuICAgICAgICAgICAgICBgQ29uc2lkZXIgY2hhbmdpbmcgdGhlIGxhYmVsIHRvIFwidGFyZ2V0OiBwYXRjaFwiIGlmIHRoaXMgaXMgaW50ZW50aW9uYWwuYCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZWxlYXNlQ2FuZGlkYXRlICE9PSBudWxsICYmIGdpdGh1YlRhcmdldEJyYW5jaCA9PT0gcmVsZWFzZUNhbmRpZGF0ZS5icmFuY2hOYW1lKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEludmFsaWRUYXJnZXRCcmFuY2hFcnJvcihcbiAgICAgICAgICAgIGBQUiBjYW5ub3QgYmUgbWVyZ2VkIHdpdGggXCJ0YXJnZXQ6IGx0c1wiIGludG8gZmVhdHVyZS1mcmVlemUvcmVsZWFzZS1jYW5kaWRhdGUgYCArXG4gICAgICAgICAgICAgIGBicmFuY2guIENvbnNpZGVyIGNoYW5naW5nIHRoZSBsYWJlbCB0byBcInRhcmdldDogcmNcIiBpZiB0aGlzIGlzIGludGVudGlvbmFsLmAsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBBc3NlcnQgdGhhdCB0aGUgc2VsZWN0ZWQgYnJhbmNoIGlzIGFuIGFjdGl2ZSBMVFMgYnJhbmNoLlxuICAgICAgICBhc3NlcnRWYWxpZFJlbGVhc2VDb25maWcoY29uZmlnKTtcbiAgICAgICAgYXdhaXQgYXNzZXJ0QWN0aXZlTHRzQnJhbmNoKHJlcG8sIGNvbmZpZy5yZWxlYXNlLCBnaXRodWJUYXJnZXRCcmFuY2gpO1xuICAgICAgICByZXR1cm4gW2dpdGh1YlRhcmdldEJyYW5jaF07XG4gICAgICB9LFxuICAgIH0pO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoZXJyIGluc3RhbmNlb2YgQ29uZmlnVmFsaWRhdGlvbkVycm9yKSB7XG4gICAgICBMb2cuZGVidWcoJ0xUUyB0YXJnZXQgbGFiZWwgbm90IGluY2x1ZGVkIGluIHRhcmdldCBsYWJlbHMgYXMgbm8gdmFsaWQgcmVsZWFzZScpO1xuICAgICAgTG9nLmRlYnVnKCdjb25maWd1cmF0aW9uIHdhcyBmb3VuZCB0byBhbGxvdyB0aGUgTFRTIGJyYW5jaGVzIHRvIGJlIGRldGVybWluZWQuJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbGFiZWxDb25maWdzO1xufVxuIl19