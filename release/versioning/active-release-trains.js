/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import semver from 'semver';
import { ReleaseTrain } from './release-trains.js';
import { getBranchesForMajorVersions, getVersionInfoForBranch, } from './version-branches.js';
/** The active release trains for a project. */
export class ActiveReleaseTrains {
    constructor(trains) {
        this.trains = trains;
        /** Release-train currently in the "release-candidate" or "feature-freeze" phase. */
        this.releaseCandidate = this.trains.releaseCandidate;
        /** Release-train in the `next` phase. */
        this.next = this.trains.next;
        /** Release-train currently in the "latest" phase. */
        this.latest = this.trains.latest;
        /** Release-train for an exceptional minor in progress. */
        this.exceptionalMinor = this.trains.exceptionalMinor;
    }
    /** Whether the active release trains indicate the repository is in a feature freeze state. */
    isFeatureFreeze() {
        return this.releaseCandidate !== null && this.releaseCandidate.version.prerelease[0] === 'next';
    }
    /** Fetches the active release trains for the configured project. */
    static async fetch(repo) {
        return fetchActiveReleaseTrains(repo);
    }
}
/** Fetches the active release trains for the configured project. */
async function fetchActiveReleaseTrains(repo) {
    const nextBranchName = repo.nextBranchName;
    const { version: nextVersion } = await getVersionInfoForBranch(repo, nextBranchName);
    const next = new ReleaseTrain(nextBranchName, nextVersion);
    const majorVersionsToFetch = [];
    const checks = {
        canHaveExceptionalMinor: () => false,
        isValidReleaseCandidateVersion: () => false,
        isValidExceptionalMinorVersion: () => false,
    };
    if (nextVersion.minor === 0) {
        // CASE 1: Next is for a new major. Potential release-candidate/feature-freeze train
        // can only be for the previous major. Usually patch is in the same minor as for RC/FF,
        // but technically two majors can be in the works, so we also need to consider the second
        // previous major
        // Example scenarios:
        //    * next = v15.0.x, rc/ff = v14.4.x, exc-minor = disallowed, patch = v14.3.x
        //    * next = v15.0.x  rc/ff = null,    exc-minor = null,       patch = v14.3.x
        //    * next = v15.0.x  rc/ff = null,    exc-minor = v14.4.x,    patch = v14.3.x
        // Cases where two majors are in the works (unlikely- but technically possible)
        //    * next = v15.0.x, rc/ff = v14.0.0, exc-minor = null,       patch = v13.2.x
        //    * next = v15.0.x, rc/ff = v14.0.0, exc-minor = v13.3.x,    patch = v13.2.x
        majorVersionsToFetch.push(nextVersion.major - 1, nextVersion.major - 2);
        checks.isValidReleaseCandidateVersion = (v) => v.major === nextVersion.major - 1;
        checks.canHaveExceptionalMinor = (rc) => rc === null || rc.isMajor;
        checks.isValidExceptionalMinorVersion = (v, rc) => v.major === (rc === null ? nextVersion.major : rc.version.major) - 1;
    }
    else if (nextVersion.minor === 1) {
        // CASE 2: Next is for the first minor of a major release. Potential release-candidate/feature-freeze
        // train is always guaranteed to be in the same major. Depending on if there is RC/FF, the patch train
        // would be in the same major, or in the previous one. Example scenarios:
        //    * next = v15.1.x, rc/ff = v15.0.x, exc-minor = null,       patch = v14.5.x
        //    * next = v15.1.x, rc/ff = v15.0.x, exc-minor = v14.6.x,    patch = v14.5.x
        //    * next = v15.1.x, rc/ff = null,    exc-minor = disallowed, patch = v15.0.x
        majorVersionsToFetch.push(nextVersion.major, nextVersion.major - 1);
        checks.isValidReleaseCandidateVersion = (v) => v.major === nextVersion.major;
        checks.canHaveExceptionalMinor = (rc) => rc !== null && rc.isMajor;
        checks.isValidExceptionalMinorVersion = (v, rc) => v.major === rc.version.major - 1;
    }
    else {
        // CASE 3: Next for a normal minor (other cases as above). Potential release-candidate/feature-freeze
        // train and the patch train are always guaranteed to be in the same major. Example scenarios:
        //    * next = v15.2.x, rc/ff = v15.1.x, exc-minor = disallowed, patch = v15.0.x
        //    * next = v15.2.x, rc/ff = null,    exc-minor = disallowed, patch = v15.1.x
        majorVersionsToFetch.push(nextVersion.major);
        checks.isValidReleaseCandidateVersion = (v) => v.major === nextVersion.major;
        checks.canHaveExceptionalMinor = () => false;
    }
    // Collect all version-branches that should be considered for the latest version-branch,
    // a potential exceptional minor train or feature-freeze/release-candidate train.
    const branches = await getBranchesForMajorVersions(repo, majorVersionsToFetch);
    const { latest, releaseCandidate, exceptionalMinor } = await findActiveReleaseTrainsFromVersionBranches(repo, next, branches, checks);
    if (latest === null) {
        throw Error(`Unable to determine the latest release-train. The following branches ` +
            `have been considered: [${branches.map((b) => b.name).join(', ')}]`);
    }
    return new ActiveReleaseTrains({ releaseCandidate, next, latest, exceptionalMinor });
}
/** Finds the currently active release trains from the specified version branches. */
async function findActiveReleaseTrainsFromVersionBranches(repo, next, branches, checks) {
    // Version representing the release-train currently in the next phase. Note that we ignore
    // patch and pre-release segments in order to be able to compare the next release train to
    // other release trains from version branches (which follow the `N.N.x` pattern).
    const nextReleaseTrainVersion = semver.parse(`${next.version.major}.${next.version.minor}.0`);
    const nextBranchName = repo.nextBranchName;
    let latest = null;
    let releaseCandidate = null;
    let exceptionalMinor = null;
    // Iterate through the captured branches and find the latest non-prerelease branch and a
    // potential release candidate branch. From the collected branches we iterate descending
    // order (most recent semantic version-branch first). The first branch is either the latest
    // active version branch (i.e. patch), a feature-freeze/release-candidate branch (ff/rc) or
    // an in-progress exceptional minor:
    //   * A FF/RC or exceptional minor branch cannot be more recent than the current next
    //     version-branch, so we stop iterating once we found such a branch.
    //   * As soon as we discover a version-branch not being an RC/FF or exceptional minor,
    //     we know it is the active patch branch. We stop looking further.
    //   * If we find a FF/RC branch, we continue looking for the next version-branch as
    //     that one has to be an exceptional minor, or the latest active version-branch.
    for (const { name, parsed } of branches) {
        // It can happen that version branches have been accidentally created which are more recent
        // than the release-train in the next branch (i.e. `main`). We could ignore such branches
        // silently, but it might be symptomatic for an outdated version in the `next` branch, or an
        // accidentally created branch by the caretaker. In either way we want to raise awareness.
        if (semver.gt(parsed, nextReleaseTrainVersion)) {
            throw Error(`Discovered unexpected version-branch "${name}" for a release-train that is ` +
                `more recent than the release-train currently in the "${nextBranchName}" branch. ` +
                `Please either delete the branch if created by accident, or update the outdated ` +
                `version in the next branch (${nextBranchName}).`);
        }
        else if (semver.eq(parsed, nextReleaseTrainVersion)) {
            throw Error(`Discovered unexpected version-branch "${name}" for a release-train that is already ` +
                `active in the "${nextBranchName}" branch. Please either delete the branch if ` +
                `created by accident, or update the version in the next branch (${nextBranchName}).`);
        }
        const { version, isExceptionalMinor } = await getVersionInfoForBranch(repo, name);
        const releaseTrain = new ReleaseTrain(name, version);
        const isPrerelease = version.prerelease[0] === 'rc' || version.prerelease[0] === 'next';
        if (isExceptionalMinor) {
            if (exceptionalMinor !== null) {
                throw Error(`Unable to determine latest release-train. Found an additional exceptional minor ` +
                    `version branch: "${name}". Already discovered: ${exceptionalMinor.branchName}.`);
            }
            if (!checks.canHaveExceptionalMinor(releaseCandidate)) {
                throw Error(`Unable to determine latest release-train. Found an unexpected exceptional minor ` +
                    `version branch: "${name}". No exceptional minor is currently allowed.`);
            }
            if (!checks.isValidExceptionalMinorVersion(version, releaseCandidate)) {
                throw Error(`Unable to determine latest release-train. Found an invalid exceptional ` +
                    `minor version branch: "${name}". Invalid version: ${version}.`);
            }
            exceptionalMinor = releaseTrain;
            continue;
        }
        if (isPrerelease) {
            if (exceptionalMinor !== null) {
                throw Error(`Unable to determine latest release-train. Discovered a feature-freeze/release-candidate ` +
                    `version branch (${name}) that is older than an in-progress exceptional ` +
                    `minor (${exceptionalMinor.branchName}).`);
            }
            if (releaseCandidate !== null) {
                throw Error(`Unable to determine latest release-train. Found two consecutive ` +
                    `pre-release version branches. No exceptional minors are allowed currently, and ` +
                    `there cannot be multiple feature-freeze/release-candidate branches: "${name}".`);
            }
            if (!checks.isValidReleaseCandidateVersion(version)) {
                throw Error(`Discovered unexpected old feature-freeze/release-candidate branch. Expected no ` +
                    `version-branch in feature-freeze/release-candidate mode for v${version.major}.`);
            }
            releaseCandidate = releaseTrain;
            continue;
        }
        // The first non-prerelease and non-exceptional-minor branch is always picked up
        // as the release-train for `latest`. Once we discovered the latest release train,
        // we skip looking further as there are no possible older active release trains.
        latest = releaseTrain;
        break;
    }
    return { releaseCandidate: releaseCandidate, exceptionalMinor, latest };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aXZlLXJlbGVhc2UtdHJhaW5zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbmctZGV2L3JlbGVhc2UvdmVyc2lvbmluZy9hY3RpdmUtcmVsZWFzZS10cmFpbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBRTVCLE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUNqRCxPQUFPLEVBQ0wsMkJBQTJCLEVBQzNCLHVCQUF1QixHQUd4QixNQUFNLHVCQUF1QixDQUFDO0FBUS9CLCtDQUErQztBQUMvQyxNQUFNLE9BQU8sbUJBQW1CO0lBVTlCLFlBQ1UsTUFLUDtRQUxPLFdBQU0sR0FBTixNQUFNLENBS2I7UUFmSCxvRkFBb0Y7UUFDM0UscUJBQWdCLEdBQXdCLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7UUFDOUUseUNBQXlDO1FBQ2hDLFNBQUksR0FBaUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDL0MscURBQXFEO1FBQzVDLFdBQU0sR0FBaUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDbkQsMERBQTBEO1FBQ2pELHFCQUFnQixHQUF3QixJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDO0lBUzNFLENBQUM7SUFFSiw4RkFBOEY7SUFDOUYsZUFBZTtRQUNiLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixLQUFLLElBQUksSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsS0FBSyxNQUFNLENBQUM7SUFDbEcsQ0FBQztJQUVELG9FQUFvRTtJQUNwRSxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUF3QjtRQUN6QyxPQUFPLHdCQUF3QixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hDLENBQUM7Q0FDRjtBQUVELG9FQUFvRTtBQUNwRSxLQUFLLFVBQVUsd0JBQXdCLENBQUMsSUFBd0I7SUFDOUQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQztJQUMzQyxNQUFNLEVBQUMsT0FBTyxFQUFFLFdBQVcsRUFBQyxHQUFHLE1BQU0sdUJBQXVCLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBQ25GLE1BQU0sSUFBSSxHQUFHLElBQUksWUFBWSxDQUFDLGNBQWMsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUMzRCxNQUFNLG9CQUFvQixHQUFhLEVBQUUsQ0FBQztJQUMxQyxNQUFNLE1BQU0sR0FBMEI7UUFDcEMsdUJBQXVCLEVBQUUsR0FBRyxFQUFFLENBQUMsS0FBSztRQUNwQyw4QkFBOEIsRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLO1FBQzNDLDhCQUE4QixFQUFFLEdBQUcsRUFBRSxDQUFDLEtBQUs7S0FDNUMsQ0FBQztJQUVGLElBQUksV0FBVyxDQUFDLEtBQUssS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUM1QixvRkFBb0Y7UUFDcEYsdUZBQXVGO1FBQ3ZGLHlGQUF5RjtRQUN6RixpQkFBaUI7UUFFakIscUJBQXFCO1FBQ3JCLGdGQUFnRjtRQUNoRixnRkFBZ0Y7UUFDaEYsZ0ZBQWdGO1FBQ2hGLCtFQUErRTtRQUMvRSxnRkFBZ0Y7UUFDaEYsZ0ZBQWdGO1FBQ2hGLG9CQUFvQixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxHQUFHLENBQUMsRUFBRSxXQUFXLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3hFLE1BQU0sQ0FBQyw4QkFBOEIsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssS0FBSyxXQUFXLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztRQUNqRixNQUFNLENBQUMsdUJBQXVCLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQztRQUNuRSxNQUFNLENBQUMsOEJBQThCLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FDaEQsQ0FBQyxDQUFDLEtBQUssS0FBSyxDQUFDLEVBQUUsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3pFLENBQUM7U0FBTSxJQUFJLFdBQVcsQ0FBQyxLQUFLLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDbkMscUdBQXFHO1FBQ3JHLHNHQUFzRztRQUN0Ryx5RUFBeUU7UUFDekUsZ0ZBQWdGO1FBQ2hGLGdGQUFnRjtRQUNoRixnRkFBZ0Y7UUFDaEYsb0JBQW9CLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsV0FBVyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNwRSxNQUFNLENBQUMsOEJBQThCLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEtBQUssV0FBVyxDQUFDLEtBQUssQ0FBQztRQUM3RSxNQUFNLENBQUMsdUJBQXVCLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQztRQUNuRSxNQUFNLENBQUMsOEJBQThCLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxLQUFLLEVBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztJQUN2RixDQUFDO1NBQU0sQ0FBQztRQUNOLHFHQUFxRztRQUNyRyw4RkFBOEY7UUFDOUYsZ0ZBQWdGO1FBQ2hGLGdGQUFnRjtRQUNoRixvQkFBb0IsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzdDLE1BQU0sQ0FBQyw4QkFBOEIsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssS0FBSyxXQUFXLENBQUMsS0FBSyxDQUFDO1FBQzdFLE1BQU0sQ0FBQyx1QkFBdUIsR0FBRyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUM7SUFDL0MsQ0FBQztJQUVELHdGQUF3RjtJQUN4RixpRkFBaUY7SUFDakYsTUFBTSxRQUFRLEdBQUcsTUFBTSwyQkFBMkIsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztJQUMvRSxNQUFNLEVBQUMsTUFBTSxFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFDLEdBQ2hELE1BQU0sMENBQTBDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFFakYsSUFBSSxNQUFNLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDcEIsTUFBTSxLQUFLLENBQ1QsdUVBQXVFO1lBQ3JFLDBCQUEwQixRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQ3RFLENBQUM7SUFDSixDQUFDO0lBRUQsT0FBTyxJQUFJLG1CQUFtQixDQUFDLEVBQUMsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxnQkFBZ0IsRUFBQyxDQUFDLENBQUM7QUFDckYsQ0FBQztBQUVELHFGQUFxRjtBQUNyRixLQUFLLFVBQVUsMENBQTBDLENBQ3ZELElBQXdCLEVBQ3hCLElBQWtCLEVBQ2xCLFFBQXlCLEVBQ3pCLE1BQTZCO0lBTTdCLDBGQUEwRjtJQUMxRiwwRkFBMEY7SUFDMUYsaUZBQWlGO0lBQ2pGLE1BQU0sdUJBQXVCLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLENBQUUsQ0FBQztJQUMvRixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDO0lBRTNDLElBQUksTUFBTSxHQUF3QixJQUFJLENBQUM7SUFDdkMsSUFBSSxnQkFBZ0IsR0FBd0IsSUFBSSxDQUFDO0lBQ2pELElBQUksZ0JBQWdCLEdBQXdCLElBQUksQ0FBQztJQUVqRCx3RkFBd0Y7SUFDeEYsd0ZBQXdGO0lBQ3hGLDJGQUEyRjtJQUMzRiwyRkFBMkY7SUFDM0Ysb0NBQW9DO0lBQ3BDLHNGQUFzRjtJQUN0Rix3RUFBd0U7SUFDeEUsdUZBQXVGO0lBQ3ZGLHNFQUFzRTtJQUN0RSxvRkFBb0Y7SUFDcEYsb0ZBQW9GO0lBQ3BGLEtBQUssTUFBTSxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUMsSUFBSSxRQUFRLEVBQUUsQ0FBQztRQUN0QywyRkFBMkY7UUFDM0YseUZBQXlGO1FBQ3pGLDRGQUE0RjtRQUM1RiwwRkFBMEY7UUFDMUYsSUFBSSxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSx1QkFBdUIsQ0FBQyxFQUFFLENBQUM7WUFDL0MsTUFBTSxLQUFLLENBQ1QseUNBQXlDLElBQUksZ0NBQWdDO2dCQUMzRSx3REFBd0QsY0FBYyxZQUFZO2dCQUNsRixpRkFBaUY7Z0JBQ2pGLCtCQUErQixjQUFjLElBQUksQ0FDcEQsQ0FBQztRQUNKLENBQUM7YUFBTSxJQUFJLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLHVCQUF1QixDQUFDLEVBQUUsQ0FBQztZQUN0RCxNQUFNLEtBQUssQ0FDVCx5Q0FBeUMsSUFBSSx3Q0FBd0M7Z0JBQ25GLGtCQUFrQixjQUFjLCtDQUErQztnQkFDL0Usa0VBQWtFLGNBQWMsSUFBSSxDQUN2RixDQUFDO1FBQ0osQ0FBQztRQUVELE1BQU0sRUFBQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUMsR0FBRyxNQUFNLHVCQUF1QixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNoRixNQUFNLFlBQVksR0FBRyxJQUFJLFlBQVksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDckQsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsS0FBSyxNQUFNLENBQUM7UUFFeEYsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO1lBQ3ZCLElBQUksZ0JBQWdCLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQzlCLE1BQU0sS0FBSyxDQUNULGtGQUFrRjtvQkFDaEYsb0JBQW9CLElBQUksMEJBQTBCLGdCQUFnQixDQUFDLFVBQVUsR0FBRyxDQUNuRixDQUFDO1lBQ0osQ0FBQztZQUNELElBQUksQ0FBQyxNQUFNLENBQUMsdUJBQXVCLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDO2dCQUN0RCxNQUFNLEtBQUssQ0FDVCxrRkFBa0Y7b0JBQ2hGLG9CQUFvQixJQUFJLCtDQUErQyxDQUMxRSxDQUFDO1lBQ0osQ0FBQztZQUNELElBQUksQ0FBQyxNQUFNLENBQUMsOEJBQThCLENBQUMsT0FBTyxFQUFFLGdCQUFnQixDQUFDLEVBQUUsQ0FBQztnQkFDdEUsTUFBTSxLQUFLLENBQ1QseUVBQXlFO29CQUN2RSwwQkFBMEIsSUFBSSx1QkFBdUIsT0FBTyxHQUFHLENBQ2xFLENBQUM7WUFDSixDQUFDO1lBQ0QsZ0JBQWdCLEdBQUcsWUFBWSxDQUFDO1lBQ2hDLFNBQVM7UUFDWCxDQUFDO1FBRUQsSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUNqQixJQUFJLGdCQUFnQixLQUFLLElBQUksRUFBRSxDQUFDO2dCQUM5QixNQUFNLEtBQUssQ0FDVCwwRkFBMEY7b0JBQ3hGLG1CQUFtQixJQUFJLGtEQUFrRDtvQkFDekUsVUFBVSxnQkFBZ0IsQ0FBQyxVQUFVLElBQUksQ0FDNUMsQ0FBQztZQUNKLENBQUM7WUFDRCxJQUFJLGdCQUFnQixLQUFLLElBQUksRUFBRSxDQUFDO2dCQUM5QixNQUFNLEtBQUssQ0FDVCxrRUFBa0U7b0JBQ2hFLGlGQUFpRjtvQkFDakYsd0VBQXdFLElBQUksSUFBSSxDQUNuRixDQUFDO1lBQ0osQ0FBQztZQUNELElBQUksQ0FBQyxNQUFNLENBQUMsOEJBQThCLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztnQkFDcEQsTUFBTSxLQUFLLENBQ1QsaUZBQWlGO29CQUMvRSxnRUFBZ0UsT0FBTyxDQUFDLEtBQUssR0FBRyxDQUNuRixDQUFDO1lBQ0osQ0FBQztZQUNELGdCQUFnQixHQUFHLFlBQVksQ0FBQztZQUNoQyxTQUFTO1FBQ1gsQ0FBQztRQUVELGdGQUFnRjtRQUNoRixrRkFBa0Y7UUFDbEYsZ0ZBQWdGO1FBQ2hGLE1BQU0sR0FBRyxZQUFZLENBQUM7UUFDdEIsTUFBTTtJQUNSLENBQUM7SUFFRCxPQUFPLEVBQUMsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxFQUFDLENBQUM7QUFDeEUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XG5cbmltcG9ydCB7UmVsZWFzZVRyYWlufSBmcm9tICcuL3JlbGVhc2UtdHJhaW5zLmpzJztcbmltcG9ydCB7XG4gIGdldEJyYW5jaGVzRm9yTWFqb3JWZXJzaW9ucyxcbiAgZ2V0VmVyc2lvbkluZm9Gb3JCcmFuY2gsXG4gIFJlbGVhc2VSZXBvV2l0aEFwaSxcbiAgVmVyc2lvbkJyYW5jaCxcbn0gZnJvbSAnLi92ZXJzaW9uLWJyYW5jaGVzLmpzJztcblxuaW50ZXJmYWNlIERldGVybWluYXRpb25DaGVja0ZucyB7XG4gIGNhbkhhdmVFeGNlcHRpb25hbE1pbm9yOiAocmM6IFJlbGVhc2VUcmFpbiB8IG51bGwpID0+IGJvb2xlYW47XG4gIGlzVmFsaWRSZWxlYXNlQ2FuZGlkYXRlVmVyc2lvbjogKHY6IHNlbXZlci5TZW1WZXIpID0+IGJvb2xlYW47XG4gIGlzVmFsaWRFeGNlcHRpb25hbE1pbm9yVmVyc2lvbjogKHY6IHNlbXZlci5TZW1WZXIsIHJjOiBSZWxlYXNlVHJhaW4gfCBudWxsKSA9PiBib29sZWFuO1xufVxuXG4vKiogVGhlIGFjdGl2ZSByZWxlYXNlIHRyYWlucyBmb3IgYSBwcm9qZWN0LiAqL1xuZXhwb3J0IGNsYXNzIEFjdGl2ZVJlbGVhc2VUcmFpbnMge1xuICAvKiogUmVsZWFzZS10cmFpbiBjdXJyZW50bHkgaW4gdGhlIFwicmVsZWFzZS1jYW5kaWRhdGVcIiBvciBcImZlYXR1cmUtZnJlZXplXCIgcGhhc2UuICovXG4gIHJlYWRvbmx5IHJlbGVhc2VDYW5kaWRhdGU6IFJlbGVhc2VUcmFpbiB8IG51bGwgPSB0aGlzLnRyYWlucy5yZWxlYXNlQ2FuZGlkYXRlO1xuICAvKiogUmVsZWFzZS10cmFpbiBpbiB0aGUgYG5leHRgIHBoYXNlLiAqL1xuICByZWFkb25seSBuZXh0OiBSZWxlYXNlVHJhaW4gPSB0aGlzLnRyYWlucy5uZXh0O1xuICAvKiogUmVsZWFzZS10cmFpbiBjdXJyZW50bHkgaW4gdGhlIFwibGF0ZXN0XCIgcGhhc2UuICovXG4gIHJlYWRvbmx5IGxhdGVzdDogUmVsZWFzZVRyYWluID0gdGhpcy50cmFpbnMubGF0ZXN0O1xuICAvKiogUmVsZWFzZS10cmFpbiBmb3IgYW4gZXhjZXB0aW9uYWwgbWlub3IgaW4gcHJvZ3Jlc3MuICovXG4gIHJlYWRvbmx5IGV4Y2VwdGlvbmFsTWlub3I6IFJlbGVhc2VUcmFpbiB8IG51bGwgPSB0aGlzLnRyYWlucy5leGNlcHRpb25hbE1pbm9yO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgdHJhaW5zOiB7XG4gICAgICByZWxlYXNlQ2FuZGlkYXRlOiBSZWxlYXNlVHJhaW4gfCBudWxsO1xuICAgICAgZXhjZXB0aW9uYWxNaW5vcjogUmVsZWFzZVRyYWluIHwgbnVsbDtcbiAgICAgIG5leHQ6IFJlbGVhc2VUcmFpbjtcbiAgICAgIGxhdGVzdDogUmVsZWFzZVRyYWluO1xuICAgIH0sXG4gICkge31cblxuICAvKiogV2hldGhlciB0aGUgYWN0aXZlIHJlbGVhc2UgdHJhaW5zIGluZGljYXRlIHRoZSByZXBvc2l0b3J5IGlzIGluIGEgZmVhdHVyZSBmcmVlemUgc3RhdGUuICovXG4gIGlzRmVhdHVyZUZyZWV6ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWxlYXNlQ2FuZGlkYXRlICE9PSBudWxsICYmIHRoaXMucmVsZWFzZUNhbmRpZGF0ZS52ZXJzaW9uLnByZXJlbGVhc2VbMF0gPT09ICduZXh0JztcbiAgfVxuXG4gIC8qKiBGZXRjaGVzIHRoZSBhY3RpdmUgcmVsZWFzZSB0cmFpbnMgZm9yIHRoZSBjb25maWd1cmVkIHByb2plY3QuICovXG4gIHN0YXRpYyBhc3luYyBmZXRjaChyZXBvOiBSZWxlYXNlUmVwb1dpdGhBcGkpOiBQcm9taXNlPEFjdGl2ZVJlbGVhc2VUcmFpbnM+IHtcbiAgICByZXR1cm4gZmV0Y2hBY3RpdmVSZWxlYXNlVHJhaW5zKHJlcG8pO1xuICB9XG59XG5cbi8qKiBGZXRjaGVzIHRoZSBhY3RpdmUgcmVsZWFzZSB0cmFpbnMgZm9yIHRoZSBjb25maWd1cmVkIHByb2plY3QuICovXG5hc3luYyBmdW5jdGlvbiBmZXRjaEFjdGl2ZVJlbGVhc2VUcmFpbnMocmVwbzogUmVsZWFzZVJlcG9XaXRoQXBpKTogUHJvbWlzZTxBY3RpdmVSZWxlYXNlVHJhaW5zPiB7XG4gIGNvbnN0IG5leHRCcmFuY2hOYW1lID0gcmVwby5uZXh0QnJhbmNoTmFtZTtcbiAgY29uc3Qge3ZlcnNpb246IG5leHRWZXJzaW9ufSA9IGF3YWl0IGdldFZlcnNpb25JbmZvRm9yQnJhbmNoKHJlcG8sIG5leHRCcmFuY2hOYW1lKTtcbiAgY29uc3QgbmV4dCA9IG5ldyBSZWxlYXNlVHJhaW4obmV4dEJyYW5jaE5hbWUsIG5leHRWZXJzaW9uKTtcbiAgY29uc3QgbWFqb3JWZXJzaW9uc1RvRmV0Y2g6IG51bWJlcltdID0gW107XG4gIGNvbnN0IGNoZWNrczogRGV0ZXJtaW5hdGlvbkNoZWNrRm5zID0ge1xuICAgIGNhbkhhdmVFeGNlcHRpb25hbE1pbm9yOiAoKSA9PiBmYWxzZSxcbiAgICBpc1ZhbGlkUmVsZWFzZUNhbmRpZGF0ZVZlcnNpb246ICgpID0+IGZhbHNlLFxuICAgIGlzVmFsaWRFeGNlcHRpb25hbE1pbm9yVmVyc2lvbjogKCkgPT4gZmFsc2UsXG4gIH07XG5cbiAgaWYgKG5leHRWZXJzaW9uLm1pbm9yID09PSAwKSB7XG4gICAgLy8gQ0FTRSAxOiBOZXh0IGlzIGZvciBhIG5ldyBtYWpvci4gUG90ZW50aWFsIHJlbGVhc2UtY2FuZGlkYXRlL2ZlYXR1cmUtZnJlZXplIHRyYWluXG4gICAgLy8gY2FuIG9ubHkgYmUgZm9yIHRoZSBwcmV2aW91cyBtYWpvci4gVXN1YWxseSBwYXRjaCBpcyBpbiB0aGUgc2FtZSBtaW5vciBhcyBmb3IgUkMvRkYsXG4gICAgLy8gYnV0IHRlY2huaWNhbGx5IHR3byBtYWpvcnMgY2FuIGJlIGluIHRoZSB3b3Jrcywgc28gd2UgYWxzbyBuZWVkIHRvIGNvbnNpZGVyIHRoZSBzZWNvbmRcbiAgICAvLyBwcmV2aW91cyBtYWpvclxuXG4gICAgLy8gRXhhbXBsZSBzY2VuYXJpb3M6XG4gICAgLy8gICAgKiBuZXh0ID0gdjE1LjAueCwgcmMvZmYgPSB2MTQuNC54LCBleGMtbWlub3IgPSBkaXNhbGxvd2VkLCBwYXRjaCA9IHYxNC4zLnhcbiAgICAvLyAgICAqIG5leHQgPSB2MTUuMC54ICByYy9mZiA9IG51bGwsICAgIGV4Yy1taW5vciA9IG51bGwsICAgICAgIHBhdGNoID0gdjE0LjMueFxuICAgIC8vICAgICogbmV4dCA9IHYxNS4wLnggIHJjL2ZmID0gbnVsbCwgICAgZXhjLW1pbm9yID0gdjE0LjQueCwgICAgcGF0Y2ggPSB2MTQuMy54XG4gICAgLy8gQ2FzZXMgd2hlcmUgdHdvIG1ham9ycyBhcmUgaW4gdGhlIHdvcmtzICh1bmxpa2VseS0gYnV0IHRlY2huaWNhbGx5IHBvc3NpYmxlKVxuICAgIC8vICAgICogbmV4dCA9IHYxNS4wLngsIHJjL2ZmID0gdjE0LjAuMCwgZXhjLW1pbm9yID0gbnVsbCwgICAgICAgcGF0Y2ggPSB2MTMuMi54XG4gICAgLy8gICAgKiBuZXh0ID0gdjE1LjAueCwgcmMvZmYgPSB2MTQuMC4wLCBleGMtbWlub3IgPSB2MTMuMy54LCAgICBwYXRjaCA9IHYxMy4yLnhcbiAgICBtYWpvclZlcnNpb25zVG9GZXRjaC5wdXNoKG5leHRWZXJzaW9uLm1ham9yIC0gMSwgbmV4dFZlcnNpb24ubWFqb3IgLSAyKTtcbiAgICBjaGVja3MuaXNWYWxpZFJlbGVhc2VDYW5kaWRhdGVWZXJzaW9uID0gKHYpID0+IHYubWFqb3IgPT09IG5leHRWZXJzaW9uLm1ham9yIC0gMTtcbiAgICBjaGVja3MuY2FuSGF2ZUV4Y2VwdGlvbmFsTWlub3IgPSAocmMpID0+IHJjID09PSBudWxsIHx8IHJjLmlzTWFqb3I7XG4gICAgY2hlY2tzLmlzVmFsaWRFeGNlcHRpb25hbE1pbm9yVmVyc2lvbiA9ICh2LCByYykgPT5cbiAgICAgIHYubWFqb3IgPT09IChyYyA9PT0gbnVsbCA/IG5leHRWZXJzaW9uLm1ham9yIDogcmMudmVyc2lvbi5tYWpvcikgLSAxO1xuICB9IGVsc2UgaWYgKG5leHRWZXJzaW9uLm1pbm9yID09PSAxKSB7XG4gICAgLy8gQ0FTRSAyOiBOZXh0IGlzIGZvciB0aGUgZmlyc3QgbWlub3Igb2YgYSBtYWpvciByZWxlYXNlLiBQb3RlbnRpYWwgcmVsZWFzZS1jYW5kaWRhdGUvZmVhdHVyZS1mcmVlemVcbiAgICAvLyB0cmFpbiBpcyBhbHdheXMgZ3VhcmFudGVlZCB0byBiZSBpbiB0aGUgc2FtZSBtYWpvci4gRGVwZW5kaW5nIG9uIGlmIHRoZXJlIGlzIFJDL0ZGLCB0aGUgcGF0Y2ggdHJhaW5cbiAgICAvLyB3b3VsZCBiZSBpbiB0aGUgc2FtZSBtYWpvciwgb3IgaW4gdGhlIHByZXZpb3VzIG9uZS4gRXhhbXBsZSBzY2VuYXJpb3M6XG4gICAgLy8gICAgKiBuZXh0ID0gdjE1LjEueCwgcmMvZmYgPSB2MTUuMC54LCBleGMtbWlub3IgPSBudWxsLCAgICAgICBwYXRjaCA9IHYxNC41LnhcbiAgICAvLyAgICAqIG5leHQgPSB2MTUuMS54LCByYy9mZiA9IHYxNS4wLngsIGV4Yy1taW5vciA9IHYxNC42LngsICAgIHBhdGNoID0gdjE0LjUueFxuICAgIC8vICAgICogbmV4dCA9IHYxNS4xLngsIHJjL2ZmID0gbnVsbCwgICAgZXhjLW1pbm9yID0gZGlzYWxsb3dlZCwgcGF0Y2ggPSB2MTUuMC54XG4gICAgbWFqb3JWZXJzaW9uc1RvRmV0Y2gucHVzaChuZXh0VmVyc2lvbi5tYWpvciwgbmV4dFZlcnNpb24ubWFqb3IgLSAxKTtcbiAgICBjaGVja3MuaXNWYWxpZFJlbGVhc2VDYW5kaWRhdGVWZXJzaW9uID0gKHYpID0+IHYubWFqb3IgPT09IG5leHRWZXJzaW9uLm1ham9yO1xuICAgIGNoZWNrcy5jYW5IYXZlRXhjZXB0aW9uYWxNaW5vciA9IChyYykgPT4gcmMgIT09IG51bGwgJiYgcmMuaXNNYWpvcjtcbiAgICBjaGVja3MuaXNWYWxpZEV4Y2VwdGlvbmFsTWlub3JWZXJzaW9uID0gKHYsIHJjKSA9PiB2Lm1ham9yID09PSByYyEudmVyc2lvbi5tYWpvciAtIDE7XG4gIH0gZWxzZSB7XG4gICAgLy8gQ0FTRSAzOiBOZXh0IGZvciBhIG5vcm1hbCBtaW5vciAob3RoZXIgY2FzZXMgYXMgYWJvdmUpLiBQb3RlbnRpYWwgcmVsZWFzZS1jYW5kaWRhdGUvZmVhdHVyZS1mcmVlemVcbiAgICAvLyB0cmFpbiBhbmQgdGhlIHBhdGNoIHRyYWluIGFyZSBhbHdheXMgZ3VhcmFudGVlZCB0byBiZSBpbiB0aGUgc2FtZSBtYWpvci4gRXhhbXBsZSBzY2VuYXJpb3M6XG4gICAgLy8gICAgKiBuZXh0ID0gdjE1LjIueCwgcmMvZmYgPSB2MTUuMS54LCBleGMtbWlub3IgPSBkaXNhbGxvd2VkLCBwYXRjaCA9IHYxNS4wLnhcbiAgICAvLyAgICAqIG5leHQgPSB2MTUuMi54LCByYy9mZiA9IG51bGwsICAgIGV4Yy1taW5vciA9IGRpc2FsbG93ZWQsIHBhdGNoID0gdjE1LjEueFxuICAgIG1ham9yVmVyc2lvbnNUb0ZldGNoLnB1c2gobmV4dFZlcnNpb24ubWFqb3IpO1xuICAgIGNoZWNrcy5pc1ZhbGlkUmVsZWFzZUNhbmRpZGF0ZVZlcnNpb24gPSAodikgPT4gdi5tYWpvciA9PT0gbmV4dFZlcnNpb24ubWFqb3I7XG4gICAgY2hlY2tzLmNhbkhhdmVFeGNlcHRpb25hbE1pbm9yID0gKCkgPT4gZmFsc2U7XG4gIH1cblxuICAvLyBDb2xsZWN0IGFsbCB2ZXJzaW9uLWJyYW5jaGVzIHRoYXQgc2hvdWxkIGJlIGNvbnNpZGVyZWQgZm9yIHRoZSBsYXRlc3QgdmVyc2lvbi1icmFuY2gsXG4gIC8vIGEgcG90ZW50aWFsIGV4Y2VwdGlvbmFsIG1pbm9yIHRyYWluIG9yIGZlYXR1cmUtZnJlZXplL3JlbGVhc2UtY2FuZGlkYXRlIHRyYWluLlxuICBjb25zdCBicmFuY2hlcyA9IGF3YWl0IGdldEJyYW5jaGVzRm9yTWFqb3JWZXJzaW9ucyhyZXBvLCBtYWpvclZlcnNpb25zVG9GZXRjaCk7XG4gIGNvbnN0IHtsYXRlc3QsIHJlbGVhc2VDYW5kaWRhdGUsIGV4Y2VwdGlvbmFsTWlub3J9ID1cbiAgICBhd2FpdCBmaW5kQWN0aXZlUmVsZWFzZVRyYWluc0Zyb21WZXJzaW9uQnJhbmNoZXMocmVwbywgbmV4dCwgYnJhbmNoZXMsIGNoZWNrcyk7XG5cbiAgaWYgKGxhdGVzdCA9PT0gbnVsbCkge1xuICAgIHRocm93IEVycm9yKFxuICAgICAgYFVuYWJsZSB0byBkZXRlcm1pbmUgdGhlIGxhdGVzdCByZWxlYXNlLXRyYWluLiBUaGUgZm9sbG93aW5nIGJyYW5jaGVzIGAgK1xuICAgICAgICBgaGF2ZSBiZWVuIGNvbnNpZGVyZWQ6IFske2JyYW5jaGVzLm1hcCgoYikgPT4gYi5uYW1lKS5qb2luKCcsICcpfV1gLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gbmV3IEFjdGl2ZVJlbGVhc2VUcmFpbnMoe3JlbGVhc2VDYW5kaWRhdGUsIG5leHQsIGxhdGVzdCwgZXhjZXB0aW9uYWxNaW5vcn0pO1xufVxuXG4vKiogRmluZHMgdGhlIGN1cnJlbnRseSBhY3RpdmUgcmVsZWFzZSB0cmFpbnMgZnJvbSB0aGUgc3BlY2lmaWVkIHZlcnNpb24gYnJhbmNoZXMuICovXG5hc3luYyBmdW5jdGlvbiBmaW5kQWN0aXZlUmVsZWFzZVRyYWluc0Zyb21WZXJzaW9uQnJhbmNoZXMoXG4gIHJlcG86IFJlbGVhc2VSZXBvV2l0aEFwaSxcbiAgbmV4dDogUmVsZWFzZVRyYWluLFxuICBicmFuY2hlczogVmVyc2lvbkJyYW5jaFtdLFxuICBjaGVja3M6IERldGVybWluYXRpb25DaGVja0Zucyxcbik6IFByb21pc2U8e1xuICBsYXRlc3Q6IFJlbGVhc2VUcmFpbiB8IG51bGw7XG4gIHJlbGVhc2VDYW5kaWRhdGU6IFJlbGVhc2VUcmFpbiB8IG51bGw7XG4gIGV4Y2VwdGlvbmFsTWlub3I6IFJlbGVhc2VUcmFpbiB8IG51bGw7XG59PiB7XG4gIC8vIFZlcnNpb24gcmVwcmVzZW50aW5nIHRoZSByZWxlYXNlLXRyYWluIGN1cnJlbnRseSBpbiB0aGUgbmV4dCBwaGFzZS4gTm90ZSB0aGF0IHdlIGlnbm9yZVxuICAvLyBwYXRjaCBhbmQgcHJlLXJlbGVhc2Ugc2VnbWVudHMgaW4gb3JkZXIgdG8gYmUgYWJsZSB0byBjb21wYXJlIHRoZSBuZXh0IHJlbGVhc2UgdHJhaW4gdG9cbiAgLy8gb3RoZXIgcmVsZWFzZSB0cmFpbnMgZnJvbSB2ZXJzaW9uIGJyYW5jaGVzICh3aGljaCBmb2xsb3cgdGhlIGBOLk4ueGAgcGF0dGVybikuXG4gIGNvbnN0IG5leHRSZWxlYXNlVHJhaW5WZXJzaW9uID0gc2VtdmVyLnBhcnNlKGAke25leHQudmVyc2lvbi5tYWpvcn0uJHtuZXh0LnZlcnNpb24ubWlub3J9LjBgKSE7XG4gIGNvbnN0IG5leHRCcmFuY2hOYW1lID0gcmVwby5uZXh0QnJhbmNoTmFtZTtcblxuICBsZXQgbGF0ZXN0OiBSZWxlYXNlVHJhaW4gfCBudWxsID0gbnVsbDtcbiAgbGV0IHJlbGVhc2VDYW5kaWRhdGU6IFJlbGVhc2VUcmFpbiB8IG51bGwgPSBudWxsO1xuICBsZXQgZXhjZXB0aW9uYWxNaW5vcjogUmVsZWFzZVRyYWluIHwgbnVsbCA9IG51bGw7XG5cbiAgLy8gSXRlcmF0ZSB0aHJvdWdoIHRoZSBjYXB0dXJlZCBicmFuY2hlcyBhbmQgZmluZCB0aGUgbGF0ZXN0IG5vbi1wcmVyZWxlYXNlIGJyYW5jaCBhbmQgYVxuICAvLyBwb3RlbnRpYWwgcmVsZWFzZSBjYW5kaWRhdGUgYnJhbmNoLiBGcm9tIHRoZSBjb2xsZWN0ZWQgYnJhbmNoZXMgd2UgaXRlcmF0ZSBkZXNjZW5kaW5nXG4gIC8vIG9yZGVyIChtb3N0IHJlY2VudCBzZW1hbnRpYyB2ZXJzaW9uLWJyYW5jaCBmaXJzdCkuIFRoZSBmaXJzdCBicmFuY2ggaXMgZWl0aGVyIHRoZSBsYXRlc3RcbiAgLy8gYWN0aXZlIHZlcnNpb24gYnJhbmNoIChpLmUuIHBhdGNoKSwgYSBmZWF0dXJlLWZyZWV6ZS9yZWxlYXNlLWNhbmRpZGF0ZSBicmFuY2ggKGZmL3JjKSBvclxuICAvLyBhbiBpbi1wcm9ncmVzcyBleGNlcHRpb25hbCBtaW5vcjpcbiAgLy8gICAqIEEgRkYvUkMgb3IgZXhjZXB0aW9uYWwgbWlub3IgYnJhbmNoIGNhbm5vdCBiZSBtb3JlIHJlY2VudCB0aGFuIHRoZSBjdXJyZW50IG5leHRcbiAgLy8gICAgIHZlcnNpb24tYnJhbmNoLCBzbyB3ZSBzdG9wIGl0ZXJhdGluZyBvbmNlIHdlIGZvdW5kIHN1Y2ggYSBicmFuY2guXG4gIC8vICAgKiBBcyBzb29uIGFzIHdlIGRpc2NvdmVyIGEgdmVyc2lvbi1icmFuY2ggbm90IGJlaW5nIGFuIFJDL0ZGIG9yIGV4Y2VwdGlvbmFsIG1pbm9yLFxuICAvLyAgICAgd2Uga25vdyBpdCBpcyB0aGUgYWN0aXZlIHBhdGNoIGJyYW5jaC4gV2Ugc3RvcCBsb29raW5nIGZ1cnRoZXIuXG4gIC8vICAgKiBJZiB3ZSBmaW5kIGEgRkYvUkMgYnJhbmNoLCB3ZSBjb250aW51ZSBsb29raW5nIGZvciB0aGUgbmV4dCB2ZXJzaW9uLWJyYW5jaCBhc1xuICAvLyAgICAgdGhhdCBvbmUgaGFzIHRvIGJlIGFuIGV4Y2VwdGlvbmFsIG1pbm9yLCBvciB0aGUgbGF0ZXN0IGFjdGl2ZSB2ZXJzaW9uLWJyYW5jaC5cbiAgZm9yIChjb25zdCB7bmFtZSwgcGFyc2VkfSBvZiBicmFuY2hlcykge1xuICAgIC8vIEl0IGNhbiBoYXBwZW4gdGhhdCB2ZXJzaW9uIGJyYW5jaGVzIGhhdmUgYmVlbiBhY2NpZGVudGFsbHkgY3JlYXRlZCB3aGljaCBhcmUgbW9yZSByZWNlbnRcbiAgICAvLyB0aGFuIHRoZSByZWxlYXNlLXRyYWluIGluIHRoZSBuZXh0IGJyYW5jaCAoaS5lLiBgbWFpbmApLiBXZSBjb3VsZCBpZ25vcmUgc3VjaCBicmFuY2hlc1xuICAgIC8vIHNpbGVudGx5LCBidXQgaXQgbWlnaHQgYmUgc3ltcHRvbWF0aWMgZm9yIGFuIG91dGRhdGVkIHZlcnNpb24gaW4gdGhlIGBuZXh0YCBicmFuY2gsIG9yIGFuXG4gICAgLy8gYWNjaWRlbnRhbGx5IGNyZWF0ZWQgYnJhbmNoIGJ5IHRoZSBjYXJldGFrZXIuIEluIGVpdGhlciB3YXkgd2Ugd2FudCB0byByYWlzZSBhd2FyZW5lc3MuXG4gICAgaWYgKHNlbXZlci5ndChwYXJzZWQsIG5leHRSZWxlYXNlVHJhaW5WZXJzaW9uKSkge1xuICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgIGBEaXNjb3ZlcmVkIHVuZXhwZWN0ZWQgdmVyc2lvbi1icmFuY2ggXCIke25hbWV9XCIgZm9yIGEgcmVsZWFzZS10cmFpbiB0aGF0IGlzIGAgK1xuICAgICAgICAgIGBtb3JlIHJlY2VudCB0aGFuIHRoZSByZWxlYXNlLXRyYWluIGN1cnJlbnRseSBpbiB0aGUgXCIke25leHRCcmFuY2hOYW1lfVwiIGJyYW5jaC4gYCArXG4gICAgICAgICAgYFBsZWFzZSBlaXRoZXIgZGVsZXRlIHRoZSBicmFuY2ggaWYgY3JlYXRlZCBieSBhY2NpZGVudCwgb3IgdXBkYXRlIHRoZSBvdXRkYXRlZCBgICtcbiAgICAgICAgICBgdmVyc2lvbiBpbiB0aGUgbmV4dCBicmFuY2ggKCR7bmV4dEJyYW5jaE5hbWV9KS5gLFxuICAgICAgKTtcbiAgICB9IGVsc2UgaWYgKHNlbXZlci5lcShwYXJzZWQsIG5leHRSZWxlYXNlVHJhaW5WZXJzaW9uKSkge1xuICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgIGBEaXNjb3ZlcmVkIHVuZXhwZWN0ZWQgdmVyc2lvbi1icmFuY2ggXCIke25hbWV9XCIgZm9yIGEgcmVsZWFzZS10cmFpbiB0aGF0IGlzIGFscmVhZHkgYCArXG4gICAgICAgICAgYGFjdGl2ZSBpbiB0aGUgXCIke25leHRCcmFuY2hOYW1lfVwiIGJyYW5jaC4gUGxlYXNlIGVpdGhlciBkZWxldGUgdGhlIGJyYW5jaCBpZiBgICtcbiAgICAgICAgICBgY3JlYXRlZCBieSBhY2NpZGVudCwgb3IgdXBkYXRlIHRoZSB2ZXJzaW9uIGluIHRoZSBuZXh0IGJyYW5jaCAoJHtuZXh0QnJhbmNoTmFtZX0pLmAsXG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IHt2ZXJzaW9uLCBpc0V4Y2VwdGlvbmFsTWlub3J9ID0gYXdhaXQgZ2V0VmVyc2lvbkluZm9Gb3JCcmFuY2gocmVwbywgbmFtZSk7XG4gICAgY29uc3QgcmVsZWFzZVRyYWluID0gbmV3IFJlbGVhc2VUcmFpbihuYW1lLCB2ZXJzaW9uKTtcbiAgICBjb25zdCBpc1ByZXJlbGVhc2UgPSB2ZXJzaW9uLnByZXJlbGVhc2VbMF0gPT09ICdyYycgfHwgdmVyc2lvbi5wcmVyZWxlYXNlWzBdID09PSAnbmV4dCc7XG5cbiAgICBpZiAoaXNFeGNlcHRpb25hbE1pbm9yKSB7XG4gICAgICBpZiAoZXhjZXB0aW9uYWxNaW5vciAhPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICBgVW5hYmxlIHRvIGRldGVybWluZSBsYXRlc3QgcmVsZWFzZS10cmFpbi4gRm91bmQgYW4gYWRkaXRpb25hbCBleGNlcHRpb25hbCBtaW5vciBgICtcbiAgICAgICAgICAgIGB2ZXJzaW9uIGJyYW5jaDogXCIke25hbWV9XCIuIEFscmVhZHkgZGlzY292ZXJlZDogJHtleGNlcHRpb25hbE1pbm9yLmJyYW5jaE5hbWV9LmAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBpZiAoIWNoZWNrcy5jYW5IYXZlRXhjZXB0aW9uYWxNaW5vcihyZWxlYXNlQ2FuZGlkYXRlKSkge1xuICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICBgVW5hYmxlIHRvIGRldGVybWluZSBsYXRlc3QgcmVsZWFzZS10cmFpbi4gRm91bmQgYW4gdW5leHBlY3RlZCBleGNlcHRpb25hbCBtaW5vciBgICtcbiAgICAgICAgICAgIGB2ZXJzaW9uIGJyYW5jaDogXCIke25hbWV9XCIuIE5vIGV4Y2VwdGlvbmFsIG1pbm9yIGlzIGN1cnJlbnRseSBhbGxvd2VkLmAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBpZiAoIWNoZWNrcy5pc1ZhbGlkRXhjZXB0aW9uYWxNaW5vclZlcnNpb24odmVyc2lvbiwgcmVsZWFzZUNhbmRpZGF0ZSkpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgYFVuYWJsZSB0byBkZXRlcm1pbmUgbGF0ZXN0IHJlbGVhc2UtdHJhaW4uIEZvdW5kIGFuIGludmFsaWQgZXhjZXB0aW9uYWwgYCArXG4gICAgICAgICAgICBgbWlub3IgdmVyc2lvbiBicmFuY2g6IFwiJHtuYW1lfVwiLiBJbnZhbGlkIHZlcnNpb246ICR7dmVyc2lvbn0uYCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGV4Y2VwdGlvbmFsTWlub3IgPSByZWxlYXNlVHJhaW47XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoaXNQcmVyZWxlYXNlKSB7XG4gICAgICBpZiAoZXhjZXB0aW9uYWxNaW5vciAhPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICBgVW5hYmxlIHRvIGRldGVybWluZSBsYXRlc3QgcmVsZWFzZS10cmFpbi4gRGlzY292ZXJlZCBhIGZlYXR1cmUtZnJlZXplL3JlbGVhc2UtY2FuZGlkYXRlIGAgK1xuICAgICAgICAgICAgYHZlcnNpb24gYnJhbmNoICgke25hbWV9KSB0aGF0IGlzIG9sZGVyIHRoYW4gYW4gaW4tcHJvZ3Jlc3MgZXhjZXB0aW9uYWwgYCArXG4gICAgICAgICAgICBgbWlub3IgKCR7ZXhjZXB0aW9uYWxNaW5vci5icmFuY2hOYW1lfSkuYCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmIChyZWxlYXNlQ2FuZGlkYXRlICE9PSBudWxsKSB7XG4gICAgICAgIHRocm93IEVycm9yKFxuICAgICAgICAgIGBVbmFibGUgdG8gZGV0ZXJtaW5lIGxhdGVzdCByZWxlYXNlLXRyYWluLiBGb3VuZCB0d28gY29uc2VjdXRpdmUgYCArXG4gICAgICAgICAgICBgcHJlLXJlbGVhc2UgdmVyc2lvbiBicmFuY2hlcy4gTm8gZXhjZXB0aW9uYWwgbWlub3JzIGFyZSBhbGxvd2VkIGN1cnJlbnRseSwgYW5kIGAgK1xuICAgICAgICAgICAgYHRoZXJlIGNhbm5vdCBiZSBtdWx0aXBsZSBmZWF0dXJlLWZyZWV6ZS9yZWxlYXNlLWNhbmRpZGF0ZSBicmFuY2hlczogXCIke25hbWV9XCIuYCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmICghY2hlY2tzLmlzVmFsaWRSZWxlYXNlQ2FuZGlkYXRlVmVyc2lvbih2ZXJzaW9uKSkge1xuICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICBgRGlzY292ZXJlZCB1bmV4cGVjdGVkIG9sZCBmZWF0dXJlLWZyZWV6ZS9yZWxlYXNlLWNhbmRpZGF0ZSBicmFuY2guIEV4cGVjdGVkIG5vIGAgK1xuICAgICAgICAgICAgYHZlcnNpb24tYnJhbmNoIGluIGZlYXR1cmUtZnJlZXplL3JlbGVhc2UtY2FuZGlkYXRlIG1vZGUgZm9yIHYke3ZlcnNpb24ubWFqb3J9LmAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICByZWxlYXNlQ2FuZGlkYXRlID0gcmVsZWFzZVRyYWluO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gVGhlIGZpcnN0IG5vbi1wcmVyZWxlYXNlIGFuZCBub24tZXhjZXB0aW9uYWwtbWlub3IgYnJhbmNoIGlzIGFsd2F5cyBwaWNrZWQgdXBcbiAgICAvLyBhcyB0aGUgcmVsZWFzZS10cmFpbiBmb3IgYGxhdGVzdGAuIE9uY2Ugd2UgZGlzY292ZXJlZCB0aGUgbGF0ZXN0IHJlbGVhc2UgdHJhaW4sXG4gICAgLy8gd2Ugc2tpcCBsb29raW5nIGZ1cnRoZXIgYXMgdGhlcmUgYXJlIG5vIHBvc3NpYmxlIG9sZGVyIGFjdGl2ZSByZWxlYXNlIHRyYWlucy5cbiAgICBsYXRlc3QgPSByZWxlYXNlVHJhaW47XG4gICAgYnJlYWs7XG4gIH1cblxuICByZXR1cm4ge3JlbGVhc2VDYW5kaWRhdGU6IHJlbGVhc2VDYW5kaWRhdGUsIGV4Y2VwdGlvbmFsTWlub3IsIGxhdGVzdH07XG59XG4iXX0=