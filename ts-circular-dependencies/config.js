import { dirname, extname, isAbsolute, resolve } from 'path';
import { Log } from '../utils/logging.js';
export async function loadTestConfig(configPath) {
    const configBaseDir = dirname(configPath);
    const resolveRelativePath = (relativePath) => resolve(configBaseDir, relativePath);
    try {
        let config;
        switch (extname(configPath)) {
            case '.mjs':
                config = await loadEsmModule(configPath);
                break;
            case '.cjs':
                config = require(configPath);
                break;
            default:
                try {
                    config = require(configPath);
                }
                catch (e) {
                    if (e.code === 'ERR_REQUIRE_ESM') {
                        config = await loadEsmModule(configPath);
                    }
                    throw e;
                }
        }
        config = { ...config };
        if (!isAbsolute(config.baseDir)) {
            config.baseDir = resolveRelativePath(config.baseDir);
        }
        if (config.goldenFile && !isAbsolute(config.goldenFile)) {
            config.goldenFile = resolveRelativePath(config.goldenFile);
        }
        if (!isAbsolute(config.glob)) {
            config.glob = resolveRelativePath(config.glob);
        }
        return config;
    }
    catch (e) {
        Log.error('Could not load test configuration file at: ' + configPath);
        Log.error(`Failed with error:`, e);
        process.exit(1);
    }
}
let load;
export function loadEsmModule(modulePath) {
    load ?? (load = new Function('modulePath', `return import(modulePath);`));
    return load(modulePath);
}
//# sourceMappingURL=config.js.map