import { printTargetBranchesForPr } from './check-target-branches.js';
function builder(argv) {
    return argv.positional('pr', {
        description: 'The pull request number',
        type: 'number',
        demandOption: true,
    });
}
async function handler({ pr }) {
    await printTargetBranchesForPr(pr);
}
export const CheckTargetBranchesModule = {
    handler,
    builder,
    command: 'check-target-branches <pr>',
    describe: 'Check a PR to determine what branches it is currently targeting',
};
//# sourceMappingURL=cli.js.map