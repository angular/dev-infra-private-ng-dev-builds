import semver from 'semver';
import { computeLtsEndDateOfMajor, fetchProjectNpmPackageInfo, getLtsNpmDistTagOfMajor, getVersionInfoForBranch, } from '../../../release/versioning/index.js';
import { Log, red, yellow } from '../../../utils/logging.js';
import { InvalidTargetBranchError } from './target-label.js';
import { defaultLocale } from '../../../utils/locale.js';
import { Prompt } from '../../../utils/prompt.js';
export async function assertActiveLtsBranch(repo, releaseConfig, branchName) {
    const { version } = await getVersionInfoForBranch(repo, branchName);
    const { 'dist-tags': distTags, time } = await fetchProjectNpmPackageInfo(releaseConfig);
    const ltsNpmTag = getLtsNpmDistTagOfMajor(version.major);
    const ltsVersion = semver.parse(distTags[ltsNpmTag]);
    if (ltsVersion === null) {
        throw new InvalidTargetBranchError(`No LTS version tagged for v${version.major} in NPM.`);
    }
    if (branchName !== `${ltsVersion.major}.${ltsVersion.minor}.x`) {
        throw new InvalidTargetBranchError(`Not using last-minor branch for v${version.major} LTS version. PR ` +
            `should be updated to target: ${ltsVersion.major}.${ltsVersion.minor}.x`);
    }
    const today = new Date();
    const majorReleaseDate = new Date(time[`${version.major}.0.0`]);
    const ltsEndDate = computeLtsEndDateOfMajor(majorReleaseDate);
    if (today > ltsEndDate) {
        const ltsEndDateText = ltsEndDate.toLocaleDateString(defaultLocale);
        Log.warn(red(`Long-term support ended for v${version.major} on ${ltsEndDateText}.`));
        Log.warn(yellow(`Merging of pull requests for this major is generally not ` +
            `desired, but can be forcibly ignored.`));
        if (await Prompt.confirm({ message: 'Do you want to forcibly proceed with merging?' })) {
            return;
        }
        throw new InvalidTargetBranchError(`Long-term supported ended for v${version.major} on ${ltsEndDateText}. ` +
            `Pull request cannot be merged into the ${branchName} branch.`);
    }
}
//# sourceMappingURL=lts-branch.js.map