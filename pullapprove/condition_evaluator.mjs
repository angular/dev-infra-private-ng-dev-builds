/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { PullApproveGroupArray, PullApproveStringArray } from './pullapprove_arrays.js';
import { getOrCreateGlob } from './utils.js';
import { runInNewContext } from 'vm';
/**
 * Context object that will be used as global context in condition evaluation.
 *
 * Conditions can use various helpers that PullApprove provides. We try to
 * mock them here. Consult the official docs for more details:
 * https://docs.pullapprove.com/config/conditions.
 */
const conditionEvaluationContext = (() => {
    const context = {
        'len': (value) => value.length,
        'contains_any_globs': (files, patterns) => {
            // Note: Do not always create globs for the same pattern again. This method
            // could be called for each source file. Creating glob's is expensive.
            return files.some((f) => patterns.some((pattern) => getOrCreateGlob(pattern).match(f)));
        },
    };
    // We cannot process references to `author` in conditions.
    Object.defineProperty(context, 'author', {
        get: () => {
            const x = new String();
            x.matchesAny = true;
            return x;
        },
    });
    return context;
})();
/**
 * Converts a given condition to a function that accepts a set of files. The returned
 * function can be called to check if the set of files matches the condition.
 */
export function convertConditionToFunction(expr) {
    const jsExpression = `
    (files, groups) => {
      return (${transformExpressionToJs(expr)});
    }
  `;
    const isMatchingFn = runInNewContext(jsExpression, conditionEvaluationContext);
    return (files, groups) => {
        const result = isMatchingFn(new PullApproveStringArray(...files), new PullApproveGroupArray(...groups));
        // If an array is returned, we consider the condition as active if the array is not
        // empty. This matches PullApprove's condition evaluation that is based on Python.
        if (Array.isArray(result)) {
            return result.length !== 0;
        }
        return !!result;
    };
}
/**
 * Transforms a condition expression from PullApprove that is based on python
 * so that it can be run inside JavaScript. Current transformations:
 *
 *   1. `aExpr not in bExpr` --> `!bExpr.includes(aExpr)`
 *   2. `aExpr in bExpr`     --> `bExpr.includes(aExpr`)
 *   3. `not expr`           --> `!expr`
 */
function transformExpressionToJs(expression) {
    return expression
        .replace(/^(.+)\s+not in\s+(\[.+\])$/, '!$2.includes($1)')
        .replace(/^(.+)\s+in\s+(.+)$/, '$2.some(x => $1.matchesAny || $1 == x)')
        .replace(/^(.+)\s+not in\s+(.+)$/, '!$2.includes($1)')
        .replace(/^(.+)\s+in\s+(.+)$/, '$2.includes($1)')
        .replace(/not\s+/g, '!');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZGl0aW9uX2V2YWx1YXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25nLWRldi9wdWxsYXBwcm92ZS9jb25kaXRpb25fZXZhbHVhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxxQkFBcUIsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBSXRGLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDM0MsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLElBQUksQ0FBQztBQUVuQzs7Ozs7O0dBTUc7QUFDSCxNQUFNLDBCQUEwQixHQUFXLENBQUMsR0FBRyxFQUFFO0lBQy9DLE1BQU0sT0FBTyxHQUFHO1FBQ2QsS0FBSyxFQUFFLENBQUMsS0FBWSxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTTtRQUNyQyxvQkFBb0IsRUFBRSxDQUFDLEtBQTZCLEVBQUUsUUFBa0IsRUFBRSxFQUFFO1lBQzFFLDJFQUEyRTtZQUMzRSxzRUFBc0U7WUFDdEUsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMxRixDQUFDO0tBQ0YsQ0FBQztJQUVGLDBEQUEwRDtJQUMxRCxNQUFNLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUU7UUFDdkMsR0FBRyxFQUFFLEdBQUcsRUFBRTtZQUNSLE1BQU0sQ0FBQyxHQUFRLElBQUksTUFBTSxFQUFFLENBQUM7WUFDNUIsQ0FBQyxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7WUFDcEIsT0FBTyxDQUFDLENBQUM7UUFDWCxDQUFDO0tBQ0YsQ0FBQyxDQUFDO0lBRUgsT0FBTyxPQUFPLENBQUM7QUFDakIsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUVMOzs7R0FHRztBQUNILE1BQU0sVUFBVSwwQkFBMEIsQ0FDeEMsSUFBWTtJQUVaLE1BQU0sWUFBWSxHQUFHOztnQkFFUCx1QkFBdUIsQ0FBQyxJQUFJLENBQUM7O0dBRTFDLENBQUM7SUFDRixNQUFNLFlBQVksR0FBRyxlQUFlLENBQUMsWUFBWSxFQUFFLDBCQUEwQixDQUFDLENBQUM7SUFFL0UsT0FBTyxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsRUFBRTtRQUN2QixNQUFNLE1BQU0sR0FBRyxZQUFZLENBQ3pCLElBQUksc0JBQXNCLENBQUMsR0FBRyxLQUFLLENBQUMsRUFDcEMsSUFBSSxxQkFBcUIsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUNyQyxDQUFDO1FBRUYsbUZBQW1GO1FBQ25GLGtGQUFrRjtRQUNsRixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUMxQixPQUFPLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDO1FBQzdCLENBQUM7UUFDRCxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUM7SUFDbEIsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLHVCQUF1QixDQUFDLFVBQWtCO0lBQ2pELE9BQU8sVUFBVTtTQUNkLE9BQU8sQ0FBQyw0QkFBNEIsRUFBRSxrQkFBa0IsQ0FBQztTQUN6RCxPQUFPLENBQUMsb0JBQW9CLEVBQUUsd0NBQXdDLENBQUM7U0FDdkUsT0FBTyxDQUFDLHdCQUF3QixFQUFFLGtCQUFrQixDQUFDO1NBQ3JELE9BQU8sQ0FBQyxvQkFBb0IsRUFBRSxpQkFBaUIsQ0FBQztTQUNoRCxPQUFPLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzdCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtQdWxsQXBwcm92ZUdyb3VwQXJyYXksIFB1bGxBcHByb3ZlU3RyaW5nQXJyYXl9IGZyb20gJy4vcHVsbGFwcHJvdmVfYXJyYXlzLmpzJztcblxuaW1wb3J0IHtQdWxsQXBwcm92ZUF1dGhvclN0YXRlRGVwZW5kZW5jeUVycm9yfSBmcm9tICcuL2NvbmRpdGlvbl9lcnJvcnMuanMnO1xuaW1wb3J0IHtQdWxsQXBwcm92ZUdyb3VwfSBmcm9tICcuL2dyb3VwLmpzJztcbmltcG9ydCB7Z2V0T3JDcmVhdGVHbG9ifSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCB7cnVuSW5OZXdDb250ZXh0fSBmcm9tICd2bSc7XG5cbi8qKlxuICogQ29udGV4dCBvYmplY3QgdGhhdCB3aWxsIGJlIHVzZWQgYXMgZ2xvYmFsIGNvbnRleHQgaW4gY29uZGl0aW9uIGV2YWx1YXRpb24uXG4gKlxuICogQ29uZGl0aW9ucyBjYW4gdXNlIHZhcmlvdXMgaGVscGVycyB0aGF0IFB1bGxBcHByb3ZlIHByb3ZpZGVzLiBXZSB0cnkgdG9cbiAqIG1vY2sgdGhlbSBoZXJlLiBDb25zdWx0IHRoZSBvZmZpY2lhbCBkb2NzIGZvciBtb3JlIGRldGFpbHM6XG4gKiBodHRwczovL2RvY3MucHVsbGFwcHJvdmUuY29tL2NvbmZpZy9jb25kaXRpb25zLlxuICovXG5jb25zdCBjb25kaXRpb25FdmFsdWF0aW9uQ29udGV4dDogb2JqZWN0ID0gKCgpID0+IHtcbiAgY29uc3QgY29udGV4dCA9IHtcbiAgICAnbGVuJzogKHZhbHVlOiBhbnlbXSkgPT4gdmFsdWUubGVuZ3RoLFxuICAgICdjb250YWluc19hbnlfZ2xvYnMnOiAoZmlsZXM6IFB1bGxBcHByb3ZlU3RyaW5nQXJyYXksIHBhdHRlcm5zOiBzdHJpbmdbXSkgPT4ge1xuICAgICAgLy8gTm90ZTogRG8gbm90IGFsd2F5cyBjcmVhdGUgZ2xvYnMgZm9yIHRoZSBzYW1lIHBhdHRlcm4gYWdhaW4uIFRoaXMgbWV0aG9kXG4gICAgICAvLyBjb3VsZCBiZSBjYWxsZWQgZm9yIGVhY2ggc291cmNlIGZpbGUuIENyZWF0aW5nIGdsb2IncyBpcyBleHBlbnNpdmUuXG4gICAgICByZXR1cm4gZmlsZXMuc29tZSgoZikgPT4gcGF0dGVybnMuc29tZSgocGF0dGVybikgPT4gZ2V0T3JDcmVhdGVHbG9iKHBhdHRlcm4pLm1hdGNoKGYpKSk7XG4gICAgfSxcbiAgfTtcblxuICAvLyBXZSBjYW5ub3QgcHJvY2VzcyByZWZlcmVuY2VzIHRvIGBhdXRob3JgIGluIGNvbmRpdGlvbnMuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb250ZXh0LCAnYXV0aG9yJywge1xuICAgIGdldDogKCkgPT4ge1xuICAgICAgY29uc3QgeDogYW55ID0gbmV3IFN0cmluZygpO1xuICAgICAgeC5tYXRjaGVzQW55ID0gdHJ1ZTtcbiAgICAgIHJldHVybiB4O1xuICAgIH0sXG4gIH0pO1xuXG4gIHJldHVybiBjb250ZXh0O1xufSkoKTtcblxuLyoqXG4gKiBDb252ZXJ0cyBhIGdpdmVuIGNvbmRpdGlvbiB0byBhIGZ1bmN0aW9uIHRoYXQgYWNjZXB0cyBhIHNldCBvZiBmaWxlcy4gVGhlIHJldHVybmVkXG4gKiBmdW5jdGlvbiBjYW4gYmUgY2FsbGVkIHRvIGNoZWNrIGlmIHRoZSBzZXQgb2YgZmlsZXMgbWF0Y2hlcyB0aGUgY29uZGl0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydENvbmRpdGlvblRvRnVuY3Rpb24oXG4gIGV4cHI6IHN0cmluZyxcbik6IChmaWxlczogc3RyaW5nW10sIGdyb3VwczogUHVsbEFwcHJvdmVHcm91cFtdKSA9PiBib29sZWFuIHtcbiAgY29uc3QganNFeHByZXNzaW9uID0gYFxuICAgIChmaWxlcywgZ3JvdXBzKSA9PiB7XG4gICAgICByZXR1cm4gKCR7dHJhbnNmb3JtRXhwcmVzc2lvblRvSnMoZXhwcil9KTtcbiAgICB9XG4gIGA7XG4gIGNvbnN0IGlzTWF0Y2hpbmdGbiA9IHJ1bkluTmV3Q29udGV4dChqc0V4cHJlc3Npb24sIGNvbmRpdGlvbkV2YWx1YXRpb25Db250ZXh0KTtcblxuICByZXR1cm4gKGZpbGVzLCBncm91cHMpID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBpc01hdGNoaW5nRm4oXG4gICAgICBuZXcgUHVsbEFwcHJvdmVTdHJpbmdBcnJheSguLi5maWxlcyksXG4gICAgICBuZXcgUHVsbEFwcHJvdmVHcm91cEFycmF5KC4uLmdyb3VwcyksXG4gICAgKTtcblxuICAgIC8vIElmIGFuIGFycmF5IGlzIHJldHVybmVkLCB3ZSBjb25zaWRlciB0aGUgY29uZGl0aW9uIGFzIGFjdGl2ZSBpZiB0aGUgYXJyYXkgaXMgbm90XG4gICAgLy8gZW1wdHkuIFRoaXMgbWF0Y2hlcyBQdWxsQXBwcm92ZSdzIGNvbmRpdGlvbiBldmFsdWF0aW9uIHRoYXQgaXMgYmFzZWQgb24gUHl0aG9uLlxuICAgIGlmIChBcnJheS5pc0FycmF5KHJlc3VsdCkpIHtcbiAgICAgIHJldHVybiByZXN1bHQubGVuZ3RoICE9PSAwO1xuICAgIH1cbiAgICByZXR1cm4gISFyZXN1bHQ7XG4gIH07XG59XG5cbi8qKlxuICogVHJhbnNmb3JtcyBhIGNvbmRpdGlvbiBleHByZXNzaW9uIGZyb20gUHVsbEFwcHJvdmUgdGhhdCBpcyBiYXNlZCBvbiBweXRob25cbiAqIHNvIHRoYXQgaXQgY2FuIGJlIHJ1biBpbnNpZGUgSmF2YVNjcmlwdC4gQ3VycmVudCB0cmFuc2Zvcm1hdGlvbnM6XG4gKlxuICogICAxLiBgYUV4cHIgbm90IGluIGJFeHByYCAtLT4gYCFiRXhwci5pbmNsdWRlcyhhRXhwcilgXG4gKiAgIDIuIGBhRXhwciBpbiBiRXhwcmAgICAgIC0tPiBgYkV4cHIuaW5jbHVkZXMoYUV4cHJgKVxuICogICAzLiBgbm90IGV4cHJgICAgICAgICAgICAtLT4gYCFleHByYFxuICovXG5mdW5jdGlvbiB0cmFuc2Zvcm1FeHByZXNzaW9uVG9KcyhleHByZXNzaW9uOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gZXhwcmVzc2lvblxuICAgIC5yZXBsYWNlKC9eKC4rKVxccytub3QgaW5cXHMrKFxcWy4rXFxdKSQvLCAnISQyLmluY2x1ZGVzKCQxKScpXG4gICAgLnJlcGxhY2UoL14oLispXFxzK2luXFxzKyguKykkLywgJyQyLnNvbWUoeCA9PiAkMS5tYXRjaGVzQW55IHx8ICQxID09IHgpJylcbiAgICAucmVwbGFjZSgvXiguKylcXHMrbm90IGluXFxzKyguKykkLywgJyEkMi5pbmNsdWRlcygkMSknKVxuICAgIC5yZXBsYWNlKC9eKC4rKVxccytpblxccysoLispJC8sICckMi5pbmNsdWRlcygkMSknKVxuICAgIC5yZXBsYWNlKC9ub3RcXHMrL2csICchJyk7XG59XG4iXX0=