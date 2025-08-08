import { URL } from 'url';
export const GITHUB_TOKEN_SETTINGS_URL = 'https://github.com/settings/tokens';
export const GITHUB_TOKEN_GENERATE_URL = 'https://github.com/settings/tokens/new';
export function addTokenToGitHttpsUrl(githubHttpsUrl, token) {
    const url = new URL(githubHttpsUrl);
    url.password = token;
    url.username = 'x-access-token';
    return url.href;
}
export function getRepositoryGitUrl(config, githubToken) {
    if (config.useSsh) {
        return `git@github.com:${config.owner}/${config.name}.git`;
    }
    const baseHttpUrl = `https://github.com/${config.owner}/${config.name}.git`;
    if (githubToken !== undefined) {
        return addTokenToGitHttpsUrl(baseHttpUrl, githubToken);
    }
    return baseHttpUrl;
}
export function getListCommitsInBranchUrl(client, branchName) {
    const { owner, repo } = client.remoteParams;
    return `https://github.com/${owner}/${repo}/commits/${branchName}`;
}
export function getFileContentsUrl(client, ref, relativeFilePath) {
    const { owner, repo } = client.remoteParams;
    return `https://github.com/${owner}/${repo}/blob/${ref}/${relativeFilePath}`;
}
//# sourceMappingURL=github-urls.js.map