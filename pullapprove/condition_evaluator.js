import { PullApproveGroupArray, PullApproveStringArray } from './pullapprove_arrays.js';
import { getOrCreateGlob } from './utils.js';
import { runInNewContext } from 'vm';
const conditionEvaluationContext = (() => {
    const context = {
        'len': (value) => value.length,
        'contains_any_globs': (files, patterns) => {
            return files.some((f) => patterns.some((pattern) => getOrCreateGlob(pattern).match(f)));
        },
    };
    Object.defineProperty(context, 'author', {
        get: () => {
            const x = new String();
            x.matchesAny = true;
            return x;
        },
    });
    return context;
})();
export function convertConditionToFunction(expr) {
    const jsExpression = `
    (files, groups) => {
      return (${transformExpressionToJs(expr)});
    }
  `;
    const isMatchingFn = runInNewContext(jsExpression, conditionEvaluationContext);
    return (files, groups) => {
        const result = isMatchingFn(new PullApproveStringArray(...files), new PullApproveGroupArray(...groups));
        if (Array.isArray(result)) {
            return result.length !== 0;
        }
        return !!result;
    };
}
function transformExpressionToJs(expression) {
    return expression
        .replace(/^(.+)\s+not in\s+(\[.+\])$/, '!$2.includes($1)')
        .replace(/^(.+)\s+in\s+(.+)$/, '$2.some(x => $1.matchesAny || $1 == x)')
        .replace(/^(.+)\s+not in\s+(.+)$/, '!$2.includes($1)')
        .replace(/^(.+)\s+in\s+(.+)$/, '$2.includes($1)')
        .replace(/not\s+/g, '!');
}
//# sourceMappingURL=condition_evaluator.js.map