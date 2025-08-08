import { addGithubTokenOption } from '../../utils/git/github-yargs.js';
import { checkoutPullRequest } from './checkout.js';
function builder(yargs) {
    return addGithubTokenOption(yargs)
        .positional('pr', {
        type: 'number',
        demandOption: true,
        describe: 'The pull request number for the pull request to checkout',
    })
        .option('takeover', {
        type: 'boolean',
        demandOption: false,
        describe: 'Check out the pull request to perform a takeover',
    })
        .option('target', {
        type: 'string',
        demandOption: false,
        describe: 'Check out the pull request targeting the specified base branch',
    });
}
async function handler({ pr, takeover, target }) {
    await checkoutPullRequest({ pr, takeover, target });
}
export const CheckoutCommandModule = {
    handler,
    builder,
    command: 'checkout <pr>',
    describe: 'Checkout a PR from the upstream repo',
};
//# sourceMappingURL=cli.js.map