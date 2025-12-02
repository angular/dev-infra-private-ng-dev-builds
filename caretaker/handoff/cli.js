import { addGithubTokenOption } from '../../utils/git/github-yargs.js';
import { updateCaretakerTeamViaPrompt } from './update-github-team.js';
import { assertValidGithubConfig, getConfig } from '../../utils/config.js';
import { verifyMergeMode } from './verify-merge-mode.js';
function builder(argv) {
    return addGithubTokenOption(argv);
}
async function handler() {
    const { mergeMode } = (await getConfig([assertValidGithubConfig])).github;
    if (!(await verifyMergeMode(mergeMode))) {
        return;
    }
    await updateCaretakerTeamViaPrompt();
}
export const HandoffModule = {
    handler,
    builder,
    command: 'handoff',
    describe: 'Run a handoff assistant to aide in moving to the next caretaker',
};
//# sourceMappingURL=cli.js.map