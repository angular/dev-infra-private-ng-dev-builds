/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { PullApproveGroupArray, PullApproveStringArray } from './pullapprove_arrays.js';
import { PullApproveAuthorStateDependencyError } from './condition_errors.js';
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
            throw new PullApproveAuthorStateDependencyError();
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
        .replace(/^(.+)\s+not in\s+(.+)$/, '!$2.includes($1)')
        .replace(/^(.+)\s+in\s+(.+)$/, '$2.includes($1)')
        .replace(/not\s+/g, '!');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZGl0aW9uX2V2YWx1YXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25nLWRldi9wdWxsYXBwcm92ZS9jb25kaXRpb25fZXZhbHVhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxxQkFBcUIsRUFBRSxzQkFBc0IsRUFBQyxNQUFNLHlCQUF5QixDQUFDO0FBRXRGLE9BQU8sRUFBQyxxQ0FBcUMsRUFBQyxNQUFNLHVCQUF1QixDQUFDO0FBRTVFLE9BQU8sRUFBQyxlQUFlLEVBQUMsTUFBTSxZQUFZLENBQUM7QUFDM0MsT0FBTyxFQUFDLGVBQWUsRUFBQyxNQUFNLElBQUksQ0FBQztBQUVuQzs7Ozs7O0dBTUc7QUFDSCxNQUFNLDBCQUEwQixHQUFXLENBQUMsR0FBRyxFQUFFO0lBQy9DLE1BQU0sT0FBTyxHQUFHO1FBQ2QsS0FBSyxFQUFFLENBQUMsS0FBWSxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTTtRQUNyQyxvQkFBb0IsRUFBRSxDQUFDLEtBQTZCLEVBQUUsUUFBa0IsRUFBRSxFQUFFO1lBQzFFLDJFQUEyRTtZQUMzRSxzRUFBc0U7WUFDdEUsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMxRixDQUFDO0tBQ0YsQ0FBQztJQUVGLDBEQUEwRDtJQUMxRCxNQUFNLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUU7UUFDdkMsR0FBRyxFQUFFLEdBQUcsRUFBRTtZQUNSLE1BQU0sSUFBSSxxQ0FBcUMsRUFBRSxDQUFDO1FBQ3BELENBQUM7S0FDRixDQUFDLENBQUM7SUFFSCxPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDLENBQUMsRUFBRSxDQUFDO0FBRUw7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLDBCQUEwQixDQUN4QyxJQUFZO0lBRVosTUFBTSxZQUFZLEdBQUc7O2dCQUVQLHVCQUF1QixDQUFDLElBQUksQ0FBQzs7R0FFMUMsQ0FBQztJQUNGLE1BQU0sWUFBWSxHQUFHLGVBQWUsQ0FBQyxZQUFZLEVBQUUsMEJBQTBCLENBQUMsQ0FBQztJQUUvRSxPQUFPLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQ3ZCLE1BQU0sTUFBTSxHQUFHLFlBQVksQ0FDekIsSUFBSSxzQkFBc0IsQ0FBQyxHQUFHLEtBQUssQ0FBQyxFQUNwQyxJQUFJLHFCQUFxQixDQUFDLEdBQUcsTUFBTSxDQUFDLENBQ3JDLENBQUM7UUFFRixtRkFBbUY7UUFDbkYsa0ZBQWtGO1FBQ2xGLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQzFCLE9BQU8sTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUM7UUFDN0IsQ0FBQztRQUNELE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQztJQUNsQixDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILFNBQVMsdUJBQXVCLENBQUMsVUFBa0I7SUFDakQsT0FBTyxVQUFVO1NBQ2QsT0FBTyxDQUFDLHdCQUF3QixFQUFFLGtCQUFrQixDQUFDO1NBQ3JELE9BQU8sQ0FBQyxvQkFBb0IsRUFBRSxpQkFBaUIsQ0FBQztTQUNoRCxPQUFPLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzdCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtQdWxsQXBwcm92ZUdyb3VwQXJyYXksIFB1bGxBcHByb3ZlU3RyaW5nQXJyYXl9IGZyb20gJy4vcHVsbGFwcHJvdmVfYXJyYXlzLmpzJztcblxuaW1wb3J0IHtQdWxsQXBwcm92ZUF1dGhvclN0YXRlRGVwZW5kZW5jeUVycm9yfSBmcm9tICcuL2NvbmRpdGlvbl9lcnJvcnMuanMnO1xuaW1wb3J0IHtQdWxsQXBwcm92ZUdyb3VwfSBmcm9tICcuL2dyb3VwLmpzJztcbmltcG9ydCB7Z2V0T3JDcmVhdGVHbG9ifSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCB7cnVuSW5OZXdDb250ZXh0fSBmcm9tICd2bSc7XG5cbi8qKlxuICogQ29udGV4dCBvYmplY3QgdGhhdCB3aWxsIGJlIHVzZWQgYXMgZ2xvYmFsIGNvbnRleHQgaW4gY29uZGl0aW9uIGV2YWx1YXRpb24uXG4gKlxuICogQ29uZGl0aW9ucyBjYW4gdXNlIHZhcmlvdXMgaGVscGVycyB0aGF0IFB1bGxBcHByb3ZlIHByb3ZpZGVzLiBXZSB0cnkgdG9cbiAqIG1vY2sgdGhlbSBoZXJlLiBDb25zdWx0IHRoZSBvZmZpY2lhbCBkb2NzIGZvciBtb3JlIGRldGFpbHM6XG4gKiBodHRwczovL2RvY3MucHVsbGFwcHJvdmUuY29tL2NvbmZpZy9jb25kaXRpb25zLlxuICovXG5jb25zdCBjb25kaXRpb25FdmFsdWF0aW9uQ29udGV4dDogb2JqZWN0ID0gKCgpID0+IHtcbiAgY29uc3QgY29udGV4dCA9IHtcbiAgICAnbGVuJzogKHZhbHVlOiBhbnlbXSkgPT4gdmFsdWUubGVuZ3RoLFxuICAgICdjb250YWluc19hbnlfZ2xvYnMnOiAoZmlsZXM6IFB1bGxBcHByb3ZlU3RyaW5nQXJyYXksIHBhdHRlcm5zOiBzdHJpbmdbXSkgPT4ge1xuICAgICAgLy8gTm90ZTogRG8gbm90IGFsd2F5cyBjcmVhdGUgZ2xvYnMgZm9yIHRoZSBzYW1lIHBhdHRlcm4gYWdhaW4uIFRoaXMgbWV0aG9kXG4gICAgICAvLyBjb3VsZCBiZSBjYWxsZWQgZm9yIGVhY2ggc291cmNlIGZpbGUuIENyZWF0aW5nIGdsb2IncyBpcyBleHBlbnNpdmUuXG4gICAgICByZXR1cm4gZmlsZXMuc29tZSgoZikgPT4gcGF0dGVybnMuc29tZSgocGF0dGVybikgPT4gZ2V0T3JDcmVhdGVHbG9iKHBhdHRlcm4pLm1hdGNoKGYpKSk7XG4gICAgfSxcbiAgfTtcblxuICAvLyBXZSBjYW5ub3QgcHJvY2VzcyByZWZlcmVuY2VzIHRvIGBhdXRob3JgIGluIGNvbmRpdGlvbnMuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb250ZXh0LCAnYXV0aG9yJywge1xuICAgIGdldDogKCkgPT4ge1xuICAgICAgdGhyb3cgbmV3IFB1bGxBcHByb3ZlQXV0aG9yU3RhdGVEZXBlbmRlbmN5RXJyb3IoKTtcbiAgICB9LFxuICB9KTtcblxuICByZXR1cm4gY29udGV4dDtcbn0pKCk7XG5cbi8qKlxuICogQ29udmVydHMgYSBnaXZlbiBjb25kaXRpb24gdG8gYSBmdW5jdGlvbiB0aGF0IGFjY2VwdHMgYSBzZXQgb2YgZmlsZXMuIFRoZSByZXR1cm5lZFxuICogZnVuY3Rpb24gY2FuIGJlIGNhbGxlZCB0byBjaGVjayBpZiB0aGUgc2V0IG9mIGZpbGVzIG1hdGNoZXMgdGhlIGNvbmRpdGlvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRDb25kaXRpb25Ub0Z1bmN0aW9uKFxuICBleHByOiBzdHJpbmcsXG4pOiAoZmlsZXM6IHN0cmluZ1tdLCBncm91cHM6IFB1bGxBcHByb3ZlR3JvdXBbXSkgPT4gYm9vbGVhbiB7XG4gIGNvbnN0IGpzRXhwcmVzc2lvbiA9IGBcbiAgICAoZmlsZXMsIGdyb3VwcykgPT4ge1xuICAgICAgcmV0dXJuICgke3RyYW5zZm9ybUV4cHJlc3Npb25Ub0pzKGV4cHIpfSk7XG4gICAgfVxuICBgO1xuICBjb25zdCBpc01hdGNoaW5nRm4gPSBydW5Jbk5ld0NvbnRleHQoanNFeHByZXNzaW9uLCBjb25kaXRpb25FdmFsdWF0aW9uQ29udGV4dCk7XG5cbiAgcmV0dXJuIChmaWxlcywgZ3JvdXBzKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gaXNNYXRjaGluZ0ZuKFxuICAgICAgbmV3IFB1bGxBcHByb3ZlU3RyaW5nQXJyYXkoLi4uZmlsZXMpLFxuICAgICAgbmV3IFB1bGxBcHByb3ZlR3JvdXBBcnJheSguLi5ncm91cHMpLFxuICAgICk7XG5cbiAgICAvLyBJZiBhbiBhcnJheSBpcyByZXR1cm5lZCwgd2UgY29uc2lkZXIgdGhlIGNvbmRpdGlvbiBhcyBhY3RpdmUgaWYgdGhlIGFycmF5IGlzIG5vdFxuICAgIC8vIGVtcHR5LiBUaGlzIG1hdGNoZXMgUHVsbEFwcHJvdmUncyBjb25kaXRpb24gZXZhbHVhdGlvbiB0aGF0IGlzIGJhc2VkIG9uIFB5dGhvbi5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShyZXN1bHQpKSB7XG4gICAgICByZXR1cm4gcmVzdWx0Lmxlbmd0aCAhPT0gMDtcbiAgICB9XG4gICAgcmV0dXJuICEhcmVzdWx0O1xuICB9O1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybXMgYSBjb25kaXRpb24gZXhwcmVzc2lvbiBmcm9tIFB1bGxBcHByb3ZlIHRoYXQgaXMgYmFzZWQgb24gcHl0aG9uXG4gKiBzbyB0aGF0IGl0IGNhbiBiZSBydW4gaW5zaWRlIEphdmFTY3JpcHQuIEN1cnJlbnQgdHJhbnNmb3JtYXRpb25zOlxuICpcbiAqICAgMS4gYGFFeHByIG5vdCBpbiBiRXhwcmAgLS0+IGAhYkV4cHIuaW5jbHVkZXMoYUV4cHIpYFxuICogICAyLiBgYUV4cHIgaW4gYkV4cHJgICAgICAtLT4gYGJFeHByLmluY2x1ZGVzKGFFeHByYClcbiAqICAgMy4gYG5vdCBleHByYCAgICAgICAgICAgLS0+IGAhZXhwcmBcbiAqL1xuZnVuY3Rpb24gdHJhbnNmb3JtRXhwcmVzc2lvblRvSnMoZXhwcmVzc2lvbjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGV4cHJlc3Npb25cbiAgICAucmVwbGFjZSgvXiguKylcXHMrbm90IGluXFxzKyguKykkLywgJyEkMi5pbmNsdWRlcygkMSknKVxuICAgIC5yZXBsYWNlKC9eKC4rKVxccytpblxccysoLispJC8sICckMi5pbmNsdWRlcygkMSknKVxuICAgIC5yZXBsYWNlKC9ub3RcXHMrL2csICchJyk7XG59XG4iXX0=