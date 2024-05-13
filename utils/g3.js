/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import path from 'path';
import { Log } from './logging.js';
import { getGoogleSyncConfig } from './g3-sync-config.js';
export class G3Stats {
    static async retrieveDiffStats(git, config) {
        const syncMatchFns = await this.getG3SyncFileMatchFns(git, config);
        const latestSha = this.getLatestShas(git);
        if (syncMatchFns === null ||
            syncMatchFns.ngMatchFn === null ||
            syncMatchFns.separateMatchFn === null ||
            latestSha === null) {
            return;
        }
        return this.getDiffStats(git, latestSha.g3, latestSha.main, syncMatchFns);
    }
    /**
     * Get git diff stats between main and g3, for all files and filtered to only g3 affecting
     * files.
     */
    static getDiffStats(git, g3Ref, mainRef, syncMatchFns) {
        /** The diff stats to be returned. */
        const stats = {
            insertions: 0,
            deletions: 0,
            files: 0,
            separateFiles: 0,
            commits: 0,
        };
        // Determine the number of commits between main and g3 refs. */
        stats.commits = parseInt(git.run(['rev-list', '--count', `${g3Ref}..${mainRef}`]).stdout, 10);
        // Get the numstat information between main and g3
        const numStatDiff = git
            .run(['diff', `${g3Ref}...${mainRef}`, '--numstat'])
            .stdout // Remove the extra space after git's output.
            .trim();
        // If there is no diff, we can return early.
        if (numStatDiff === '') {
            return stats;
        }
        // Split each line of git output into array
        numStatDiff
            .split('\n')
            // Split each line from the git output into components parts: insertions,
            // deletions and file name respectively
            .map((line) => line.trim().split('\t'))
            // Parse number value from the insertions and deletions values
            // Example raw line input:
            //   10\t5\tsrc/file/name.ts
            .map((line) => [Number(line[0]), Number(line[1]), line[2]])
            // Add each line's value to the diff stats, and conditionally to the g3
            // stats as well if the file name is included in the files synced to g3.
            .forEach(([insertions, deletions, fileName]) => {
            if (syncMatchFns.ngMatchFn(fileName)) {
                stats.insertions += insertions;
                stats.deletions += deletions;
                stats.files += 1;
            }
            else if (syncMatchFns.separateMatchFn(fileName)) {
                stats.insertions += insertions;
                stats.deletions += deletions;
                stats.separateFiles += 1;
            }
        });
        return stats;
    }
    /** Fetch and retrieve the latest sha for a specific branch. */
    static getShaForBranchLatest(git, branch) {
        // With the --exit-code flag, if no match is found an exit code of 2 is returned by the command.
        if (git.runGraceful(['ls-remote', '--exit-code', git.getRepoGitUrl(), branch]).status === 2) {
            Log.debug(`No '${branch}' branch exists on upstream, skipping.`);
            return null;
        }
        // Retrieve the latest ref for the branch and return its sha.
        git.runGraceful(['fetch', '-q', git.getRepoGitUrl(), branch]);
        return git.runGraceful(['rev-parse', 'FETCH_HEAD']).stdout.trim();
    }
    static async getG3SyncFileMatchFns(git, configs) {
        debugger;
        if (configs.caretaker.g3SyncConfigPath === undefined) {
            Log.debug('No Google Sync configuration specified.');
            return null;
        }
        const configPath = path.join(git.baseDir, configs.caretaker.g3SyncConfigPath);
        const { ngMatchFn, separateMatchFn, config } = await getGoogleSyncConfig(configPath);
        if (config.syncedFilePatterns.length === 0) {
            Log.warn('Google Sync configuration does not specify any files being synced.');
        }
        return { ngMatchFn, separateMatchFn };
    }
    static getLatestShas(git) {
        /** The latest sha for the g3 branch. */
        const g3 = this.getShaForBranchLatest(git, 'g3');
        /** The latest sha for the main branch. */
        const main = this.getShaForBranchLatest(git, git.mainBranchName);
        if (g3 === null || main === null) {
            Log.debug(`Either the g3 or ${git.mainBranchName} was unable to be retrieved`);
            return null;
        }
        return { g3, main };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZzMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9uZy1kZXYvdXRpbHMvZzMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBQ3hCLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFFakMsT0FBTyxFQUFrQixtQkFBbUIsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBWXpFLE1BQU0sT0FBTyxPQUFPO0lBQ2xCLE1BQU0sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQzVCLEdBQTJCLEVBQzNCLE1BQTBEO1FBRTFELE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNuRSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRTFDLElBQ0UsWUFBWSxLQUFLLElBQUk7WUFDckIsWUFBWSxDQUFDLFNBQVMsS0FBSyxJQUFJO1lBQy9CLFlBQVksQ0FBQyxlQUFlLEtBQUssSUFBSTtZQUNyQyxTQUFTLEtBQUssSUFBSSxFQUNsQixDQUFDO1lBQ0QsT0FBTztRQUNULENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxFQUFFLEVBQUUsU0FBUyxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQztJQUM1RSxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLFlBQVksQ0FDakIsR0FBMkIsRUFDM0IsS0FBYSxFQUNiLE9BQWUsRUFDZixZQUE0RTtRQUU1RSxxQ0FBcUM7UUFDckMsTUFBTSxLQUFLLEdBQUc7WUFDWixVQUFVLEVBQUUsQ0FBQztZQUNiLFNBQVMsRUFBRSxDQUFDO1lBQ1osS0FBSyxFQUFFLENBQUM7WUFDUixhQUFhLEVBQUUsQ0FBQztZQUNoQixPQUFP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LENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7TG9nfSBmcm9tICcuL2xvZ2dpbmcuanMnO1xuaW1wb3J0IHtDYXJldGFrZXJDb25maWcsIEdpdGh1YkNvbmZpZ30gZnJvbSAnLi9jb25maWcuanMnO1xuaW1wb3J0IHtTeW5jRmlsZU1hdGNoRm4sIGdldEdvb2dsZVN5bmNDb25maWd9IGZyb20gJy4vZzMtc3luYy1jb25maWcuanMnO1xuaW1wb3J0IHtBdXRoZW50aWNhdGVkR2l0Q2xpZW50fSBmcm9tICcuL2dpdC9hdXRoZW50aWNhdGVkLWdpdC1jbGllbnQuanMnO1xuXG4vKiogSW5mb3JtYXRpb24gZXhwcmVzc2luZyB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIHRoZSBtYWluIGFuZCBnMyBicmFuY2hlcyAqL1xuZXhwb3J0IGludGVyZmFjZSBHM1N0YXRzRGF0YSB7XG4gIGluc2VydGlvbnM6IG51bWJlcjtcbiAgZGVsZXRpb25zOiBudW1iZXI7XG4gIGZpbGVzOiBudW1iZXI7XG4gIHNlcGFyYXRlRmlsZXM6IG51bWJlcjtcbiAgY29tbWl0czogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgRzNTdGF0cyB7XG4gIHN0YXRpYyBhc3luYyByZXRyaWV2ZURpZmZTdGF0cyhcbiAgICBnaXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4gICAgY29uZmlnOiB7Y2FyZXRha2VyOiBDYXJldGFrZXJDb25maWc7IGdpdGh1YjogR2l0aHViQ29uZmlnfSxcbiAgKTogUHJvbWlzZTxHM1N0YXRzRGF0YSB8IHVuZGVmaW5lZD4ge1xuICAgIGNvbnN0IHN5bmNNYXRjaEZucyA9IGF3YWl0IHRoaXMuZ2V0RzNTeW5jRmlsZU1hdGNoRm5zKGdpdCwgY29uZmlnKTtcbiAgICBjb25zdCBsYXRlc3RTaGEgPSB0aGlzLmdldExhdGVzdFNoYXMoZ2l0KTtcblxuICAgIGlmIChcbiAgICAgIHN5bmNNYXRjaEZucyA9PT0gbnVsbCB8fFxuICAgICAgc3luY01hdGNoRm5zLm5nTWF0Y2hGbiA9PT0gbnVsbCB8fFxuICAgICAgc3luY01hdGNoRm5zLnNlcGFyYXRlTWF0Y2hGbiA9PT0gbnVsbCB8fFxuICAgICAgbGF0ZXN0U2hhID09PSBudWxsXG4gICAgKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZ2V0RGlmZlN0YXRzKGdpdCwgbGF0ZXN0U2hhLmczLCBsYXRlc3RTaGEubWFpbiwgc3luY01hdGNoRm5zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgZ2l0IGRpZmYgc3RhdHMgYmV0d2VlbiBtYWluIGFuZCBnMywgZm9yIGFsbCBmaWxlcyBhbmQgZmlsdGVyZWQgdG8gb25seSBnMyBhZmZlY3RpbmdcbiAgICogZmlsZXMuXG4gICAqL1xuICBzdGF0aWMgZ2V0RGlmZlN0YXRzKFxuICAgIGdpdDogQXV0aGVudGljYXRlZEdpdENsaWVudCxcbiAgICBnM1JlZjogc3RyaW5nLFxuICAgIG1haW5SZWY6IHN0cmluZyxcbiAgICBzeW5jTWF0Y2hGbnM6IHtuZ01hdGNoRm46IFN5bmNGaWxlTWF0Y2hGbjsgc2VwYXJhdGVNYXRjaEZuOiBTeW5jRmlsZU1hdGNoRm59LFxuICApOiBHM1N0YXRzRGF0YSB7XG4gICAgLyoqIFRoZSBkaWZmIHN0YXRzIHRvIGJlIHJldHVybmVkLiAqL1xuICAgIGNvbnN0IHN0YXRzID0ge1xuICAgICAgaW5zZXJ0aW9uczogMCxcbiAgICAgIGRlbGV0aW9uczogMCxcbiAgICAgIGZpbGVzOiAwLFxuICAgICAgc2VwYXJhdGVGaWxlczogMCxcbiAgICAgIGNvbW1pdHM6IDAsXG4gICAgfTtcblxuICAgIC8vIERldGVybWluZSB0aGUgbnVtYmVyIG9mIGNvbW1pdHMgYmV0d2VlbiBtYWluIGFuZCBnMyByZWZzLiAqL1xuICAgIHN0YXRzLmNvbW1pdHMgPSBwYXJzZUludChnaXQucnVuKFsncmV2LWxpc3QnLCAnLS1jb3VudCcsIGAke2czUmVmfS4uJHttYWluUmVmfWBdKS5zdGRvdXQsIDEwKTtcblxuICAgIC8vIEdldCB0aGUgbnVtc3RhdCBpbmZvcm1hdGlvbiBiZXR3ZWVuIG1haW4gYW5kIGczXG4gICAgY29uc3QgbnVtU3RhdERpZmYgPSBnaXRcbiAgICAgIC5ydW4oWydkaWZmJywgYCR7ZzNSZWZ9Li4uJHttYWluUmVmfWAsICctLW51bXN0YXQnXSlcbiAgICAgIC5zdGRvdXQgLy8gUmVtb3ZlIHRoZSBleHRyYSBzcGFjZSBhZnRlciBnaXQncyBvdXRwdXQuXG4gICAgICAudHJpbSgpO1xuXG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gZGlmZiwgd2UgY2FuIHJldHVybiBlYXJseS5cbiAgICBpZiAobnVtU3RhdERpZmYgPT09ICcnKSB7XG4gICAgICByZXR1cm4gc3RhdHM7XG4gICAgfVxuXG4gICAgLy8gU3BsaXQgZWFjaCBsaW5lIG9mIGdpdCBvdXRwdXQgaW50byBhcnJheVxuICAgIG51bVN0YXREaWZmXG4gICAgICAuc3BsaXQoJ1xcbicpXG4gICAgICAvLyBTcGxpdCBlYWNoIGxpbmUgZnJvbSB0aGUgZ2l0IG91dHB1dCBpbnRvIGNvbXBvbmVudHMgcGFydHM6IGluc2VydGlvbnMsXG4gICAgICAvLyBkZWxldGlvbnMgYW5kIGZpbGUgbmFtZSByZXNwZWN0aXZlbHlcbiAgICAgIC5tYXAoKGxpbmUpID0+IGxpbmUudHJpbSgpLnNwbGl0KCdcXHQnKSlcbiAgICAgIC8vIFBhcnNlIG51bWJlciB2YWx1ZSBmcm9tIHRoZSBpbnNlcnRpb25zIGFuZCBkZWxldGlvbnMgdmFsdWVzXG4gICAgICAvLyBFeGFtcGxlIHJhdyBsaW5lIGlucHV0OlxuICAgICAgLy8gICAxMFxcdDVcXHRzcmMvZmlsZS9uYW1lLnRzXG4gICAgICAubWFwKChsaW5lKSA9PiBbTnVtYmVyKGxpbmVbMF0pLCBOdW1iZXIobGluZVsxXSksIGxpbmVbMl1dIGFzIFtudW1iZXIsIG51bWJlciwgc3RyaW5nXSlcbiAgICAgIC8vIEFkZCBlYWNoIGxpbmUncyB2YWx1ZSB0byB0aGUgZGlmZiBzdGF0cywgYW5kIGNvbmRpdGlvbmFsbHkgdG8gdGhlIGczXG4gICAgICAvLyBzdGF0cyBhcyB3ZWxsIGlmIHRoZSBmaWxlIG5hbWUgaXMgaW5jbHVkZWQgaW4gdGhlIGZpbGVzIHN5bmNlZCB0byBnMy5cbiAgICAgIC5mb3JFYWNoKChbaW5zZXJ0aW9ucywgZGVsZXRpb25zLCBmaWxlTmFtZV0pID0+IHtcbiAgICAgICAgaWYgKHN5bmNNYXRjaEZucy5uZ01hdGNoRm4oZmlsZU5hbWUpKSB7XG4gICAgICAgICAgc3RhdHMuaW5zZXJ0aW9ucyArPSBpbnNlcnRpb25zO1xuICAgICAgICAgIHN0YXRzLmRlbGV0aW9ucyArPSBkZWxldGlvbnM7XG4gICAgICAgICAgc3RhdHMuZmlsZXMgKz0gMTtcbiAgICAgICAgfSBlbHNlIGlmIChzeW5jTWF0Y2hGbnMuc2VwYXJhdGVNYXRjaEZuKGZpbGVOYW1lKSkge1xuICAgICAgICAgIHN0YXRzLmluc2VydGlvbnMgKz0gaW5zZXJ0aW9ucztcbiAgICAgICAgICBzdGF0cy5kZWxldGlvbnMgKz0gZGVsZXRpb25zO1xuICAgICAgICAgIHN0YXRzLnNlcGFyYXRlRmlsZXMgKz0gMTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cblxuICAvKiogRmV0Y2ggYW5kIHJldHJpZXZlIHRoZSBsYXRlc3Qgc2hhIGZvciBhIHNwZWNpZmljIGJyYW5jaC4gKi9cbiAgc3RhdGljIGdldFNoYUZvckJyYW5jaExhdGVzdChnaXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsIGJyYW5jaDogc3RyaW5nKSB7XG4gICAgLy8gV2l0aCB0aGUgLS1leGl0LWNvZGUgZmxhZywgaWYgbm8gbWF0Y2ggaXMgZm91bmQgYW4gZXhpdCBjb2RlIG9mIDIgaXMgcmV0dXJuZWQgYnkgdGhlIGNvbW1hbmQuXG4gICAgaWYgKGdpdC5ydW5HcmFjZWZ1bChbJ2xzLXJlbW90ZScsICctLWV4aXQtY29kZScsIGdpdC5nZXRSZXBvR2l0VXJsKCksIGJyYW5jaF0pLnN0YXR1cyA9PT0gMikge1xuICAgICAgTG9nLmRlYnVnKGBObyAnJHticmFuY2h9JyBicmFuY2ggZXhpc3RzIG9uIHVwc3RyZWFtLCBza2lwcGluZy5gKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIFJldHJpZXZlIHRoZSBsYXRlc3QgcmVmIGZvciB0aGUgYnJhbmNoIGFuZCByZXR1cm4gaXRzIHNoYS5cbiAgICBnaXQucnVuR3JhY2VmdWwoWydmZXRjaCcsICctcScsIGdpdC5nZXRSZXBvR2l0VXJsKCksIGJyYW5jaF0pO1xuICAgIHJldHVybiBnaXQucnVuR3JhY2VmdWwoWydyZXYtcGFyc2UnLCAnRkVUQ0hfSEVBRCddKS5zdGRvdXQudHJpbSgpO1xuICB9XG5cbiAgc3RhdGljIGFzeW5jIGdldEczU3luY0ZpbGVNYXRjaEZucyhcbiAgICBnaXQ6IEF1dGhlbnRpY2F0ZWRHaXRDbGllbnQsXG4gICAgY29uZmlnczoge2NhcmV0YWtlcjogQ2FyZXRha2VyQ29uZmlnOyBnaXRodWI6IEdpdGh1YkNvbmZpZ30sXG4gICk6IFByb21pc2U8bnVsbCB8IHtcbiAgICBuZ01hdGNoRm46IFN5bmNGaWxlTWF0Y2hGbjtcbiAgICBzZXBhcmF0ZU1hdGNoRm46IFN5bmNGaWxlTWF0Y2hGbjtcbiAgfT4ge1xuICAgIGRlYnVnZ2VyO1xuICAgIGlmIChjb25maWdzLmNhcmV0YWtlci5nM1N5bmNDb25maWdQYXRoID09PSB1bmRlZmluZWQpIHtcbiAgICAgIExvZy5kZWJ1ZygnTm8gR29vZ2xlIFN5bmMgY29uZmlndXJhdGlvbiBzcGVjaWZpZWQuJyk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBjb25maWdQYXRoID0gcGF0aC5qb2luKGdpdC5iYXNlRGlyLCBjb25maWdzLmNhcmV0YWtlci5nM1N5bmNDb25maWdQYXRoKTtcbiAgICBjb25zdCB7bmdNYXRjaEZuLCBzZXBhcmF0ZU1hdGNoRm4sIGNvbmZpZ30gPSBhd2FpdCBnZXRHb29nbGVTeW5jQ29uZmlnKGNvbmZpZ1BhdGgpO1xuICAgIGlmIChjb25maWcuc3luY2VkRmlsZVBhdHRlcm5zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgTG9nLndhcm4oJ0dvb2dsZSBTeW5jIGNvbmZpZ3VyYXRpb24gZG9lcyBub3Qgc3BlY2lmeSBhbnkgZmlsZXMgYmVpbmcgc3luY2VkLicpO1xuICAgIH1cbiAgICByZXR1cm4ge25nTWF0Y2hGbiwgc2VwYXJhdGVNYXRjaEZufTtcbiAgfVxuXG4gIHN0YXRpYyBnZXRMYXRlc3RTaGFzKGdpdDogQXV0aGVudGljYXRlZEdpdENsaWVudCkge1xuICAgIC8qKiBUaGUgbGF0ZXN0IHNoYSBmb3IgdGhlIGczIGJyYW5jaC4gKi9cbiAgICBjb25zdCBnMyA9IHRoaXMuZ2V0U2hhRm9yQnJhbmNoTGF0ZXN0KGdpdCwgJ2czJyk7XG4gICAgLyoqIFRoZSBsYXRlc3Qgc2hhIGZvciB0aGUgbWFpbiBicmFuY2guICovXG4gICAgY29uc3QgbWFpbiA9IHRoaXMuZ2V0U2hhRm9yQnJhbmNoTGF0ZXN0KGdpdCwgZ2l0Lm1haW5CcmFuY2hOYW1lKTtcblxuICAgIGlmIChnMyA9PT0gbnVsbCB8fCBtYWluID09PSBudWxsKSB7XG4gICAgICBMb2cuZGVidWcoYEVpdGhlciB0aGUgZzMgb3IgJHtnaXQubWFpbkJyYW5jaE5hbWV9IHdhcyB1bmFibGUgdG8gYmUgcmV0cmlldmVkYCk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4ge2czLCBtYWlufTtcbiAgfVxufVxuIl19