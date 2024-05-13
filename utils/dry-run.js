/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * Add a --dry-run flag to the available options for the yargs argv object. When present, sets an
 * environment variable noting dry run mode.
 */
export function addDryRunFlag(args) {
    return args.option('dry-run', {
        type: 'boolean',
        default: false,
        description: 'Whether to do a dry run',
        coerce: (dryRun) => {
            if (dryRun) {
                process.env['DRY_RUN'] = '1';
            }
            return dryRun;
        },
    });
}
/** Whether the current environment is in dry run mode. */
export function isDryRun() {
    return process.env['DRY_RUN'] !== undefined;
}
/** Error to be thrown when a function or method is called in dryRun mode and shouldn't be. */
export class DryRunError extends Error {
    constructor() {
        super('Cannot call this function in dryRun mode.');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHJ5LXJ1bi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25nLWRldi91dGlscy9kcnktcnVuLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlIOzs7R0FHRztBQUNILE1BQU0sVUFBVSxhQUFhLENBQUksSUFBYTtJQUM1QyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBcUIsRUFBRTtRQUN4QyxJQUFJLEVBQUUsU0FBUztRQUNmLE9BQU8sRUFBRSxLQUFLO1FBQ2QsV0FBVyxFQUFFLHlCQUF5QjtRQUN0QyxNQUFNLEVBQUUsQ0FBQyxNQUFlLEVBQUUsRUFBRTtZQUMxQixJQUFJLE1BQU0sRUFBRSxDQUFDO2dCQUNYLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxDQUFDO1lBQy9CLENBQUM7WUFDRCxPQUFPLE1BQU0sQ0FBQztRQUNoQixDQUFDO0tBQ0YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELDBEQUEwRDtBQUMxRCxNQUFNLFVBQVUsUUFBUTtJQUN0QixPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssU0FBUyxDQUFDO0FBQzlDLENBQUM7QUFFRCw4RkFBOEY7QUFDOUYsTUFBTSxPQUFPLFdBQVksU0FBUSxLQUFLO0lBQ3BDO1FBQ0UsS0FBSyxDQUFDLDJDQUEyQyxDQUFDLENBQUM7SUFDckQsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QXJndn0gZnJvbSAneWFyZ3MnO1xuXG4vKipcbiAqIEFkZCBhIC0tZHJ5LXJ1biBmbGFnIHRvIHRoZSBhdmFpbGFibGUgb3B0aW9ucyBmb3IgdGhlIHlhcmdzIGFyZ3Ygb2JqZWN0LiBXaGVuIHByZXNlbnQsIHNldHMgYW5cbiAqIGVudmlyb25tZW50IHZhcmlhYmxlIG5vdGluZyBkcnkgcnVuIG1vZGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhZGREcnlSdW5GbGFnPFQ+KGFyZ3M6IEFyZ3Y8VD4pIHtcbiAgcmV0dXJuIGFyZ3Mub3B0aW9uKCdkcnktcnVuJyBhcyAnZHJ5UnVuJywge1xuICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICBkZWZhdWx0OiBmYWxzZSxcbiAgICBkZXNjcmlwdGlvbjogJ1doZXRoZXIgdG8gZG8gYSBkcnkgcnVuJyxcbiAgICBjb2VyY2U6IChkcnlSdW46IGJvb2xlYW4pID0+IHtcbiAgICAgIGlmIChkcnlSdW4pIHtcbiAgICAgICAgcHJvY2Vzcy5lbnZbJ0RSWV9SVU4nXSA9ICcxJztcbiAgICAgIH1cbiAgICAgIHJldHVybiBkcnlSdW47XG4gICAgfSxcbiAgfSk7XG59XG5cbi8qKiBXaGV0aGVyIHRoZSBjdXJyZW50IGVudmlyb25tZW50IGlzIGluIGRyeSBydW4gbW9kZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0RyeVJ1bigpOiBib29sZWFuIHtcbiAgcmV0dXJuIHByb2Nlc3MuZW52WydEUllfUlVOJ10gIT09IHVuZGVmaW5lZDtcbn1cblxuLyoqIEVycm9yIHRvIGJlIHRocm93biB3aGVuIGEgZnVuY3Rpb24gb3IgbWV0aG9kIGlzIGNhbGxlZCBpbiBkcnlSdW4gbW9kZSBhbmQgc2hvdWxkbid0IGJlLiAqL1xuZXhwb3J0IGNsYXNzIERyeVJ1bkVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcignQ2Fubm90IGNhbGwgdGhpcyBmdW5jdGlvbiBpbiBkcnlSdW4gbW9kZS4nKTtcbiAgfVxufVxuIl19