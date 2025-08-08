import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import { Log, green } from '../utils/logging.js';
import { GitClient } from '../utils/git/git-client.js';
export async function verify() {
    const git = await GitClient.get();
    const NGBOT_CONFIG_YAML_PATH = resolve(git.baseDir, '.github/angular-robot.yml');
    const ngBotYaml = readFileSync(NGBOT_CONFIG_YAML_PATH, 'utf8');
    try {
        parseYaml(ngBotYaml);
        Log.info(green('✔  Valid NgBot YAML config'));
    }
    catch (e) {
        Log.error(`! Invalid NgBot YAML config`);
        Log.error(e);
        process.exitCode = 1;
    }
}
//# sourceMappingURL=verify.js.map