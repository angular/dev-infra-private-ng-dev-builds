import { GitClient } from '../../utils/git/git-client.js';
import { getConfig } from '../../utils/config.js';
import { assertValidFormatConfig } from '../config.js';
import { Buildifier } from './buildifier.js';
import { Prettier } from './prettier.js';
export async function getActiveFormatters() {
    const config = await getConfig();
    assertValidFormatConfig(config);
    const gitClient = await GitClient.get();
    return [new Prettier(gitClient, config.format), new Buildifier(gitClient, config.format)].filter((formatter) => formatter.isEnabled());
}
export { Formatter } from './base-formatter.js';
//# sourceMappingURL=index.js.map