import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
import { assertValidGithubConfig, getConfig } from '../../utils/config.js';
import { assertValidCaretakerConfig } from '../../utils/config.js';
import { CiModule } from './ci.js';
import { G3Module } from './g3.js';
import { GithubQueriesModule } from './github.js';
import { ServicesModule } from './services.js';
const moduleList = [GithubQueriesModule, ServicesModule, CiModule, G3Module];
export async function checkServiceStatuses() {
    const config = await getConfig();
    assertValidCaretakerConfig(config);
    assertValidGithubConfig(config);
    const git = await AuthenticatedGitClient.get();
    const caretakerCheckModules = moduleList.map((module) => new module(git, config));
    await Promise.all(caretakerCheckModules.map((module) => module.data));
    for (const module of caretakerCheckModules) {
        await module.printToTerminal();
    }
}
//# sourceMappingURL=check.js.map