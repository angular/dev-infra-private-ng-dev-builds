import { assertValidGithubConfig, getConfig } from '../../utils/config.js';
import { addGithubTokenOption } from '../../utils/git/github-yargs.js';
import { assertValidReleaseConfig } from '../config/index.js';
import { CompletionState, ReleaseTool } from './index.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { green, Log, yellow } from '../../utils/logging.js';
function builder(argv) {
    return addGithubTokenOption(argv);
}
async function handler() {
    const git = await AuthenticatedGitClient.get();
    const config = await getConfig();
    assertValidReleaseConfig(config);
    assertValidGithubConfig(config);
    const task = new ReleaseTool(git, config.release, config.github, git.baseDir);
    const result = await task.run();
    switch (result) {
        case CompletionState.FATAL_ERROR:
            Log.error(`Release action has been aborted due to fatal errors. See above.`);
            process.exitCode = 2;
            break;
        case CompletionState.MANUALLY_ABORTED:
            Log.info(yellow(`Release action has been manually aborted.`));
            process.exitCode = 1;
            break;
        case CompletionState.SUCCESS:
            Log.info(green(`Release action has completed successfully.`));
            break;
    }
}
export const ReleasePublishCommandModule = {
    builder,
    handler,
    command: 'publish',
    describe: 'Publish new releases and configure version branches.',
};
//# sourceMappingURL=cli.js.map