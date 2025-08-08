import { getConfig } from '../../utils/config.js';
import { assertValidReleaseConfig } from '../config/index.js';
main().catch((e) => {
    console.error(e);
    throw e;
});
async function main() {
    if (process.send === undefined) {
        throw Error('This script needs to be invoked as a NodeJS worker.');
    }
    const config = await getConfig();
    assertValidReleaseConfig(config);
    const builtPackages = await config.release.buildPackages();
    process.send(builtPackages);
}
//# sourceMappingURL=build-worker.js.map