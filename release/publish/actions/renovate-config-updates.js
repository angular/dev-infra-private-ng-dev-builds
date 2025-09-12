import { existsSync } from 'node:fs';
import { green, Log } from '../../../utils/logging.js';
import { join } from 'node:path';
import { writeFile, readFile } from 'node:fs/promises';
export async function updateRenovateConfig(projectDir, newBranchName) {
    const renovateConfigPath = join(projectDir, 'renovate.json');
    if (!existsSync(renovateConfigPath)) {
        Log.warn(`  ✘   Skipped updating Renovate config as it was not found.`);
        return null;
    }
    const config = await readFile(renovateConfigPath, 'utf-8');
    const configJson = JSON.parse(config);
    const baseBranchPatterns = configJson['baseBranchPatterns'];
    if (!Array.isArray(baseBranchPatterns) || baseBranchPatterns.length !== 2) {
        Log.warn(`  ✘   Skipped updating Renovate config: "baseBranchPatterns" must contain exactly 2 branches.`);
        return null;
    }
    configJson['baseBranchPatterns'] = ['main', newBranchName];
    await writeFile(renovateConfigPath, JSON.stringify(configJson, undefined, 2));
    Log.info(green(`  ✓   Updated Renovate config.`));
    return renovateConfigPath;
}
//# sourceMappingURL=renovate-config-updates.js.map