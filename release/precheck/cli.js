import semver from 'semver';
import { assertPassingReleasePrechecks } from './index.js';
import { getConfig } from '../../utils/config.js';
import { readBufferFromStdinUntilClosed } from '../../utils/read-stdin-until-closed.js';
import { assertValidReleaseConfig } from '../config/index.js';
import { Log } from '../../utils/logging.js';
async function handler() {
    const stdin = await readBufferFromStdinUntilClosed();
    const config = await getConfig();
    assertValidReleaseConfig(config);
    const { builtPackagesWithInfo, newVersion: newVersionRaw } = JSON.parse(stdin.toString('utf8'));
    if (!Array.isArray(builtPackagesWithInfo)) {
        Log.error(`  ✘   Release pre-checks failed. Invalid list of built packages was provided.`);
        process.exitCode = 1;
        return;
    }
    const newVersion = semver.parse(newVersionRaw);
    if (newVersion === null) {
        Log.error(`  ✘   Release pre-checks failed. Invalid new version was provided.`);
        process.exitCode = 1;
        return;
    }
    if (!(await assertPassingReleasePrechecks(config.release, newVersion, builtPackagesWithInfo))) {
        process.exitCode = 1;
    }
}
export const ReleasePrecheckCommandModule = {
    handler,
    command: 'precheck',
    describe: false,
};
//# sourceMappingURL=cli.js.map