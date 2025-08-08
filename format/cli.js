import { AllFilesModule } from './all.js';
import { ChangedModule } from './changed.js';
import { FilesModule } from './files.js';
import { StagedModule } from './staged.js';
export function buildFormatParser(localYargs) {
    return localYargs
        .command(AllFilesModule)
        .command(StagedModule)
        .command(ChangedModule)
        .command(FilesModule);
}
//# sourceMappingURL=cli.js.map