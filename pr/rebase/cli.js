import { addGithubTokenOption } from '../../utils/git/github-yargs.js';
import { rebasePr } from './index.js';
function builder(argv) {
    return addGithubTokenOption(argv)
        .positional('pr', { type: 'number', demandOption: true })
        .option('interactive', {
        type: 'boolean',
        alias: ['i'],
        demandOption: false,
        describe: 'Do the rebase interactively so that things can be squashed and amended',
    });
}
async function handler({ pr, i }) {
    process.exitCode = await rebasePr(pr, i);
}
export const RebaseCommandModule = {
    handler,
    builder,
    command: 'rebase <pr>',
    describe: 'Rebase a pending PR and push the rebased commits back to Github',
};
//# sourceMappingURL=cli.js.map