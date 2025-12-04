import { join } from 'node:path';
import { existsSync } from 'node:fs';
export class PnpmVersioning {
    static isUsingPnpm(repoPath) {
        return existsSync(join(repoPath, 'pnpm-lock.yaml')) && !existsSync(join(repoPath, 'yarn.lock'));
    }
}
//# sourceMappingURL=pnpm-versioning.js.map