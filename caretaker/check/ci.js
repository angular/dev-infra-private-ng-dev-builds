/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ActiveReleaseTrains, getNextBranchName, } from '../../release/versioning/index.js';
import githubMacros from '../../utils/git/github-macros.js';
import { bold, green, Log, red, yellow } from '../../utils/logging.js';
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
                Log.info(`${label} ${green('✔')}`);
            }
            else if (result.status === 'pending') {
                Log.info(`${label} ${yellow('⏺')}`);
            }
            else {
                Log.info(`${label} ${red('✘')}`);
            }
        });
        Log.info.groupEnd();
        Log.info();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2kuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9uZy1kZXYvY2FyZXRha2VyL2NoZWNrL2NpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFDTCxtQkFBbUIsRUFDbkIsaUJBQWlCLEdBR2xCLE1BQU0sbUNBQW1DLENBQUM7QUFDM0MsT0FBTyxZQUFZLE1BQU0sa0NBQWtDLENBQUM7QUFFNUQsT0FBTyxFQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUMsTUFBTSx3QkFBd0IsQ0FBQztBQUNyRSxPQUFPLEVBQUMsVUFBVSxFQUFDLE1BQU0sV0FBVyxDQUFDO0FBYXJDLE1BQU0sT0FBTyxRQUFTLFNBQVEsVUFBa0I7SUFDckMsS0FBSyxDQUFDLFlBQVk7UUFDekIsTUFBTSxjQUFjLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM3RCxNQUFNLElBQUksR0FBdUI7WUFDL0IsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTTtZQUNwQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWTtZQUN4QixjQUFjO1NBQ2YsQ0FBQztRQUNGLE1BQU0sRUFBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFDLEdBQ3RELE1BQU0sbUJBQW1CLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hDLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFDLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FDN0YsS0FBSyxFQUFFLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBZ0MsRUFBRSxFQUFFO1lBQzFELElBQUksS0FBSyxLQUFLLElBQUksRUFBRSxDQUFDO2dCQUNuQixPQUFPO29CQUNMLE1BQU0sRUFBRSxLQUFLO29CQUNiLElBQUksRUFBRSxTQUFTO29CQUNmLEtBQUssRUFBRSxFQUFFO29CQUNULE1BQU0sRUFBRSxJQUFJO2lCQUNiLENBQUM7WUFDSixDQUFDO1lBRUQsTUFBTSxNQUFNLEdBQUcsQ0FDYixNQUFNLFlBQVksQ0FBQyxrQ0FBa0MsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRTtnQkFDckUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVk7Z0JBQ3hCLEdBQUcsRUFBRSxLQUFLLENBQUMsVUFBVTthQUN0QixDQUFDLENBQ0gsQ0FBQyxNQUFNLENBQUM7WUFFVCxPQUFPO2dCQUNMLE1BQU0sRUFBRSxJQUFJO2dCQUNaLElBQUksRUFBRSxLQUFLLENBQUMsVUFBVTtnQkFDdEIsS0FBSyxFQUFFLEdBQUcsU0FBUyxLQUFLLEtBQUssQ0FBQyxVQUFVLEdBQUc7Z0JBQzNDLE1BQU07YUFDUCxDQUFDO1FBQ0osQ0FBQyxDQUNGLENBQUM7UUFFRixPQUFPLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFUSxLQUFLLENBQUMsZUFBZTtRQUM1QixNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDN0IsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUM5RSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUMzQixJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDdEIsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLEtBQUssRUFBRSxDQUFDO2dCQUM1QixHQUFHLENBQUMsS0FBSyxDQUFDLCtCQUErQixNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztnQkFDeEQsT0FBTztZQUNULENBQUM7WUFDRCxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUNsRCxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQzNCLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsSUFBSSw2QkFBNkIsQ0FBQyxDQUFDO1lBQ3hELENBQUM7aUJBQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUN2QyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDckMsQ0FBQztpQkFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQ3ZDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUN0QyxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ25DLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUNILEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDcEIsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2IsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEFjdGl2ZVJlbGVhc2VUcmFpbnMsXG4gIGdldE5leHRCcmFuY2hOYW1lLFxuICBSZWxlYXNlUmVwb1dpdGhBcGksXG4gIFJlbGVhc2VUcmFpbixcbn0gZnJvbSAnLi4vLi4vcmVsZWFzZS92ZXJzaW9uaW5nL2luZGV4LmpzJztcbmltcG9ydCBnaXRodWJNYWNyb3MgZnJvbSAnLi4vLi4vdXRpbHMvZ2l0L2dpdGh1Yi1tYWNyb3MuanMnO1xuXG5pbXBvcnQge2JvbGQsIGdyZWVuLCBMb2csIHJlZCwgeWVsbG93fSBmcm9tICcuLi8uLi91dGlscy9sb2dnaW5nLmpzJztcbmltcG9ydCB7QmFzZU1vZHVsZX0gZnJvbSAnLi9iYXNlLmpzJztcblxuLyoqIFRoZSByZXN1bHQgb2YgY2hlY2tpbmcgYSBicmFuY2ggb24gQ0kuICovXG50eXBlIENpQnJhbmNoU3RhdHVzID0gJ3BlbmRpbmcnIHwgJ3Bhc3NpbmcnIHwgJ2ZhaWxpbmcnIHwgbnVsbDtcblxuLyoqIEEgbGlzdCBvZiByZXN1bHRzIGZvciBjaGVja2luZyBDSSBicmFuY2hlcy4gKi9cbnR5cGUgQ2lEYXRhID0ge1xuICBhY3RpdmU6IGJvb2xlYW47XG4gIG5hbWU6IHN0cmluZztcbiAgbGFiZWw6IHN0cmluZztcbiAgc3RhdHVzOiBDaUJyYW5jaFN0YXR1cztcbn1bXTtcblxuZXhwb3J0IGNsYXNzIENpTW9kdWxlIGV4dGVuZHMgQmFzZU1vZHVsZTxDaURhdGE+IHtcbiAgb3ZlcnJpZGUgYXN5bmMgcmV0cmlldmVEYXRhKCkge1xuICAgIGNvbnN0IG5leHRCcmFuY2hOYW1lID0gZ2V0TmV4dEJyYW5jaE5hbWUodGhpcy5jb25maWcuZ2l0aHViKTtcbiAgICBjb25zdCByZXBvOiBSZWxlYXNlUmVwb1dpdGhBcGkgPSB7XG4gICAgICBhcGk6IHRoaXMuZ2l0LmdpdGh1YixcbiAgICAgIC4uLnRoaXMuZ2l0LnJlbW90ZUNvbmZpZyxcbiAgICAgIG5leHRCcmFuY2hOYW1lLFxuICAgIH07XG4gICAgY29uc3Qge2xhdGVzdCwgbmV4dCwgcmVsZWFzZUNhbmRpZGF0ZSwgZXhjZXB0aW9uYWxNaW5vcn0gPVxuICAgICAgYXdhaXQgQWN0aXZlUmVsZWFzZVRyYWlucy5mZXRjaChyZXBvKTtcbiAgICBjb25zdCBjaVJlc3VsdFByb21pc2VzID0gT2JqZWN0LmVudHJpZXMoe3JlbGVhc2VDYW5kaWRhdGUsIGV4Y2VwdGlvbmFsTWlub3IsIGxhdGVzdCwgbmV4dH0pLm1hcChcbiAgICAgIGFzeW5jIChbdHJhaW5OYW1lLCB0cmFpbl06IFtzdHJpbmcsIFJlbGVhc2VUcmFpbiB8IG51bGxdKSA9PiB7XG4gICAgICAgIGlmICh0cmFpbiA9PT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBhY3RpdmU6IGZhbHNlLFxuICAgICAgICAgICAgbmFtZTogdHJhaW5OYW1lLFxuICAgICAgICAgICAgbGFiZWw6ICcnLFxuICAgICAgICAgICAgc3RhdHVzOiBudWxsLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzdGF0dXMgPSAoXG4gICAgICAgICAgYXdhaXQgZ2l0aHViTWFjcm9zLmdldENvbWJpbmVkQ2hlY2tzQW5kU3RhdHVzZXNGb3JSZWYodGhpcy5naXQuZ2l0aHViLCB7XG4gICAgICAgICAgICAuLi50aGlzLmdpdC5yZW1vdGVQYXJhbXMsXG4gICAgICAgICAgICByZWY6IHRyYWluLmJyYW5jaE5hbWUsXG4gICAgICAgICAgfSlcbiAgICAgICAgKS5yZXN1bHQ7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBhY3RpdmU6IHRydWUsXG4gICAgICAgICAgbmFtZTogdHJhaW4uYnJhbmNoTmFtZSxcbiAgICAgICAgICBsYWJlbDogYCR7dHJhaW5OYW1lfSAoJHt0cmFpbi5icmFuY2hOYW1lfSlgLFxuICAgICAgICAgIHN0YXR1cyxcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHJldHVybiBhd2FpdCBQcm9taXNlLmFsbChjaVJlc3VsdFByb21pc2VzKTtcbiAgfVxuXG4gIG92ZXJyaWRlIGFzeW5jIHByaW50VG9UZXJtaW5hbCgpIHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5kYXRhO1xuICAgIGNvbnN0IG1pbkxhYmVsTGVuZ3RoID0gTWF0aC5tYXgoLi4uZGF0YS5tYXAoKHJlc3VsdCkgPT4gcmVzdWx0LmxhYmVsLmxlbmd0aCkpO1xuICAgIExvZy5pbmZvLmdyb3VwKGJvbGQoYENJYCkpO1xuICAgIGRhdGEuZm9yRWFjaCgocmVzdWx0KSA9PiB7XG4gICAgICBpZiAocmVzdWx0LmFjdGl2ZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgTG9nLmRlYnVnKGBObyBhY3RpdmUgcmVsZWFzZSB0cmFpbiBmb3IgJHtyZXN1bHQubmFtZX1gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgbGFiZWwgPSByZXN1bHQubGFiZWwucGFkRW5kKG1pbkxhYmVsTGVuZ3RoKTtcbiAgICAgIGlmIChyZXN1bHQuc3RhdHVzID09PSBudWxsKSB7XG4gICAgICAgIExvZy5pbmZvKGAke3Jlc3VsdC5uYW1lfSBicmFuY2ggd2FzIG5vdCBmb3VuZCBvbiBDSWApO1xuICAgICAgfSBlbHNlIGlmIChyZXN1bHQuc3RhdHVzID09PSAncGFzc2luZycpIHtcbiAgICAgICAgTG9nLmluZm8oYCR7bGFiZWx9ICR7Z3JlZW4oJ+KclCcpfWApO1xuICAgICAgfSBlbHNlIGlmIChyZXN1bHQuc3RhdHVzID09PSAncGVuZGluZycpIHtcbiAgICAgICAgTG9nLmluZm8oYCR7bGFiZWx9ICR7eWVsbG93KCfij7onKX1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIExvZy5pbmZvKGAke2xhYmVsfSAke3JlZCgn4pyYJyl9YCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgTG9nLmluZm8uZ3JvdXBFbmQoKTtcbiAgICBMb2cuaW5mbygpO1xuICB9XG59XG4iXX0=