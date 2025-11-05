import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Log } from '../utils/logging.js';
import { GitClient } from '../utils/git/git-client.js';
import { logGroup, logHeader } from './logging.js';
import { getGroupsFromYaml } from './parse-yaml.js';
export async function verify() {
    const git = await GitClient.get();
    const PULL_APPROVE_YAML_PATH = resolve(git.baseDir, '.pullapprove.yml');
    const REPO_FILES = git.allFiles();
    const pullApproveYamlRaw = readFileSync(PULL_APPROVE_YAML_PATH, 'utf8');
    const groups = getGroupsFromYaml(pullApproveYamlRaw);
    const groupsSkipped = groups.filter((group) => !group.conditions.length);
    const groupsWithConditions = groups.filter((group) => !!group.conditions.length);
    const matchedFiles = [];
    const unmatchedFiles = [];
    REPO_FILES.forEach((file) => {
        if (groupsWithConditions.filter((group) => group.testFile(file)).length) {
            matchedFiles.push(file);
        }
        else {
            unmatchedFiles.push(file);
        }
    });
    const resultsByGroup = groupsWithConditions.map((group) => group.getResults());
    const allGroupConditionsValid = resultsByGroup.every((r) => !r.unmatchedCount) && !unmatchedFiles.length;
    const groupsWithoutReviewers = groups.filter((group) => Object.keys(group.reviewers).length === 0);
    const overallResult = allGroupConditionsValid && groupsWithoutReviewers.length === 0;
    logHeader('Overall Result');
    if (overallResult) {
        Log.info('PullApprove verification succeeded!');
    }
    else {
        Log.info(`PullApprove verification failed.`);
        Log.info();
        Log.info(`Please update '.pullapprove.yml' to ensure that all necessary`);
        Log.info(`files/directories have owners and all patterns that appear in`);
        Log.info(`the file correspond to actual files/directories in the repo.`);
    }
    logHeader(`Group Reviewers Check`);
    if (groupsWithoutReviewers.length === 0) {
        Log.info('All group contain at least one reviewer user or team.');
    }
    else {
        Log.info(`Discovered ${groupsWithoutReviewers.length} group(s) without a reviewer defined`);
        groupsWithoutReviewers.forEach((g) => Log.info(g.groupName));
    }
    logHeader('PullApprove results by file');
    Log.info(`Matched Files (${matchedFiles.length} files)`);
    matchedFiles.forEach((file) => Log.debug(file));
    Log.info(`Unmatched Files (${unmatchedFiles.length} files)`);
    unmatchedFiles.forEach((file) => Log.info(file));
    logHeader('PullApprove results by group');
    Log.info(`Groups skipped (${groupsSkipped.length} groups)`);
    groupsSkipped.forEach((group) => Log.debug(`${group.groupName}`));
    const matchedGroups = resultsByGroup.filter((group) => !group.unmatchedCount);
    Log.info(`Matched conditions by Group (${matchedGroups.length} groups)`);
    matchedGroups.forEach((group) => logGroup(group, 'matchedConditions', Log.debug));
    const unmatchedGroups = resultsByGroup.filter((group) => group.unmatchedCount);
    Log.info(`Unmatched conditions by Group (${unmatchedGroups.length} groups)`);
    unmatchedGroups.forEach((group) => logGroup(group, 'unmatchedConditions'));
    const unverifiableConditionsInGroups = resultsByGroup.filter((group) => group.unverifiableConditions.length > 0);
    Log.info(`Unverifiable conditions by Group (${unverifiableConditionsInGroups.length} groups)`);
    unverifiableConditionsInGroups.forEach((group) => logGroup(group, 'unverifiableConditions'));
    process.exit(overallResult ? 0 : 1);
}
//# sourceMappingURL=verify.js.map