import { getConfig } from '../../../utils/config.js';
import { bold, green, Log } from '../../../utils/logging.js';
import { Spinner } from '../../../utils/spinner.js';
import { assertValidReleaseConfig } from '../../config/index.js';
import { NpmCommand } from '../../versioning/npm-command.js';
function builder(args) {
    return args.positional('tagName', {
        type: 'string',
        demandOption: true,
        description: 'Name of the NPM dist tag.',
    });
}
async function handler(args) {
    const { tagName } = args;
    const config = await getConfig();
    assertValidReleaseConfig(config);
    const { npmPackages, publishRegistry } = config.release;
    Log.debug(`Deleting "${tagName}" NPM dist tag for release packages.`);
    const spinner = new Spinner('');
    for (const pkg of npmPackages) {
        spinner.update(`Deleting NPM dist tag for "${pkg.name}"`);
        try {
            await NpmCommand.deleteDistTagForPackage(pkg.name, tagName, publishRegistry);
            Log.debug(`Successfully deleted "${tagName}" NPM dist tag for "${pkg.name}".`);
        }
        catch (e) {
            spinner.complete();
            Log.error(e);
            Log.error(`  ✘   An error occurred while deleting the NPM dist tag for "${pkg.name}".`);
            process.exit(1);
        }
    }
    spinner.complete();
    Log.info(green(`  ✓   Deleted "${bold(tagName)}" NPM dist tag for all packages.`));
}
export const ReleaseNpmDistTagDeleteCommand = {
    builder,
    handler,
    command: 'delete <tag-name>',
    describe: 'Deletes a given NPM dist tag for all release packages.',
};
//# sourceMappingURL=cli.js.map