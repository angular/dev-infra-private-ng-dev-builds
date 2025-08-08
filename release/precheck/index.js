import { debug } from 'console';
import { green, Log } from '../../utils/logging.js';
export class ReleasePrecheckError extends Error {
}
export async function assertPassingReleasePrechecks(config, newVersion, builtPackagesWithInfo) {
    if (config.prereleaseCheck === undefined) {
        Log.warn('  ⚠   Skipping release pre-checks. No checks configured.');
        return true;
    }
    try {
        await config.prereleaseCheck(newVersion.format(), builtPackagesWithInfo);
        Log.info(green('  ✓   Release pre-checks passing.'));
        return true;
    }
    catch (e) {
        if (e instanceof ReleasePrecheckError) {
            debug(e.message);
            Log.error(`  ✘   Release pre-checks failed. Please check the output above.`);
        }
        else {
            Log.error(e, '\n');
            Log.error(`  ✘   Release pre-checks errored with unexpected runtime error.`);
        }
        return false;
    }
}
//# sourceMappingURL=index.js.map