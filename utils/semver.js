import semver from 'semver';
export function semverInc(version, release, identifier) {
    const clone = new semver.SemVer(version.version);
    return clone.inc(release, identifier);
}
//# sourceMappingURL=semver.js.map