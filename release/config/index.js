import { ConfigValidationError } from '../../utils/config.js';
export function assertValidReleaseConfig(config) {
    const errors = [];
    if (config.release === undefined) {
        throw new ConfigValidationError('No configuration provided for `release`');
    }
    if (config.release.representativeNpmPackage === undefined) {
        errors.push(`No "representativeNpmPackage" configured for releasing.`);
    }
    if (config.release.npmPackages === undefined) {
        errors.push(`No "npmPackages" configured for releasing.`);
    }
    if (config.release.buildPackages === undefined) {
        errors.push(`No "buildPackages" function configured for releasing.`);
    }
    if (config.release.representativeNpmPackage && config.release.npmPackages) {
        const representativePkgEntry = config.release.npmPackages.find((pkg) => pkg.name === config.release?.representativeNpmPackage);
        if (representativePkgEntry === undefined) {
            errors.push(`Configured "representativeNpmPackage" (${representativePkgEntry}) does not match ` +
                `a package in "npmPackages".`);
        }
        else if (representativePkgEntry.experimental) {
            errors.push(`Configured "representativeNpmPackage" (${representativePkgEntry}) corresponds to an ` +
                `experimental package. The representative NPM package is expected to be a ` +
                `long-standing and non-experimental package of the project.`);
        }
    }
    if (errors.length) {
        throw new ConfigValidationError('Invalid `release` configuration', errors);
    }
}
//# sourceMappingURL=index.js.map