import { join } from 'path';
import { determineRepoBaseDirFromCwd } from './repo-directory.js';
let BAZEL_BIN = undefined;
export function getBazelBin() {
    if (BAZEL_BIN === undefined) {
        BAZEL_BIN =
            process.env['BAZEL'] || join(determineRepoBaseDirFromCwd(), 'node_modules/.bin/bazel');
    }
    return BAZEL_BIN;
}
//# sourceMappingURL=bazel-bin.js.map