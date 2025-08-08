import path from 'path';
import url from 'url';
import { printEnvStamp } from './env-stamp.js';
function builder(args) {
    return args
        .option('mode', {
        demandOption: true,
        description: 'Whether the env-stamp should be built for a snapshot or release',
        choices: ['snapshot', 'release'],
    })
        .option('includeVersion', {
        type: 'boolean',
        description: 'Whether the version should be included in the stamp.',
        default: true,
    })
        .option('additionalStampingScript', {
        type: 'string',
        description: 'Working-dir relative or absolute path to an ESM script which can ' +
            'print additional stamping variables',
    });
}
async function handler({ mode, includeVersion, additionalStampingScript }) {
    await printEnvStamp(mode, includeVersion);
    if (additionalStampingScript !== undefined) {
        const scriptURL = url.pathToFileURL(path.resolve(additionalStampingScript));
        const stampingExports = (await import(scriptURL.toString()));
        await stampingExports.default(mode);
    }
}
export const BuildEnvStampCommand = {
    builder,
    handler,
    command: 'build-env-stamp',
    describe: 'Build the environment stamping information',
};
//# sourceMappingURL=cli.js.map