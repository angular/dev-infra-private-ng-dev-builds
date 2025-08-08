import { CheckTargetBranchesModule } from './check-target-branches/cli.js';
import { CheckoutCommandModule } from './checkout/cli.js';
import { DiscoverNewConflictsCommandModule } from './discover-new-conflicts/cli.js';
import { MergeCommandModule } from './merge/cli.js';
import { RebaseCommandModule } from './rebase/cli.js';
export function buildPrParser(localYargs) {
    return localYargs
        .help()
        .strict()
        .demandCommand()
        .command(DiscoverNewConflictsCommandModule)
        .command(RebaseCommandModule)
        .command(MergeCommandModule)
        .command(CheckoutCommandModule)
        .command(CheckTargetBranchesModule);
}
//# sourceMappingURL=cli.js.map