import { CheckModule } from './check/cli.js';
import { HandoffModule } from './handoff/cli.js';
import { MergeModeModule } from './merge-mode/cli.js';
export function buildCaretakerParser(argv) {
    return argv.command(MergeModeModule).command(CheckModule).command(HandoffModule);
}
//# sourceMappingURL=cli.js.map