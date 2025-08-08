import { addGithubTokenOption } from '../../utils/git/github-yargs.js';
import { checkServiceStatuses } from './check.js';
function builder(argv) {
    return addGithubTokenOption(argv);
}
async function handler() {
    await checkServiceStatuses();
}
export const CheckModule = {
    handler,
    builder,
    command: 'check',
    describe: 'Check the status of information the caretaker manages for the repository',
};
//# sourceMappingURL=cli.js.map