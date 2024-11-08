/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { bold, green, Log } from '../../utils/logging.js';
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
            Log.info(` ${green('✔')} No sync is needed at this time`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZzMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvY2FyZXRha2VyL2NoZWNrL2czLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBQyxNQUFNLHdCQUF3QixDQUFDO0FBQ3hELE9BQU8sRUFBYyxPQUFPLEVBQUMsTUFBTSxtQkFBbUIsQ0FBQztBQUV2RCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBRXJDLE1BQU0sT0FBTyxRQUFTLFNBQVEsVUFBOEI7SUFDakQsS0FBSyxDQUFDLFlBQVk7UUFDekIsT0FBTyxNQUFNLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBRVEsS0FBSyxDQUFDLGVBQWU7UUFDNUIsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQzlCLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNYLE9BQU87UUFDVCxDQUFDO1FBQ0QsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQztRQUN4QyxJQUFJLEtBQUssQ0FBQyxLQUFLLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxhQUFhLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDbkQsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxPQUFPLDJCQUEyQixJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUM7WUFDL0UsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsaUNBQWlDLENBQUMsQ0FBQztRQUM1RCxDQUFDO2FBQU0sSUFBSSxLQUFLLENBQUMsYUFBYSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ25DLEdBQUcsQ0FBQyxJQUFJLENBQ04sR0FBRyxLQUFLLENBQUMsYUFBYSw4QkFBOEIsS0FBSyxDQUFDLEtBQUssMEJBQTBCO2dCQUN2RixHQUFHLEtBQUssQ0FBQyxVQUFVLG1CQUFtQixLQUFLLENBQUMsU0FBUyxxQkFBcUI7Z0JBQzFFLEdBQUcsS0FBSyxDQUFDLE9BQU8sOENBQThDO2dCQUM5RCx3RkFBd0Y7Z0JBQ3hGLHNDQUFzQyxDQUN6QyxDQUFDO1FBQ0osQ0FBQzthQUFNLENBQUM7WUFDTixHQUFHLENBQUMsSUFBSSxDQUNOLEdBQUcsS0FBSyxDQUFDLEtBQUssbUJBQW1CLEtBQUssQ0FBQyxVQUFVLG1CQUFtQixLQUFLLENBQUMsU0FBUyxHQUFHO2dCQUNwRixxQkFBcUIsS0FBSyxDQUFDLE9BQU8sNENBQTRDLENBQ2pGLENBQUM7UUFDSixDQUFDO1FBQ0QsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNwQixHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDYixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtib2xkLCBncmVlbiwgTG9nfSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7RzNTdGF0c0RhdGEsIEczU3RhdHN9IGZyb20gJy4uLy4uL3V0aWxzL2czLmpzJztcblxuaW1wb3J0IHtCYXNlTW9kdWxlfSBmcm9tICcuL2Jhc2UuanMnO1xuXG5leHBvcnQgY2xhc3MgRzNNb2R1bGUgZXh0ZW5kcyBCYXNlTW9kdWxlPEczU3RhdHNEYXRhIHwgdm9pZD4ge1xuICBvdmVycmlkZSBhc3luYyByZXRyaWV2ZURhdGEoKSB7XG4gICAgcmV0dXJuIGF3YWl0IEczU3RhdHMucmV0cmlldmVEaWZmU3RhdHModGhpcy5naXQsIHRoaXMuY29uZmlnKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGFzeW5jIHByaW50VG9UZXJtaW5hbCgpIHtcbiAgICBjb25zdCBzdGF0cyA9IGF3YWl0IHRoaXMuZGF0YTtcbiAgICBpZiAoIXN0YXRzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIExvZy5pbmZvLmdyb3VwKGJvbGQoJ2czIGJyYW5jaCBjaGVjaycpKTtcbiAgICBpZiAoc3RhdHMuZmlsZXMgPT09IDAgJiYgc3RhdHMuc2VwYXJhdGVGaWxlcyA9PT0gMCkge1xuICAgICAgTG9nLmluZm8oYCR7c3RhdHMuY29tbWl0c30gY29tbWl0cyBiZXR3ZWVuIGczIGFuZCAke3RoaXMuZ2l0Lm1haW5CcmFuY2hOYW1lfWApO1xuICAgICAgTG9nLmluZm8oYCAke2dyZWVuKCfinJQnKX0gTm8gc3luYyBpcyBuZWVkZWQgYXQgdGhpcyB0aW1lYCk7XG4gICAgfSBlbHNlIGlmIChzdGF0cy5zZXBhcmF0ZUZpbGVzID4gMCkge1xuICAgICAgTG9nLmluZm8oXG4gICAgICAgIGAke3N0YXRzLnNlcGFyYXRlRmlsZXN9IHByaW1pdGl2ZXMgZmlsZXMgY2hhbmdlZCwgJHtzdGF0cy5maWxlc30gQW5ndWxhciBmaWxlcyBjaGFuZ2VkLCBgICtcbiAgICAgICAgICBgJHtzdGF0cy5pbnNlcnRpb25zfSBpbnNlcnRpb25zKCspLCAke3N0YXRzLmRlbGV0aW9uc30gZGVsZXRpb25zKC0pIGZyb20gYCArXG4gICAgICAgICAgYCR7c3RhdHMuY29tbWl0c30gY29tbWl0cyB3aWxsIGJlIGluY2x1ZGVkIGluIHRoZSBuZXh0IHN5bmNcXG5gICtcbiAgICAgICAgICBgTm90ZTogU2hhcmVkIHByaW1pdml0ZXMgY29kZSBoYXMgYmVlbiBtZXJnZWQuIE9ubHkgbW9yZSBTaGFyZWQgUHJpbWl0aXZlcyBjb2RlIGNhbiBiZSBgICtcbiAgICAgICAgICBgbWVyZ2VkIHVudGlsIHRoZSBuZXh0IHN5bmMgaXMgbGFuZGVkYCxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIExvZy5pbmZvKFxuICAgICAgICBgJHtzdGF0cy5maWxlc30gZmlsZXMgY2hhbmdlZCwgJHtzdGF0cy5pbnNlcnRpb25zfSBpbnNlcnRpb25zKCspLCAke3N0YXRzLmRlbGV0aW9uc30gYCArXG4gICAgICAgICAgYGRlbGV0aW9ucygtKSBmcm9tICR7c3RhdHMuY29tbWl0c30gY29tbWl0cyB3aWxsIGJlIGluY2x1ZGVkIGluIHRoZSBuZXh0IHN5bmNgLFxuICAgICAgKTtcbiAgICB9XG4gICAgTG9nLmluZm8uZ3JvdXBFbmQoKTtcbiAgICBMb2cuaW5mbygpO1xuICB9XG59XG4iXX0=