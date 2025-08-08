import { MigrateModule } from './migrate.js';
import { FixModule } from './fix.js';
export function buildAiParser(localYargs) {
    return localYargs.command(MigrateModule).command(FixModule);
}
//# sourceMappingURL=cli.js.map