import { RestoreCommitMessageModule } from './restore-commit-message/cli.js';
import { ValidateFileModule } from './validate-file/cli.js';
import { ValidateRangeModule } from './validate-range/cli.js';
export function buildCommitMessageParser(localYargs) {
    return localYargs
        .help()
        .strict()
        .command(RestoreCommitMessageModule)
        .command(ValidateFileModule)
        .command(ValidateRangeModule);
}
//# sourceMappingURL=cli.js.map