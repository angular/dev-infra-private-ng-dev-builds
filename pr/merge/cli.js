import { addDryRunFlag } from '../../utils/dry-run.js';
import { mergePullRequest, parsePrNumber } from './merge-pull-request.js';
import { addGithubTokenOption } from '../../utils/git/github-yargs.js';
async function builder(argv) {
    return addDryRunFlag(addGithubTokenOption(argv))
        .help()
        .strict()
        .positional('pr', {
        demandOption: true,
        coerce: (prUrlOrNumber) => parsePrNumber(prUrlOrNumber),
        type: 'string',
        description: 'The PR to be merged.',
    })
        .option('branch-prompt', {
        type: 'boolean',
        default: true,
        description: 'Whether to prompt to confirm the branches a PR will merge into.',
    })
        .option('force-manual-branches', {
        type: 'boolean',
        default: false,
        description: 'Whether to manually select the branches you wish to merge the PR into.',
    })
        .option('ignore-pending-reviews', {
        type: 'boolean',
        default: false,
        description: 'Bypass the check for pending reviews on the pull request',
    });
}
async function handler({ pr, branchPrompt, forceManualBranches, dryRun, ignorePendingReviews, }) {
    await mergePullRequest(pr, { branchPrompt, forceManualBranches, dryRun, ignorePendingReviews });
}
export const MergeCommandModule = {
    handler,
    builder,
    command: 'merge <pr>',
    describe: 'Merge a PR into its targeted branches.',
};
//# sourceMappingURL=cli.js.map