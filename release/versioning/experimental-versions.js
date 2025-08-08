import semver from 'semver';
export function isExperimentalSemver(version) {
    return version.major === 0 && version.minor >= 100;
}
export function createExperimentalSemver(version) {
    version = new semver.SemVer(version);
    const experimentalVersion = new semver.SemVer(version.format());
    experimentalVersion.major = 0;
    experimentalVersion.minor = version.major * 100 + version.minor;
    return new semver.SemVer(experimentalVersion.format());
}
//# sourceMappingURL=experimental-versions.js.map