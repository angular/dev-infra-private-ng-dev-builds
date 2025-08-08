import { GithubConfig, CaretakerConfig } from '../../utils/config.js';
import { AuthenticatedGitClient } from '../../utils/git/authenticated-git-client.js';
export declare abstract class BaseModule<Data> {
    protected git: AuthenticatedGitClient;
    protected config: {
        caretaker: CaretakerConfig;
        github: GithubConfig;
    };
    readonly data: Promise<Data>;
    constructor(git: AuthenticatedGitClient, config: {
        caretaker: CaretakerConfig;
        github: GithubConfig;
    });
    protected abstract retrieveData(): Promise<Data>;
    abstract printToTerminal(): Promise<void>;
}
