import { ReleaseBuildCommandModule } from './build/cli.js';
import { ReleaseInfoCommandModule } from './info/cli.js';
import { ReleaseNotesCommandModule } from './notes/cli.js';
import { ReleasePrecheckCommandModule } from './precheck/cli.js';
import { ReleasePublishCommandModule } from './publish/cli.js';
import { ReleaseSetDistTagCommand } from './set-dist-tag/cli.js';
import { BuildEnvStampCommand } from './stamping/cli.js';
import { ReleaseNpmDistTagCommand } from './npm-dist-tag/cli.js';
export function buildReleaseParser(localYargs) {
    return localYargs
        .help()
        .strict()
        .demandCommand()
        .command(ReleasePublishCommandModule)
        .command(ReleaseBuildCommandModule)
        .command(ReleaseInfoCommandModule)
        .command(ReleaseNpmDistTagCommand)
        .command(ReleasePrecheckCommandModule)
        .command(ReleaseSetDistTagCommand)
        .command(BuildEnvStampCommand)
        .command(ReleaseNotesCommandModule);
}
//# sourceMappingURL=cli.js.map