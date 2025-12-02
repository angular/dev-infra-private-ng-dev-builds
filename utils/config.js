import { join } from 'path';
import { Log } from './logging.js';
import { getCachedConfig, setCachedConfig } from './config-cache.js';
import { determineRepoBaseDirFromCwd } from './repo-directory.js';
import { pathToFileURL } from 'url';
const CONFIG_FILE_PATH_MATCHER = '.ng-dev/config.mjs';
const USER_CONFIG_FILE_PATH = '.ng-dev.user';
let userConfig = null;
export const setConfig = setCachedConfig;
export async function getConfig(baseDirOrAssertions) {
    let cachedConfig = getCachedConfig();
    if (cachedConfig === null) {
        let baseDir;
        if (typeof baseDirOrAssertions === 'string') {
            baseDir = baseDirOrAssertions;
        }
        else {
            baseDir = determineRepoBaseDirFromCwd();
        }
        const configPath = join(baseDir, CONFIG_FILE_PATH_MATCHER);
        cachedConfig = await readConfigFile(configPath);
        setCachedConfig(cachedConfig);
    }
    if (Array.isArray(baseDirOrAssertions)) {
        for (const assertion of baseDirOrAssertions) {
            assertion(cachedConfig);
        }
    }
    return { ...cachedConfig, __isNgDevConfigObject: true };
}
export async function getUserConfig() {
    if (userConfig === null) {
        const configPath = join(determineRepoBaseDirFromCwd(), USER_CONFIG_FILE_PATH);
        userConfig = await readConfigFile(configPath, true);
    }
    return { ...userConfig };
}
export class ConfigValidationError extends Error {
    constructor(message, errors = []) {
        super(message);
        this.errors = errors;
    }
}
export function assertValidGithubConfig(config) {
    const errors = [];
    if (config.github === undefined) {
        errors.push(`Github repository not configured. Set the "github" option.`);
    }
    else {
        if (config.github.name === undefined) {
            errors.push(`"github.name" is not defined`);
        }
        if (config.github.owner === undefined) {
            errors.push(`"github.owner" is not defined`);
        }
        if (config.github.mergeMode === undefined) {
            errors.push(`"github.mergeMode" is not defined`);
        }
    }
    if (errors.length) {
        throw new ConfigValidationError('Invalid `github` configuration', errors);
    }
}
export function assertValidCaretakerConfig(config) {
    if (config.caretaker === undefined) {
        throw new ConfigValidationError(`No configuration defined for "caretaker"`);
    }
}
async function readConfigFile(configPath, returnEmptyObjectOnError = false) {
    try {
        return await import(pathToFileURL(configPath).toString());
    }
    catch (e) {
        if (returnEmptyObjectOnError) {
            Log.debug(`Could not read configuration file at ${configPath}, returning empty object instead.`);
            Log.debug(e);
            return {};
        }
        Log.error(`Could not read configuration file at ${configPath}.`);
        Log.error(e);
        process.exit(1);
    }
}
//# sourceMappingURL=config.js.map