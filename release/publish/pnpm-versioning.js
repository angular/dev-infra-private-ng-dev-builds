import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
export class PnpmVersioning {
    async isUsingPnpm(repoPath) {
        return existsSync(join(repoPath, 'pnpm-lock.yaml')) && !existsSync(join(repoPath, 'yarn.lock'));
    }
    async getPackageSpec(repoPath) {
        const packageJsonRaw = await readFile(join(repoPath, 'package.json'), 'utf8');
        const packageJson = JSON.parse(packageJsonRaw);
        const pnpmAllowedRange = packageJson?.engines?.['pnpm'] ?? 'latest';
        return `pnpm@${pnpmAllowedRange}`;
    }
}
//# sourceMappingURL=pnpm-versioning.js.map