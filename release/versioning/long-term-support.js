import semver from 'semver';
import { fetchProjectNpmPackageInfo } from './npm-registry.js';
const majorActiveSupportDuration = 6;
const majorLongTermSupportDuration = 12;
const ltsNpmDistTagRegex = /^v(\d+)-lts$/;
export async function fetchLongTermSupportBranchesFromNpm(config) {
    const { 'dist-tags': distTags, time } = await fetchProjectNpmPackageInfo(config);
    const today = new Date();
    const active = [];
    const inactive = [];
    for (const npmDistTag in distTags) {
        if (isLtsDistTag(npmDistTag)) {
            const version = semver.parse(distTags[npmDistTag]);
            const branchName = `${version.major}.${version.minor}.x`;
            const majorReleaseDate = new Date(time[`${version.major}.0.0`]);
            const ltsEndDate = computeLtsEndDateOfMajor(majorReleaseDate);
            const ltsBranch = { name: branchName, version, npmDistTag };
            if (today <= ltsEndDate) {
                active.push(ltsBranch);
            }
            else {
                inactive.push(ltsBranch);
            }
        }
    }
    active.sort((a, b) => semver.rcompare(a.version, b.version));
    inactive.sort((a, b) => semver.rcompare(a.version, b.version));
    return { active, inactive };
}
export function isLtsDistTag(tagName) {
    return ltsNpmDistTagRegex.test(tagName);
}
export function computeLtsEndDateOfMajor(majorReleaseDate) {
    return new Date(majorReleaseDate.getFullYear(), majorReleaseDate.getMonth() + majorActiveSupportDuration + majorLongTermSupportDuration, majorReleaseDate.getDate(), majorReleaseDate.getHours(), majorReleaseDate.getMinutes(), majorReleaseDate.getSeconds(), majorReleaseDate.getMilliseconds());
}
export function getLtsNpmDistTagOfMajor(major) {
    return `v${major}-lts`;
}
//# sourceMappingURL=long-term-support.js.map