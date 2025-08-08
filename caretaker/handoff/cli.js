import { addGithubTokenOption } from '../../utils/git/github-yargs.js';
import { updateCaretakerTeamViaPrompt } from './update-github-team.js';
function builder(argv) {
    return addGithubTokenOption(argv);
}
async function handler() {
    await updateCaretakerTeamViaPrompt();
}
export const HandoffModule = {
    handler,
    builder,
    command: 'handoff',
    describe: 'Run a handoff assistant to aide in moving to the next caretaker',
};
//# sourceMappingURL=cli.js.map