import { join } from 'path';
import { Log } from '../../utils/logging.js';
import { Formatter } from './base-formatter.js';
export class Buildifier extends Formatter {
    constructor() {
        super(...arguments);
        this.name = 'buildifier';
        this.binaryFilePath = join(this.git.baseDir, 'node_modules/.bin/buildifier');
        this.matchers = ['**/*.bzl', '**/*.bazel', '**/WORKSPACE', '**/BUILD'];
        this.actions = {
            check: {
                commandFlags: `${BAZEL_WARNING_FLAG} --lint=warn --mode=check --format=json`,
                callback: (_, code, stdout) => {
                    stdout = stdout || '{}';
                    return code !== 0 || !JSON.parse(stdout).success;
                },
            },
            format: {
                commandFlags: `${BAZEL_WARNING_FLAG} --lint=fix --mode=fix`,
                callback: (file, code, _, stderr) => {
                    if (code !== 0) {
                        Log.error(`Error running buildifier on: ${file}`);
                        Log.error(stderr);
                        Log.error();
                        return true;
                    }
                    return false;
                },
            },
        };
    }
}
const BAZEL_WARNING_FLAG = `--warnings=attr-cfg,attr-license,attr-non-empty,attr-output-default,` +
    `attr-single-file,ctx-args,depset-iteration,depset-union,dict-concatenation,` +
    `duplicated-name,filetype,git-repository,http-archive,integer-division,load,` +
    `native-build,native-package,output-group,package-name,package-on-top,positional-args,` +
    `redefined-variable,repository-name,string-iteration,unused-variable`;
//# sourceMappingURL=buildifier.js.map