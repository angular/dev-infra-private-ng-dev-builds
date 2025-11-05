import { Log } from '../utils/logging.js';
export function logGroup(group, conditionsToPrint, printMessageFn = Log.info) {
    const conditions = group[conditionsToPrint];
    printMessageFn(`[${group.groupName}]`);
    if (conditions.length) {
        conditions.forEach((groupCondition) => {
            const count = groupCondition.matchedFiles.size;
            if (conditionsToPrint === 'unverifiableConditions') {
                printMessageFn(`${groupCondition.expression}`);
            }
            else {
                printMessageFn(`${count} ${count === 1 ? 'match' : 'matches'} - ${groupCondition.expression}`);
            }
        });
    }
}
export function logHeader(...params) {
    const totalWidth = 80;
    const fillWidth = totalWidth - 2;
    const headerText = params.join(' ').substr(0, fillWidth);
    const leftSpace = Math.ceil((fillWidth - headerText.length) / 2);
    const rightSpace = fillWidth - leftSpace - headerText.length;
    const fill = (count, content) => content.repeat(count);
    Log.info(`┌${fill(fillWidth, '─')}┐`);
    Log.info(`│${fill(leftSpace, ' ')}${headerText}${fill(rightSpace, ' ')}│`);
    Log.info(`└${fill(fillWidth, '─')}┘`);
}
//# sourceMappingURL=logging.js.map