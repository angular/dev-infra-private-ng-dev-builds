import { Log } from '../logging.js';
import { AuthenticatedGitClient } from './authenticated-git-client.js';
import { GITHUB_TOKEN_GENERATE_URL } from './github-urls.js';
export function addGithubTokenOption(argv) {
    return (argv
        .option('github-token', {
        type: 'string',
        default: '',
        defaultDescription: '<LOCAL_TOKEN>',
        description: 'Github token. If not set, token is retrieved from the environment variables.',
        coerce: configureGitClientWithTokenOrFromEnvironment,
    }));
}
export function configureGitClientWithTokenOrFromEnvironment(token) {
    const githubToken = token || (process.env['GITHUB_TOKEN'] ?? process.env['TOKEN']);
    if (!githubToken) {
        Log.error('No Github token set. Please set the `GITHUB_TOKEN` environment variable.');
        Log.error('Alternatively, pass the `--github-token` command line flag.');
        Log.warn(`You can generate a token here: ${GITHUB_TOKEN_GENERATE_URL}`);
        throw Error('Unable to determine the Github token.');
    }
    AuthenticatedGitClient.configure(githubToken);
}
//# sourceMappingURL=github-yargs.js.map