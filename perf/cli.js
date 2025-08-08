import { WorkflowsModule } from './workflow/cli.js';
export function buildPerfParser(localYargs) {
    return localYargs.help().strict().demandCommand().command(WorkflowsModule);
}
//# sourceMappingURL=cli.js.map