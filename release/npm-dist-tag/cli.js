import { ReleaseNpmDistTagDeleteCommand } from './delete/cli.js';
import { ReleaseNpmDistTagSetCommand } from './set/cli.js';
function subCommandsBuilder(argv) {
    return argv
        .help()
        .strict()
        .demandCommand()
        .command(ReleaseNpmDistTagDeleteCommand)
        .command(ReleaseNpmDistTagSetCommand);
}
export const ReleaseNpmDistTagCommand = {
    describe: 'Update the NPM dist tags for release packages.',
    command: 'npm-dist-tag',
    builder: subCommandsBuilder,
    handler: () => { },
};
//# sourceMappingURL=cli.js.map