export const _npmPackageInfoCache = {};
export async function fetchProjectNpmPackageInfo(config) {
    return await fetchPackageInfoFromNpmRegistry(config.representativeNpmPackage);
}
export async function isVersionPublishedToNpm(version, config) {
    const { versions } = await fetchProjectNpmPackageInfo(config);
    return versions[version.format()] !== undefined;
}
async function fetchPackageInfoFromNpmRegistry(pkgName) {
    if (_npmPackageInfoCache[pkgName] === undefined) {
        _npmPackageInfoCache[pkgName] = fetch(`https://registry.npmjs.org/${pkgName}`).then((r) => r.json());
    }
    return await _npmPackageInfoCache[pkgName];
}
//# sourceMappingURL=npm-registry.js.map