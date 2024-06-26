/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ActiveReleaseTrains, getNextBranchName, } from '../../release/versioning/index.js';
import githubMacros from '../../utils/git/github-macros.js';
import { bold, Log } from '../../utils/logging.js';
import { BaseModule } from './base.js';
export class CiModule extends BaseModule {
    async retrieveData() {
        const nextBranchName = getNextBranchName(this.config.github);
        const repo = {
            api: this.git.github,
            ...this.git.remoteConfig,
            nextBranchName,
        };
        const { latest, next, releaseCandidate, exceptionalMinor } = await ActiveReleaseTrains.fetch(repo);
        const ciResultPromises = Object.entries({ releaseCandidate, exceptionalMinor, latest, next }).map(async ([trainName, train]) => {
            if (train === null) {
                return {
                    active: false,
                    name: trainName,
                    label: '',
                    status: null,
                };
            }
            const status = (await githubMacros.getCombinedChecksAndStatusesForRef(this.git.github, {
                ...this.git.remoteParams,
                ref: train.branchName,
            })).result;
            return {
                active: true,
                name: train.branchName,
                label: `${trainName} (${train.branchName})`,
                status,
            };
        });
        return await Promise.all(ciResultPromises);
    }
    async printToTerminal() {
        const data = await this.data;
        const minLabelLength = Math.max(...data.map((result) => result.label.length));
        Log.info.group(bold(`CI`));
        data.forEach((result) => {
            if (result.active === false) {
                Log.debug(`No active release train for ${result.name}`);
                return;
            }
            const label = result.label.padEnd(minLabelLength);
            if (result.status === null) {
                Log.info(`${result.name} branch was not found on CI`);
            }
            else if (result.status === 'passing') {
                Log.info(`${label} ✅`);
            }
            else if (result.status === 'pending') {
                Log.info(`${label} 🟡`);
            }
            else {
                Log.info(`${label} ❌`);
            }
        });
        Log.info.groupEnd();
        Log.info();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2kuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvY2FyZXRha2VyL2NoZWNrL2NpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFDTCxtQkFBbUIsRUFDbkIsaUJBQWlCLEdBR2xCLE1BQU0sbUNBQW1DLENBQUM7QUFDM0MsT0FBTyxZQUFZLE1BQU0sa0NBQWtDLENBQUM7QUFFNUQsT0FBTyxFQUFDLElBQUksRUFBRSxHQUFHLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNqRCxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBYXJDLE1BQU0sT0FBTyxRQUFTLFNBQVEsVUFBa0I7SUFDckMsS0FBSyxDQUFDLFlBQVk7UUFDekIsTUFBTSxjQUFjLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM3RCxNQUFNLElBQUksR0FBdUI7WUFDL0IsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTTtZQUNwQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWTtZQUN4QixjQUFjO1NBQ2YsQ0FBQztRQUNGLE1BQU0sRUFBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFDLEdBQ3RELE1BQU0sbUJBQW1CLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hDLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFDLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FDN0YsS0FBSyxFQUFFLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBZ0MsRUFBRSxFQUFFO1lBQzFELElBQUksS0FBSyxLQUFLLElBQUksRUFBRSxDQUFDO2dCQUNuQixPQUFPO29CQUNMLE1BQU0sRUFBRSxLQUFLO29CQUNiLElBQUksRUFBRSxTQUFTO29CQUNmLEtBQUssRUFBRSxFQUFFO29CQUNULE1BQU0sRUFBRSxJQUFJO2lCQUNiLENBQUM7WUFDSixDQUFDO1lBRUQsTUFBTSxNQUFNLEdBQUcsQ0FDYixNQUFNLFlBQVksQ0FBQyxrQ0FBa0MsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRTtnQkFDckUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVk7Z0JBQ3hCLEdBQUcsRUFBRSxLQUFLLENBQUMsVUFBVTthQUN0QixDQUFDLENBQ0gsQ0FBQyxNQUFNLENBQUM7WUFFVCxPQUFPO2dCQUNMLE1BQU0sRUFBRSxJQUFJO2dCQUNaLElBQUksRUFBRSxLQUFLLENBQUMsVUFBVTtnQkFDdEIsS0FBSyxFQUFFLEdBQUcsU0FBUyxLQUFLLEtBQUssQ0FBQyxVQUFVLEdBQUc7Z0JBQzNDLE1BQU07YUFDUCxDQUFDO1FBQ0osQ0FBQyxDQUNGLENBQUM7UUFFRixPQUFPLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFUSxLQUFLLENBQUMsZUFBZTtRQUM1QixNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDN0IsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUM5RSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUMzQixJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDdEIsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLEtBQUssRUFBRSxDQUFDO2dCQUM1QixHQUFHLENBQUMsS0FBSyxDQUFDLCtCQUErQixNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztnQkFDeEQsT0FBTztZQUNULENBQUM7WUFDRCxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUNsRCxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQzNCLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsSUFBSSw2QkFBNkIsQ0FBQyxDQUFDO1lBQ3hELENBQUM7aUJBQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUN2QyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxJQUFJLENBQUMsQ0FBQztZQUN6QixDQUFDO2lCQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDdkMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssS0FBSyxDQUFDLENBQUM7WUFDMUIsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLElBQUksQ0FBQyxDQUFDO1lBQ3pCLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUNILEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDcEIsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2IsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEFjdGl2ZVJlbGVhc2VUcmFpbnMsXG4gIGdldE5leHRCcmFuY2hOYW1lLFxuICBSZWxlYXNlUmVwb1dpdGhBcGksXG4gIFJlbGVhc2VUcmFpbixcbn0gZnJvbSAnLi4vLi4vcmVsZWFzZS92ZXJzaW9uaW5nL2luZGV4LmpzJztcbmltcG9ydCBnaXRodWJNYWNyb3MgZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi1tYWNyb3MuanMnO1xuXG5pbXBvcnQge2JvbGQsIExvZ30gZnJvbSAnLi4vLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQge0Jhc2VNb2R1bGV9IGZyb20gJy4vYmFzZS5qcyc7XG5cbi8qKiBUaGUgcmVzdWx0IG9mIGNoZWNraW5nIGEgYnJhbmNoIG9uIENJLiAqL1xudHlwZSBDaUJyYW5jaFN0YXR1cyA9ICdwZW5kaW5nJyB8ICdwYXNzaW5nJyB8ICdmYWlsaW5nJyB8IG51bGw7XG5cbi8qKiBBIGxpc3Qgb2YgcmVzdWx0cyBmb3IgY2hlY2tpbmcgQ0kgYnJhbmNoZXMuICovXG50eXBlIENpRGF0YSA9IHtcbiAgYWN0aXZlOiBib29sZWFuO1xuICBuYW1lOiBzdHJpbmc7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHN0YXR1czogQ2lCcmFuY2hTdGF0dXM7XG59W107XG5cbmV4cG9ydCBjbGFzcyBDaU1vZHVsZSBleHRlbmRzIEJhc2VNb2R1bGU8Q2lEYXRhPiB7XG4gIG92ZXJyaWRlIGFzeW5jIHJldHJpZXZlRGF0YSgpIHtcbiAgICBjb25zdCBuZXh0QnJhbmNoTmFtZSA9IGdldE5leHRCcmFuY2hOYW1lKHRoaXMuY29uZmlnLmdpdGh1Yik7XG4gICAgY29uc3QgcmVwbzogUmVsZWFzZVJlcG9XaXRoQXBpID0ge1xuICAgICAgYXBpOiB0aGlzLmdpdC5naXRodWIsXG4gICAgICAuLi50aGlzLmdpdC5yZW1vdGVDb25maWcsXG4gICAgICBuZXh0QnJhbmNoTmFtZSxcbiAgICB9O1xuICAgIGNvbnN0IHtsYXRlc3QsIG5leHQsIHJlbGVhc2VDYW5kaWRhdGUsIGV4Y2VwdGlvbmFsTWlub3J9ID1cbiAgICAgIGF3YWl0IEFjdGl2ZVJlbGVhc2VUcmFpbnMuZmV0Y2gocmVwbyk7XG4gICAgY29uc3QgY2lSZXN1bHRQcm9taXNlcyA9IE9iamVjdC5lbnRyaWVzKHtyZWxlYXNlQ2FuZGlkYXRlLCBleGNlcHRpb25hbE1pbm9yLCBsYXRlc3QsIG5leHR9KS5tYXAoXG4gICAgICBhc3luYyAoW3RyYWluTmFtZSwgdHJhaW5dOiBbc3RyaW5nLCBSZWxlYXNlVHJhaW4gfCBudWxsXSkgPT4ge1xuICAgICAgICBpZiAodHJhaW4gPT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYWN0aXZlOiBmYWxzZSxcbiAgICAgICAgICAgIG5hbWU6IHRyYWluTmFtZSxcbiAgICAgICAgICAgIGxhYmVsOiAnJyxcbiAgICAgICAgICAgIHN0YXR1czogbnVsbCxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3RhdHVzID0gKFxuICAgICAgICAgIGF3YWl0IGdpdGh1Yk1hY3Jvcy5nZXRDb21iaW5lZENoZWNrc0FuZFN0YXR1c2VzRm9yUmVmKHRoaXMuZ2l0LmdpdGh1Yiwge1xuICAgICAgICAgICAgLi4udGhpcy5naXQucmVtb3RlUGFyYW1zLFxuICAgICAgICAgICAgcmVmOiB0cmFpbi5icmFuY2hOYW1lLFxuICAgICAgICAgIH0pXG4gICAgICAgICkucmVzdWx0O1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgYWN0aXZlOiB0cnVlLFxuICAgICAgICAgIG5hbWU6IHRyYWluLmJyYW5jaE5hbWUsXG4gICAgICAgICAgbGFiZWw6IGAke3RyYWluTmFtZX0gKCR7dHJhaW4uYnJhbmNoTmFtZX0pYCxcbiAgICAgICAgICBzdGF0dXMsXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICk7XG5cbiAgICByZXR1cm4gYXdhaXQgUHJvbWlzZS5hbGwoY2lSZXN1bHRQcm9taXNlcyk7XG4gIH1cblxuICBvdmVycmlkZSBhc3luYyBwcmludFRvVGVybWluYWwoKSB7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuZGF0YTtcbiAgICBjb25zdCBtaW5MYWJlbExlbmd0aCA9IE1hdGgubWF4KC4uLmRhdGEubWFwKChyZXN1bHQpID0+IHJlc3VsdC5sYWJlbC5sZW5ndGgpKTtcbiAgICBMb2cuaW5mby5ncm91cChib2xkKGBDSWApKTtcbiAgICBkYXRhLmZvckVhY2goKHJlc3VsdCkgPT4ge1xuICAgICAgaWYgKHJlc3VsdC5hY3RpdmUgPT09IGZhbHNlKSB7XG4gICAgICAgIExvZy5kZWJ1ZyhgTm8gYWN0aXZlIHJlbGVhc2UgdHJhaW4gZm9yICR7cmVzdWx0Lm5hbWV9YCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGxhYmVsID0gcmVzdWx0LmxhYmVsLnBhZEVuZChtaW5MYWJlbExlbmd0aCk7XG4gICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gbnVsbCkge1xuICAgICAgICBMb2cuaW5mbyhgJHtyZXN1bHQubmFtZX0gYnJhbmNoIHdhcyBub3QgZm91bmQgb24gQ0lgKTtcbiAgICAgIH0gZWxzZSBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ3Bhc3NpbmcnKSB7XG4gICAgICAgIExvZy5pbmZvKGAke2xhYmVsfSDinIVgKTtcbiAgICAgIH0gZWxzZSBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ3BlbmRpbmcnKSB7XG4gICAgICAgIExvZy5pbmZvKGAke2xhYmVsfSDwn5+hYCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBMb2cuaW5mbyhgJHtsYWJlbH0g4p2MYCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgTG9nLmluZm8uZ3JvdXBFbmQoKTtcbiAgICBMb2cuaW5mbygpO1xuICB9XG59XG4iXX0=