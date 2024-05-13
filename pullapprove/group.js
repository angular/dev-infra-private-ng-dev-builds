/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { PullApproveAuthorStateDependencyError, PullApproveGroupStateDependencyError, } from './condition_errors.js';
import { convertConditionToFunction } from './condition_evaluator.js';
import { Log } from '../utils/logging.js';
/** A PullApprove group to be able to test files against. */
export class PullApproveGroup {
    constructor(groupName, config, precedingGroups = []) {
        this.groupName = groupName;
        this.precedingGroups = precedingGroups;
        /** List of conditions for the group. */
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
    /**
     * Tests a provided file path to determine if it would be considered matched by
     * the pull approve group's conditions.
     */
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
                // If a group relies on the author state, we assume this group to never match
                // or own a file. This is a strict assumption but prevents false-positives.
                if (e instanceof PullApproveAuthorStateDependencyError) {
                    condition.unverifiable = true;
                    allConditionsMet = false;
                }
                // In the case of a condition that depends on the state of groups, we want to ignore
                // that the verification can't accurately evaluate the condition and continue processing.
                // Other types of errors fail the verification, as conditions should otherwise be able to
                // execute without throwing.
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
        // A file matches the group when all conditions are met. A group is not considered
        // as matching when all conditions have been skipped.
        return allConditionsMet === true;
    }
    /** Retrieve the results for the Group, all matched and unmatched conditions. */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JvdXAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9uZy1kZXYvcHVsbGFwcHJvdmUvZ3JvdXAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUNMLHFDQUFxQyxFQUNyQyxvQ0FBb0MsR0FDckMsTUFBTSx1QkFBdUIsQ0FBQztBQUcvQixPQUFPLEVBQUMsMEJBQTBCLEVBQUMsTUFBTSwwQkFBMEIsQ0FBQztBQUNwRSxPQUFPLEVBQUMsR0FBRyxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUF5QnhDLDREQUE0RDtBQUM1RCxNQUFNLE9BQU8sZ0JBQWdCO0lBTTNCLFlBQ1MsU0FBaUIsRUFDeEIsTUFBOEIsRUFDckIsa0JBQXNDLEVBQUU7UUFGMUMsY0FBUyxHQUFULFNBQVMsQ0FBUTtRQUVmLG9CQUFlLEdBQWYsZUFBZSxDQUF5QjtRQVJuRCx3Q0FBd0M7UUFDL0IsZUFBVSxHQUFxQixFQUFFLENBQUM7UUFTekMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2hDLElBQUksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLFNBQVMsSUFBSSxFQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBQyxDQUFDO0lBQzlELENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxNQUE4QjtRQUN2RCxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUN0QixPQUFPLE1BQU0sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBUyxFQUFFLEVBQUU7Z0JBQzdDLE1BQU0sVUFBVSxHQUFHLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFFcEMsSUFBSSxDQUFDO29CQUNILElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO3dCQUNuQixVQUFVO3dCQUNWLE9BQU8sRUFBRSwwQkFBMEIsQ0FBQyxVQUFVLENBQUM7d0JBQy9DLFlBQVksRUFB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QUM3RSxPQUFPO1lBQ0wsaUJBQWlCO1lBQ2pCLFlBQVksRUFBRSxpQkFBaUIsQ0FBQyxNQUFNO1lBQ3RDLG1CQUFtQjtZQUNuQixjQUFjLEVBQUUsbUJBQW1CLENBQUMsTUFBTTtZQUMxQyxzQkFBc0I7WUFDdEIsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTO1NBQzFCLENBQUM7SUFDSixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtcbiAgUHVsbEFwcHJvdmVBdXRob3JTdGF0ZURlcGVuZGVuY3lFcnJvcixcbiAgUHVsbEFwcHJvdmVHcm91cFN0YXRlRGVwZW5kZW5jeUVycm9yLFxufSBmcm9tICcuL2NvbmRpdGlvbl9lcnJvcnMuanMnO1xuXG5pbXBvcnQge1B1bGxBcHByb3ZlR3JvdXBDb25maWd9IGZyb20gJy4vcGFyc2UteWFtbC5qcyc7XG5pbXBvcnQge2NvbnZlcnRDb25kaXRpb25Ub0Z1bmN0aW9ufSBmcm9tICcuL2NvbmRpdGlvbl9ldmFsdWF0b3IuanMnO1xuaW1wb3J0IHtMb2d9IGZyb20gJy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuXG4vKiogQSBjb25kaXRpb24gZm9yIGEgZ3JvdXAuICovXG5pbnRlcmZhY2UgR3JvdXBDb25kaXRpb24ge1xuICBleHByZXNzaW9uOiBzdHJpbmc7XG4gIGNoZWNrRm46IChmaWxlczogc3RyaW5nW10sIGdyb3VwczogUHVsbEFwcHJvdmVHcm91cFtdKSA9PiBib29sZWFuO1xuICBtYXRjaGVkRmlsZXM6IFNldDxzdHJpbmc+O1xuICB1bnZlcmlmaWFibGU6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBHcm91cFJldmlld2VycyB7XG4gIHVzZXJzPzogc3RyaW5nW107XG4gIHRlYW1zPzogc3RyaW5nW107XG59XG5cbi8qKiBSZXN1bHQgb2YgdGVzdGluZyBmaWxlcyBhZ2FpbnN0IHRoZSBncm91cC4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUHVsbEFwcHJvdmVHcm91cFJlc3VsdCB7XG4gIGdyb3VwTmFtZTogc3RyaW5nO1xuICBtYXRjaGVkQ29uZGl0aW9uczogR3JvdXBDb25kaXRpb25bXTtcbiAgbWF0Y2hlZENvdW50OiBudW1iZXI7XG4gIHVubWF0Y2hlZENvbmRpdGlvbnM6IEdyb3VwQ29uZGl0aW9uW107XG4gIHVubWF0Y2hlZENvdW50OiBudW1iZXI7XG4gIHVudmVyaWZpYWJsZUNvbmRpdGlvbnM6IEdyb3VwQ29uZGl0aW9uW107XG59XG5cbi8qKiBBIFB1bGxBcHByb3ZlIGdyb3VwIHRvIGJlIGFibGUgdG8gdGVzdCBmaWxlcyBhZ2FpbnN0LiAqL1xuZXhwb3J0IGNsYXNzIFB1bGxBcHByb3ZlR3JvdXAge1xuICAvKiogTGlzdCBvZiBjb25kaXRpb25zIGZvciB0aGUgZ3JvdXAuICovXG4gIHJlYWRvbmx5IGNvbmRpdGlvbnM6IEdyb3VwQ29uZGl0aW9uW10gPSBbXTtcbiAgLyoqIExpc3Qgb2YgcmV2aWV3ZXJzIGZvciB0aGUgZ3JvdXAuICovXG4gIHJlYWRvbmx5IHJldmlld2VyczogR3JvdXBSZXZpZXdlcnM7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIGdyb3VwTmFtZTogc3RyaW5nLFxuICAgIGNvbmZpZzogUHVsbEFwcHJvdmVHcm91cENvbmZpZyxcbiAgICByZWFkb25seSBwcmVjZWRpbmdHcm91cHM6IFB1bGxBcHByb3ZlR3JvdXBbXSA9IFtdLFxuICApIHtcbiAgICB0aGlzLl9jYXB0dXJlQ29uZGl0aW9ucyhjb25maWcpO1xuICAgIHRoaXMucmV2aWV3ZXJzID0gY29uZmlnLnJldmlld2VycyA/PyB7dXNlcnM6IFtdLCB0ZWFtczogW119O1xuICB9XG5cbiAgcHJpdmF0ZSBfY2FwdHVyZUNvbmRpdGlvbnMoY29uZmlnOiBQdWxsQXBwcm92ZUdyb3VwQ29uZmlnKSB7XG4gICAgaWYgKGNvbmZpZy5jb25kaXRpb25zKSB7XG4gICAgICByZXR1cm4gY29uZmlnLmNvbmRpdGlvbnMuZm9yRWFjaCgoY29uZGl0aW9uKSA9PiB7XG4gICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSBjb25kaXRpb24udHJpbSgpO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5jb25kaXRpb25zLnB1c2goe1xuICAgICAgICAgICAgZXhwcmVzc2lvbixcbiAgICAgICAgICAgIGNoZWNrRm46IGNvbnZlcnRDb25kaXRpb25Ub0Z1bmN0aW9uKGV4cHJlc3Npb24pLFxuICAgICAgICAgICAgbWF0Y2hlZEZpbGVzOiBuZXcgU2V0KCksXG4gICAgICAgICAgICB1bnZlcmlmaWFibGU6IGZhbHNlLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgTG9nLmVycm9yKGBDb3VsZCBub3QgcGFyc2UgY29uZGl0aW9uIGluIGdyb3VwOiAke3RoaXMuZ3JvdXBOYW1lfWApO1xuICAgICAgICAgIExvZy5lcnJvcihgIC0gJHtleHByZXNzaW9ufWApO1xuICAgICAgICAgIExvZy5lcnJvcihgRXJyb3I6YCwgZSk7XG4gICAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGVzdHMgYSBwcm92aWRlZCBmaWxlIHBhdGggdG8gZGV0ZXJtaW5lIGlmIGl0IHdvdWxkIGJlIGNvbnNpZGVyZWQgbWF0Y2hlZCBieVxuICAgKiB0aGUgcHVsbCBhcHByb3ZlIGdyb3VwJ3MgY29uZGl0aW9ucy5cbiAgICovXG4gIHRlc3RGaWxlKGZpbGVQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBsZXQgYWxsQ29uZGl0aW9uc01ldDogYm9vbGVhbiB8IG51bGwgPSBudWxsO1xuXG4gICAgZm9yIChjb25zdCBjb25kaXRpb24gb2YgdGhpcy5jb25kaXRpb25zKSB7XG4gICAgICBjb25zdCB7bWF0Y2hlZEZpbGVzLCBjaGVja0ZuLCBleHByZXNzaW9ufSA9IGNvbmRpdGlvbjtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IG1hdGNoZXNGaWxlID0gY2hlY2tGbihbZmlsZVBhdGhdLCB0aGlzLnByZWNlZGluZ0dyb3Vwcyk7XG5cbiAgICAgICAgaWYgKG1hdGNoZXNGaWxlKSB7XG4gICAgICAgICAgbWF0Y2hlZEZpbGVzLmFkZChmaWxlUGF0aCk7XG4gICAgICAgIH1cblxuICAgICAgICBhbGxDb25kaXRpb25zTWV0ID0gKGFsbENvbmRpdGlvbnNNZXQgPz8gdHJ1ZSkgJiYgbWF0Y2hlc0ZpbGU7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIElmIGEgZ3JvdXAgcmVsaWVzIG9uIHRoZSBhdXRob3Igc3RhdGUsIHdlIGFzc3VtZSB0aGlzIGdyb3VwIHRvIG5ldmVyIG1hdGNoXG4gICAgICAgIC8vIG9yIG93biBhIGZpbGUuIFRoaXMgaXMgYSBzdHJpY3QgYXNzdW1wdGlvbiBidXQgcHJldmVudHMgZmFsc2UtcG9zaXRpdmVzLlxuICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIFB1bGxBcHByb3ZlQXV0aG9yU3RhdGVEZXBlbmRlbmN5RXJyb3IpIHtcbiAgICAgICAgICBjb25kaXRpb24udW52ZXJpZmlhYmxlID0gdHJ1ZTtcbiAgICAgICAgICBhbGxDb25kaXRpb25zTWV0ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgLy8gSW4gdGhlIGNhc2Ugb2YgYSBjb25kaXRpb24gdGhhdCBkZXBlbmRzIG9uIHRoZSBzdGF0ZSBvZiBncm91cHMsIHdlIHdhbnQgdG8gaWdub3JlXG4gICAgICAgIC8vIHRoYXQgdGhlIHZlcmlmaWNhdGlvbiBjYW4ndCBhY2N1cmF0ZWx5IGV2YWx1YXRlIHRoZSBjb25kaXRpb24gYW5kIGNvbnRpbnVlIHByb2Nlc3NpbmcuXG4gICAgICAgIC8vIE90aGVyIHR5cGVzIG9mIGVycm9ycyBmYWlsIHRoZSB2ZXJpZmljYXRpb24sIGFzIGNvbmRpdGlvbnMgc2hvdWxkIG90aGVyd2lzZSBiZSBhYmxlIHRvXG4gICAgICAgIC8vIGV4ZWN1dGUgd2l0aG91dCB0aHJvd2luZy5cbiAgICAgICAgZWxzZSBpZiAoZSBpbnN0YW5jZW9mIFB1bGxBcHByb3ZlR3JvdXBTdGF0ZURlcGVuZGVuY3lFcnJvcikge1xuICAgICAgICAgIGNvbmRpdGlvbi51bnZlcmlmaWFibGUgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGVyck1lc3NhZ2UgPVxuICAgICAgICAgICAgYENvbmRpdGlvbiBjb3VsZCBub3QgYmUgZXZhbHVhdGVkOiBcXG5cXG5gICtcbiAgICAgICAgICAgIGBGcm9tIHRoZSBbJHt0aGlzLmdyb3VwTmFtZX1dIGdyb3VwOlxcbmAgK1xuICAgICAgICAgICAgYCAtICR7ZXhwcmVzc2lvbn1gO1xuICAgICAgICAgIExvZy5lcnJvcihlcnJNZXNzYWdlLCAnXFxuXFxuJywgZSwgJ1xcblxcbicpO1xuICAgICAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEEgZmlsZSBtYXRjaGVzIHRoZSBncm91cCB3aGVuIGFsbCBjb25kaXRpb25zIGFyZSBtZXQuIEEgZ3JvdXAgaXMgbm90IGNvbnNpZGVyZWRcbiAgICAvLyBhcyBtYXRjaGluZyB3aGVuIGFsbCBjb25kaXRpb25zIGhhdmUgYmVlbiBza2lwcGVkLlxuICAgIHJldHVybiBhbGxDb25kaXRpb25zTWV0ID09PSB0cnVlO1xuICB9XG5cbiAgLyoqIFJldHJpZXZlIHRoZSByZXN1bHRzIGZvciB0aGUgR3JvdXAsIGFsbCBtYXRjaGVkIGFuZCB1bm1hdGNoZWQgY29uZGl0aW9ucy4gKi9cbiAgZ2V0UmVzdWx0cygpOiBQdWxsQXBwcm92ZUdyb3VwUmVzdWx0IHtcbiAgICBjb25zdCBtYXRjaGVkQ29uZGl0aW9ucyA9IHRoaXMuY29uZGl0aW9ucy5maWx0ZXIoKGMpID0+IGMubWF0Y2hlZEZpbGVzLnNpemUgPiAwKTtcbiAgICBjb25zdCB1bm1hdGNoZWRDb25kaXRpb25zID0gdGhpcy5jb25kaXRpb25zLmZpbHRlcihcbiAgICAgIChjKSA9PiBjLm1hdGNoZWRGaWxlcy5zaXplID09PSAwICYmICFjLnVudmVyaWZpYWJsZSxcbiAgICApO1xuICAgIGNvbnN0IHVudmVyaWZpYWJsZUNvbmRpdGlvbnMgPSB0aGlzLmNvbmRpdGlvbnMuZmlsdGVyKChjKSA9PiBjLnVudmVyaWZpYWJsZSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1hdGNoZWRDb25kaXRpb25zLFxuICAgICAgbWF0Y2hlZENvdW50OiBtYXRjaGVkQ29uZGl0aW9ucy5sZW5ndGgsXG4gICAgICB1bm1hdGNoZWRDb25kaXRpb25zLFxuICAgICAgdW5tYXRjaGVkQ291bnQ6IHVubWF0Y2hlZENvbmRpdGlvbnMubGVuZ3RoLFxuICAgICAgdW52ZXJpZmlhYmxlQ29uZGl0aW9ucyxcbiAgICAgIGdyb3VwTmFtZTogdGhpcy5ncm91cE5hbWUsXG4gICAgfTtcbiAgfVxufVxuIl19