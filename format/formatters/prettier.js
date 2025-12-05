import { join } from 'path';
import { ChildProcess } from '../../utils/child-process.js';
import { Log } from '../../utils/logging.js';
import { Formatter } from './base-formatter.js';
export class Prettier extends Formatter {
    constructor() {
        super(...arguments);
        this.name = 'prettier';
        this.binaryFilePath = join(this.git.baseDir, 'node_modules/.bin/prettier');
        this.matchers = [
            '**/*.{js,cjs,mjs}',
            '**/*.{ts,cts,mts}',
            '**/*.{jsx,tsx}',
            '**/*.{css,scss}',
            '**/*.{json,json5}',
            '**/*.{yml,yaml}',
            '**/*.md',
            '**/*.html',
        ];
        this.configPath = this.config['prettier']
            ? ChildProcess.spawnSync(this.binaryFilePath, [
                '--find-config-path',
                join(process.cwd(), 'dummy.js'),
            ]).stdout.trim()
            : '';
        this.actions = {
            check: {
                commandFlags: `--config ${this.configPath} --check`,
                callback: (_, code, stdout) => {
                    return code !== 0;
                },
            },
            format: {
                commandFlags: `--config ${this.configPath} --write`,
                callback: (file, code, _, stderr) => {
                    if (code !== 0) {
                        Log.error(`Error running prettier on: ${file}`);
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
//# sourceMappingURL=prettier.js.map