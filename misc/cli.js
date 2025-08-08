import { BuildAndLinkCommandModule } from './build-and-link/cli.js';
import { UpdateYarnCommandModule } from './update-yarn/cli.js';
import { GeneratedFilesModule } from './generated-files/cli.js';
import { GeneratedNodeJsToolchainModule } from './generate-nodejs-toolchain/cli.js';
export function buildMiscParser(localYargs) {
    return localYargs
        .help()
        .strict()
        .command(BuildAndLinkCommandModule)
        .command(UpdateYarnCommandModule)
        .command(GeneratedFilesModule)
        .command(GeneratedNodeJsToolchainModule);
}
//# sourceMappingURL=cli.js.map