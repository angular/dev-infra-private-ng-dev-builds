import { getConfig } from '../../utils/config.js';
import { green, Log } from '../../utils/logging.js';
import { assertValidReleaseConfig } from '../config/index.js';
import { BuildWorker } from './index.js';
function builder(argv) {
    return argv.option('json', {
        type: 'boolean',
        description: 'Whether the built packages should be printed to stdout as JSON.',
        default: false,
    });
}
async function handler(args) {
    const config = await getConfig();
    assertValidReleaseConfig(config);
    const { npmPackages } = config.release;
    let builtPackages = await BuildWorker.invokeBuild();
    if (builtPackages === null) {
        Log.error(`  ✘   Could not build release output. Please check output above.`);
        process.exit(1);
    }
    if (builtPackages.length === 0) {
        Log.error(`  ✘   No release packages have been built. Please ensure that the`);
        Log.error(`      build script is configured correctly in ".ng-dev".`);
        process.exit(1);
    }
    const missingPackages = npmPackages.filter((pkg) => !builtPackages.find((b) => b.name === pkg.name));
    if (missingPackages.length > 0) {
        Log.error(`  ✘   Release output missing for the following packages:`);
        missingPackages.forEach((pkg) => Log.error(`      - ${pkg.name}`));
        process.exit(1);
    }
    if (args.json) {
        process.stdout.write(JSON.stringify(builtPackages, null, 2));
    }
    else {
        Log.info(green('  ✓   Built release packages.'));
        builtPackages.forEach(({ name }) => Log.info(green(`      - ${name}`)));
    }
}
export const ReleaseBuildCommandModule = {
    builder,
    handler,
    command: 'build',
    describe: 'Builds the release output for the current branch.',
};
//# sourceMappingURL=cli.js.map