import semver from 'semver';
import { getConfig } from '../../../utils/config.js';
import { Log, bold, green } from '../../../utils/logging.js';
import { Spinner } from '../../../utils/spinner.js';
import { assertValidReleaseConfig } from '../../config/index.js';
import { NpmCommand } from '../../versioning/npm-command.js';
import { createExperimentalSemver, isExperimentalSemver, } from '../../versioning/experimental-versions.js';
function builder(args) {
    return args
        .positional('tagName', {
        type: 'string',
        demandOption: true,
        description: 'Name of the NPM dist tag.',
    })
        .positional('targetVersion', {
        type: 'string',
        demandOption: true,
        description: 'Version to which the NPM dist tag should be set.\nThis version will be ' +
            'converted to an experimental version for experimental packages.',
    })
        .option('skipExperimentalPackages', {
        type: 'boolean',
        description: 'Whether the dist tag should not be set for experimental NPM packages.',
        default: false,
    });
}
async function handler(args) {
    const { targetVersion: rawVersion, tagName, skipExperimentalPackages } = args;
    const config = await getConfig();
    assertValidReleaseConfig(config);
    const { npmPackages, publishRegistry } = config.release;
    const version = semver.parse(rawVersion);
    if (version === null) {
        Log.error(`Invalid version specified (${rawVersion}). Unable to set NPM dist tag.`);
        process.exit(1);
    }
    else if (isExperimentalSemver(version)) {
        Log.error(`Unexpected experimental SemVer version specified. This command expects a ` +
            `non-experimental project SemVer version.`);
        process.exit(1);
    }
    Log.debug(`Setting "${tagName}" NPM dist tag for release packages to v${version}.`);
    const spinner = new Spinner('');
    for (const pkg of npmPackages) {
        if (pkg.experimental && skipExperimentalPackages) {
            spinner.update(`Skipping "${pkg.name}" due to it being experimental.`);
            continue;
        }
        spinner.update(`Setting NPM dist tag for "${pkg.name}"`);
        const distTagVersion = pkg.experimental ? createExperimentalSemver(version) : version;
        try {
            await NpmCommand.setDistTagForPackage(pkg.name, tagName, distTagVersion, publishRegistry);
            Log.debug(`Successfully set "${tagName}" NPM dist tag for "${pkg.name}".`);
        }
        catch (e) {
            spinner.complete();
            Log.error(e);
            Log.error(`  ✘   An error occurred while setting the NPM dist tag for "${pkg.name}".`);
            process.exit(1);
        }
    }
    spinner.complete();
    Log.info(green(`  ✓   Set NPM dist tag for all release packages.`));
    Log.info(green(`      ${bold(tagName)} will now point to ${bold(`v${version}`)}.`));
}
export const ReleaseNpmDistTagSetCommand = {
    builder,
    handler,
    command: 'set <tag-name> <target-version>',
    describe: 'Sets a given NPM dist tag for all release packages.',
};
//# sourceMappingURL=cli.js.map