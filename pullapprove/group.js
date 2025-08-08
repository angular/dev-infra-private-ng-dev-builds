import { PullApproveAuthorStateDependencyError, PullApproveGroupStateDependencyError, } from './condition_errors.js';
import { convertConditionToFunction } from './condition_evaluator.js';
import { Log } from '../utils/logging.js';
export class PullApproveGroup {
    constructor(groupName, config, precedingGroups = []) {
        this.groupName = groupName;
        this.precedingGroups = precedingGroups;
        this.conditions = [];
        this._captureConditions(config);
        this.reviewers = config.reviewers ?? { users: [], teams: [] };
    }
    _captureConditions(config) {
        if (config.conditions) {
            return config.conditions.forEach((condition) => {
                const expression = condition.trim();
                try {
                    this.conditions.push({
                        expression,
                        checkFn: convertConditionToFunction(expression),
                        matchedFiles: new Set(),
                        unverifiable: false,
                    });
                }
                catch (e) {
                    Log.error(`Could not parse condition in group: ${this.groupName}`);
                    Log.error(` - ${expression}`);
                    Log.error(`Error:`, e);
                    process.exit(1);
                }
            });
        }
    }
    testFile(filePath) {
        let allConditionsMet = null;
        for (const condition of this.conditions) {
            const { matchedFiles, checkFn, expression } = condition;
            try {
                const matchesFile = checkFn([filePath], this.precedingGroups);
                if (matchesFile) {
                    matchedFiles.add(filePath);
                }
                allConditionsMet = (allConditionsMet ?? true) && matchesFile;
            }
            catch (e) {
                if (e instanceof PullApproveAuthorStateDependencyError) {
                    condition.unverifiable = true;
                    allConditionsMet = false;
                }
                else if (e instanceof PullApproveGroupStateDependencyError) {
                    condition.unverifiable = true;
                }
                else {
                    const errMessage = `Condition could not be evaluated: \n\n` +
                        `From the [${this.groupName}] group:\n` +
                        ` - ${expression}`;
                    Log.error(errMessage, '\n\n', e, '\n\n');
                    process.exit(1);
                }
            }
        }
        return allConditionsMet === true;
    }
    getResults() {
        const matchedConditions = this.conditions.filter((c) => c.matchedFiles.size > 0);
        const unmatchedConditions = this.conditions.filter((c) => c.matchedFiles.size === 0 && !c.unverifiable);
        const unverifiableConditions = this.conditions.filter((c) => c.unverifiable);
        return {
            matchedConditions,
            matchedCount: matchedConditions.length,
            unmatchedConditions,
            unmatchedCount: unmatchedConditions.length,
            unverifiableConditions,
            groupName: this.groupName,
        };
    }
}
//# sourceMappingURL=group.js.map