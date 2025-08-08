import { info } from 'console';
import { assertValidCaretakerConfig, assertValidGithubConfig, getConfig } from '../utils/config.js';
import { CheckModule } from './check/cli.js';
import { HandoffModule } from './handoff/cli.js';
export function buildCaretakerParser(argv) {
    return argv.middleware(caretakerCommandCanRun, false).command(CheckModule).command(HandoffModule);
}
function caretakerCommandCanRun() {
    try {
        getConfig([assertValidCaretakerConfig, assertValidGithubConfig]);
    }
    catch {
        info('The `caretaker` command is not enabled in this repository.');
        info(`   To enable it, provide a caretaker config in the repository's .ng-dev/ directory`);
        process.exit(1);
    }
}
//# sourceMappingURL=cli.js.map