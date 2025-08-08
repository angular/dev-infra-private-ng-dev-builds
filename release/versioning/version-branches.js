import semver from 'semver';
const versionBranchNameRegex = /^(\d+)\.(\d+)\.x$/;
export const exceptionalMinorPackageIndicator = '__ngDevExceptionalMinor__';
export function getNextBranchName(github) {
    return github.mainBranchName;
}
export async function getVersionInfoForBranch(repo, branchName) {
    const { data } = await repo.api.repos.getContent({
        owner: repo.owner,
        repo: repo.name,
        path: '/package.json',
        ref: branchName,
    });
    const content = data.content;
    if (!content) {
        throw Error(`Unable to read "package.json" file from repository.`);
    }
    const pkgJson = JSON.parse(Buffer.from(content, 'base64').toString());
    const parsedVersion = semver.parse(pkgJson.version);
    if (parsedVersion === null) {
        throw Error(`Invalid version detected in following branch: ${branchName}.`);
    }
    return {
        version: parsedVersion,
        isExceptionalMinor: pkgJson[exceptionalMinorPackageIndicator] === true,
    };
}
export function isVersionBranch(branchName) {
    return versionBranchNameRegex.test(branchName);
}
export async function getBranchesForMajorVersions(repo, majorVersions) {
    const branchData = await repo.api.paginate(repo.api.repos.listBranches, {
        owner: repo.owner,
        repo: repo.name,
        protected: true,
    });
    const branches = [];
    for (const { name } of branchData) {
        if (!isVersionBranch(name)) {
            continue;
        }
        const parsed = convertVersionBranchToSemVer(name);
        if (parsed !== null && majorVersions.includes(parsed.major)) {
            branches.push({ name, parsed });
        }
    }
    return branches.sort((a, b) => semver.rcompare(a.parsed, b.parsed));
}
export function convertVersionBranchToSemVer(branchName) {
    return semver.parse(branchName.replace(versionBranchNameRegex, '$1.$2.0'));
}
//# sourceMappingURL=version-branches.js.map