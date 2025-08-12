import { existsSync } from 'node:fs';
import { green, Log } from '../../../utils/logging.js';
import { join } from 'node:path';
import { writeFile, readFile } from 'node:fs/promises';
import { targetLabels } from '../../../pr/common/labels/target.js';
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
    updateRenovateTargetLabel(configJson, targetLabels['TARGET_PATCH'].name, targetLabels['TARGET_RC'].name);
    await writeFile(renovateConfigPath, JSON.stringify(configJson, undefined, 2));
    Log.info(green(`  ✓   Updated Renovate config.`));
    return renovateConfigPath;
}
export async function updateRenovateConfigTargetLabels(projectDir, fromLabel, toLabel) {
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
    if (updateRenovateTargetLabel(configJson, fromLabel, toLabel)) {
        await writeFile(renovateConfigPath, JSON.stringify(configJson, undefined, 2));
        Log.info(green(`  ✓   Updated target label in Renovate config.`));
        return renovateConfigPath;
    }
    else {
        Log.info(green(`  ✓   No changes to target labels in Renovate config.`));
        return null;
    }
}
function updateRenovateTargetLabel(configJson, fromLabel, toLabel) {
    if (!Array.isArray(configJson['packageRules'])) {
        return false;
    }
    let updated = false;
    for (const rule of configJson['packageRules']) {
        if (!Array.isArray(rule.addLabels)) {
            continue;
        }
        const idx = rule.addLabels.findIndex((x) => x === fromLabel);
        if (idx >= 0) {
            rule.addLabels[idx] = toLabel;
            updated = true;
        }
    }
    return updated;
}
//# sourceMappingURL=renovate-config-updates.js.map