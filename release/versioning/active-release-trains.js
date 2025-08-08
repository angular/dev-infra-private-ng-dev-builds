import semver from 'semver';
import { ReleaseTrain } from './release-trains.js';
import { getBranchesForMajorVersions, getVersionInfoForBranch, } from './version-branches.js';
export class ActiveReleaseTrains {
    constructor(trains) {
        this.trains = trains;
        this.releaseCandidate = this.trains.releaseCandidate;
        this.next = this.trains.next;
        this.latest = this.trains.latest;
        this.exceptionalMinor = this.trains.exceptionalMinor;
    }
    isFeatureFreeze() {
        return this.releaseCandidate !== null && this.releaseCandidate.version.prerelease[0] === 'next';
    }
    static async fetch(repo) {
        return fetchActiveReleaseTrains(repo);
    }
}
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
        majorVersionsToFetch.push(nextVersion.major - 1, nextVersion.major - 2);
        checks.isValidReleaseCandidateVersion = (v) => v.major === nextVersion.major - 1;
        checks.canHaveExceptionalMinor = (rc) => rc === null || rc.isMajor;
        checks.isValidExceptionalMinorVersion = (v, rc) => v.major === (rc === null ? nextVersion.major : rc.version.major) - 1;
    }
    else if (nextVersion.minor === 1) {
        majorVersionsToFetch.push(nextVersion.major, nextVersion.major - 1);
        checks.isValidReleaseCandidateVersion = (v) => v.major === nextVersion.major;
        checks.canHaveExceptionalMinor = (rc) => rc !== null && rc.isMajor;
        checks.isValidExceptionalMinorVersion = (v, rc) => v.major === rc.version.major - 1;
    }
    else {
        majorVersionsToFetch.push(nextVersion.major);
        checks.isValidReleaseCandidateVersion = (v) => v.major === nextVersion.major;
        checks.canHaveExceptionalMinor = () => false;
    }
    const branches = await getBranchesForMajorVersions(repo, majorVersionsToFetch);
    const { latest, releaseCandidate, exceptionalMinor } = await findActiveReleaseTrainsFromVersionBranches(repo, next, branches, checks);
    if (latest === null) {
        throw Error(`Unable to determine the latest release-train. The following branches ` +
            `have been considered: [${branches.map((b) => b.name).join(', ')}]`);
    }
    return new ActiveReleaseTrains({ releaseCandidate, next, latest, exceptionalMinor });
}
async function findActiveReleaseTrainsFromVersionBranches(repo, next, branches, checks) {
    const nextReleaseTrainVersion = semver.parse(`${next.version.major}.${next.version.minor}.0`);
    const nextBranchName = repo.nextBranchName;
    let latest = null;
    let releaseCandidate = null;
    let exceptionalMinor = null;
    for (const { name, parsed } of branches) {
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
        latest = releaseTrain;
        break;
    }
    return { releaseCandidate: releaseCandidate, exceptionalMinor, latest };
}
//# sourceMappingURL=active-release-trains.js.map