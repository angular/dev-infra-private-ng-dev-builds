import { Log } from '../logging';
import { AuthenticatedGitClient } from './authenticated-git-client';
const mergeModePropertyName = 'merge-mode';
export async function getCurrentMergeMode() {
    const git = await AuthenticatedGitClient.get();
    const { data: properties } = await git.github.repos.customPropertiesForReposGetRepositoryValues({
        owner: git.remoteConfig.owner,
        repo: git.remoteConfig.name,
    });
    const property = properties.find(({ property_name }) => property_name === mergeModePropertyName);
    if (property === undefined) {
        throw Error(`No repository configuration value with the key: ${mergeModePropertyName}`);
    }
    return property.value;
}
export async function setRepoMergeMode(value) {
    const currentValue = await getCurrentMergeMode();
    if (currentValue === value) {
        Log.debug('Skipping update of repository configuration value as it is already set to the provided value');
        return false;
    }
    const git = await AuthenticatedGitClient.get();
    const { value_type, allowed_values } = await getRepoConfigValueDefinition(mergeModePropertyName, git);
    if (value_type !== 'single_select') {
        throw Error(`Unable to update ${mergeModePropertyName} as its type is ${value_type}, currently the ` +
            `only supported configuration type is single_select`);
    }
    if (!allowed_values.includes(value)) {
        throw Error(`Unable to update ${mergeModePropertyName}. The value provided must use one of: ` +
            `${allowed_values.join(', ')}\nBut "${value}" was provided as the value`);
    }
    await git.github.repos.customPropertiesForReposCreateOrUpdateRepositoryValues({
        owner: git.remoteConfig.owner,
        repo: git.remoteConfig.name,
        properties: [
            {
                property_name: mergeModePropertyName,
                value,
            },
        ],
    });
    return true;
}
async function getRepoConfigValueDefinition(key, git) {
    return git.github.orgs
        .customPropertiesForReposGetOrganizationDefinition({
        custom_property_name: key,
        org: git.remoteConfig.owner,
    })
        .then(({ data }) => data);
}
//# sourceMappingURL=repository-merge-mode.js.map