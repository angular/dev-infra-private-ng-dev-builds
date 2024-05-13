/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { bold, Log } from '../../utils/logging.js';
import { G3Stats } from '../../utils/g3.js';
import { BaseModule } from './base.js';
export class G3Module extends BaseModule {
    async retrieveData() {
        return await G3Stats.retrieveDiffStats(this.git, this.config);
    }
    async printToTerminal() {
        const stats = await this.data;
        if (!stats) {
            return;
        }
        Log.info.group(bold('g3 branch check'));
        if (stats.files === 0 && stats.separateFiles === 0) {
            Log.info(`${stats.commits} commits between g3 and ${this.git.mainBranchName}`);
            Log.info('✅  No sync is needed at this time');
        }
        else if (stats.separateFiles > 0) {
            Log.info(`${stats.separateFiles} primitives files changed, ${stats.files} Angular files changed, ` +
                `${stats.insertions} insertions(+), ${stats.deletions} deletions(-) from ` +
                `${stats.commits} commits will be included in the next sync\n` +
                `Note: Shared primivites code has been merged. Only more Shared Primitives code can be ` +
                `merged until the next sync is landed`);
        }
        else {
            Log.info(`${stats.files} files changed, ${stats.insertions} insertions(+), ${stats.deletions} ` +
                `deletions(-) from ${stats.commits} commits will be included in the next sync`);
        }
        Log.info.groupEnd();
        Log.info();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZzMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvY2FyZXRha2VyL2NoZWNrL2czLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxJQUFJLEVBQUUsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDakQsT0FBTyxFQUFjLE9BQU8sRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRXZELE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSxXQUFXLENBQUM7QUFFckMsTUFBTSxPQUFPLFFBQVMsU0FBUSxVQUE4QjtJQUNqRCxLQUFLLENBQUMsWUFBWTtRQUN6QixPQUFPLE1BQU0sT0FBTyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2hFLENBQUM7SUFFUSxLQUFLLENBQUMsZUFBZTtRQUM1QixNQUFNLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDOUIsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1gsT0FBTztRQUNULENBQUM7UUFDRCxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1FBQ3hDLElBQUksS0FBSyxDQUFDLEtBQUssS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLGFBQWEsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNuRCxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLE9BQU8sMkJBQTJCLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQztZQUMvRSxHQUFHLENBQUMsSUFBSSxDQUFDLG1DQUFtQyxDQUFDLENBQUM7UUFDaEQsQ0FBQzthQUFNLElBQUksS0FBSyxDQUFDLGFBQWEsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNuQyxHQUFHLENBQUMsSUFBSSxDQUNOLEdBQUcsS0FBSyxDQUFDLGFBQWEsOEJBQThCLEtBQUssQ0FBQyxLQUFLLDBCQUEwQjtnQkFDdkYsR0FBRyxLQUFLLENBQUMsVUFBVSxtQkFBbUIsS0FBSyxDQUFDLFNBQVMscUJBQXFCO2dCQUMxRSxHQUFHLEtBQUssQ0FBQyxPQUFPLDhDQUE4QztnQkFDOUQsd0ZBQXdGO2dCQUN4RixzQ0FBc0MsQ0FDekMsQ0FBQztRQUNKLENBQUM7YUFBTSxDQUFDO1lBQ04sR0FBRyxDQUFDLElBQUksQ0FDTixHQUFHLEtBQUssQ0FBQyxLQUFLLG1CQUFtQixLQUFLLENBQUMsVUFBVSxtQkFBbUIsS0FBSyxDQUFDLFNBQVMsR0FBRztnQkFDcEYscUJBQXFCLEtBQUssQ0FBQyxPQUFPLDRDQUE0QyxDQUNqRixDQUFDO1FBQ0osQ0FBQztRQUNELEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDcEIsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2IsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Ym9sZCwgTG9nfSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7RzNTdGF0c0RhdGEsIEczU3RhdHN9IGZyb20gJy4uLy4uL3V0aWxzL2czLmpzJztcblxuaW1wb3J0IHtCYXNlTW9kdWxlfSBmcm9tICcuL2Jhc2UuanMnO1xuXG5leHBvcnQgY2xhc3MgRzNNb2R1bGUgZXh0ZW5kcyBCYXNlTW9kdWxlPEczU3RhdHNEYXRhIHwgdm9pZD4ge1xuICBvdmVycmlkZSBhc3luYyByZXRyaWV2ZURhdGEoKSB7XG4gICAgcmV0dXJuIGF3YWl0IEczU3RhdHMucmV0cmlldmVEaWZmU3RhdHModGhpcy5naXQsIHRoaXMuY29uZmlnKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGFzeW5jIHByaW50VG9UZXJtaW5hbCgpIHtcbiAgICBjb25zdCBzdGF0cyA9IGF3YWl0IHRoaXMuZGF0YTtcbiAgICBpZiAoIXN0YXRzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIExvZy5pbmZvLmdyb3VwKGJvbGQoJ2czIGJyYW5jaCBjaGVjaycpKTtcbiAgICBpZiAoc3RhdHMuZmlsZXMgPT09IDAgJiYgc3RhdHMuc2VwYXJhdGVGaWxlcyA9PT0gMCkge1xuICAgICAgTG9nLmluZm8oYCR7c3RhdHMuY29tbWl0c30gY29tbWl0cyBiZXR3ZWVuIGczIGFuZCAke3RoaXMuZ2l0Lm1haW5CcmFuY2hOYW1lfWApO1xuICAgICAgTG9nLmluZm8oJ+KchSAgTm8gc3luYyBpcyBuZWVkZWQgYXQgdGhpcyB0aW1lJyk7XG4gICAgfSBlbHNlIGlmIChzdGF0cy5zZXBhcmF0ZUZpbGVzID4gMCkge1xuICAgICAgTG9nLmluZm8oXG4gICAgICAgIGAke3N0YXRzLnNlcGFyYXRlRmlsZXN9IHByaW1pdGl2ZXMgZmlsZXMgY2hhbmdlZCwgJHtzdGF0cy5maWxlc30gQW5ndWxhciBmaWxlcyBjaGFuZ2VkLCBgICtcbiAgICAgICAgICBgJHtzdGF0cy5pbnNlcnRpb25zfSBpbnNlcnRpb25zKCspLCAke3N0YXRzLmRlbGV0aW9uc30gZGVsZXRpb25zKC0pIGZyb20gYCArXG4gICAgICAgICAgYCR7c3RhdHMuY29tbWl0c30gY29tbWl0cyB3aWxsIGJlIGluY2x1ZGVkIGluIHRoZSBuZXh0IHN5bmNcXG5gICtcbiAgICAgICAgICBgTm90ZTogU2hhcmVkIHByaW1pdml0ZXMgY29kZSBoYXMgYmVlbiBtZXJnZWQuIE9ubHkgbW9yZSBTaGFyZWQgUHJpbWl0aXZlcyBjb2RlIGNhbiBiZSBgICtcbiAgICAgICAgICBgbWVyZ2VkIHVudGlsIHRoZSBuZXh0IHN5bmMgaXMgbGFuZGVkYCxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIExvZy5pbmZvKFxuICAgICAgICBgJHtzdGF0cy5maWxlc30gZmlsZXMgY2hhbmdlZCwgJHtzdGF0cy5pbnNlcnRpb25zfSBpbnNlcnRpb25zKCspLCAke3N0YXRzLmRlbGV0aW9uc30gYCArXG4gICAgICAgICAgYGRlbGV0aW9ucygtKSBmcm9tICR7c3RhdHMuY29tbWl0c30gY29tbWl0cyB3aWxsIGJlIGluY2x1ZGVkIGluIHRoZSBuZXh0IHN5bmNgLFxuICAgICAgKTtcbiAgICB9XG4gICAgTG9nLmluZm8uZ3JvdXBFbmQoKTtcbiAgICBMb2cuaW5mbygpO1xuICB9XG59XG4iXX0=