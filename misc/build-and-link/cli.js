import { lstatSync } from 'fs';
import { resolve } from 'path';
import { BuildWorker } from '../../release/build/index.js';
import { ChildProcess } from '../../utils/child-process.js';
import { Log, green } from '../../utils/logging.js';
import { getConfig } from '../../utils/config.js';
import { assertValidReleaseConfig } from '../../release/config/index.js';
function builder(argv) {
    return argv.positional('projectRoot', {
        type: 'string',
        normalize: true,
        coerce: (path) => resolve(path),
        demandOption: true,
    });
}
async function handler({ projectRoot }) {
    try {
        if (!lstatSync(projectRoot).isDirectory()) {
            Log.error(`  ✘   The 'projectRoot' must be a directory: ${projectRoot}`);
            process.exit(1);
        }
    }
    catch {
        Log.error(`  ✘   Could not find the 'projectRoot' provided: ${projectRoot}`);
        process.exit(1);
    }
    const config = await getConfig();
    assertValidReleaseConfig(config);
    const builtPackages = await BuildWorker.invokeBuild();
    if (builtPackages === null) {
        Log.error(`  ✘   Could not build release output. Please check output above.`);
        process.exit(1);
    }
    Log.info(green(` ✓  Built release output.`));
    for (const { outputPath, name } of builtPackages) {
        await ChildProcess.spawn('pnpm', ['--dir', outputPath, 'link', '--global']);
        await ChildProcess.spawn('pnpm', ['--dir', projectRoot, 'link', '--global', name]);
    }
    Log.info(green(` ✓  Linked release packages in provided project.`));
}
export const BuildAndLinkCommandModule = {
    builder,
    handler,
    command: 'build-and-link <projectRoot>',
    describe: 'Builds the release output, registers the outputs as linked, and links via pnpm to the provided project',
};
//# sourceMappingURL=cli.js.map