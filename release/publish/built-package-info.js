import { Log } from '../../utils/logging.js';
import { FatalReleaseActionError } from './actions-error.js';
import { DirectoryHash } from './directory-hash.js';
export async function analyzeAndExtendBuiltPackagesWithInfo(builtPackages, npmPackages) {
    const result = [];
    for (const pkg of builtPackages) {
        const info = npmPackages.find((i) => i.name === pkg.name);
        if (info === undefined) {
            Log.debug(`Retrieved package information:`, npmPackages);
            Log.error(`  ✘   Could not find package information for built package: "${pkg.name}".`);
            throw new FatalReleaseActionError();
        }
        result.push({
            hash: await computeHashForPackageContents(pkg),
            ...pkg,
            ...info,
        });
    }
    return result;
}
export async function assertIntegrityOfBuiltPackages(builtPackagesWithInfo) {
    const modifiedPackages = [];
    for (const pkg of builtPackagesWithInfo) {
        if ((await computeHashForPackageContents(pkg)) !== pkg.hash) {
            modifiedPackages.push(pkg.name);
        }
    }
    if (modifiedPackages.length > 0) {
        Log.error(`  ✘   Release output has been modified locally since it was built.`);
        Log.error(`      The following packages changed: ${modifiedPackages.join(', ')}`);
        throw new FatalReleaseActionError();
    }
}
async function computeHashForPackageContents(pkg) {
    return DirectoryHash.compute(pkg.outputPath);
}
//# sourceMappingURL=built-package-info.js.map