import { parse as parseYaml } from 'yaml';
import { PullApproveGroup } from './group.js';
export function parsePullApproveYaml(rawYaml) {
    return parseYaml(rawYaml, { merge: true });
}
export function getGroupsFromYaml(pullApproveYamlRaw) {
    const pullApprove = parsePullApproveYaml(pullApproveYamlRaw);
    return Object.entries(pullApprove.groups).reduce((groups, [groupName, group]) => {
        return groups.concat(new PullApproveGroup(groupName, group, groups));
    }, []);
}
//# sourceMappingURL=parse-yaml.js.map