import { GitClient } from '../../utils/git/git-client.js';
import { assertValidReleaseConfig } from '../config/index.js';
import { ActiveReleaseTrains } from '../versioning/active-release-trains.js';
import { printActiveReleaseTrains } from '../versioning/print-active-trains.js';
import { getNextBranchName } from '../versioning/index.js';
import { getConfig } from '../../utils/config.js';
function builder(argv) {
    return argv.option('json', {
        type: 'boolean',
        description: 'Whether information should be written as JSON to stdout.',
        default: false,
    });
}
async function handler(argv) {
    const config = await getConfig();
    assertValidReleaseConfig(config);
    if (argv.json) {
        process.stdout.write(JSON.stringify(config.release, null, 2));
        return;
    }
    const git = await GitClient.get();
    const nextBranchName = getNextBranchName(git.config.github);
    const repo = { api: git.github, ...git.remoteConfig, nextBranchName };
    const releaseTrains = await ActiveReleaseTrains.fetch(repo);
    await printActiveReleaseTrains(releaseTrains, config.release);
}
export const ReleaseInfoCommandModule = {
    builder,
    handler,
    command: 'info',
    describe: 'Prints information for the current release state.',
};
//# sourceMappingURL=cli.js.map