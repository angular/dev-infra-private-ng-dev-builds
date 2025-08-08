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
    static getDiffStats(git, g3Ref, mainRef, syncMatchFns) {
        const stats = {
            insertions: 0,
            deletions: 0,
            files: 0,
            separateFiles: 0,
            commits: 0,
        };
        stats.commits = parseInt(git.run(['rev-list', '--count', `${g3Ref}..${mainRef}`]).stdout, 10);
        const numStatDiff = git
            .run(['diff', `${g3Ref}...${mainRef}`, '--numstat'])
            .stdout
            .trim();
        if (numStatDiff === '') {
            return stats;
        }
        numStatDiff
            .split('\n')
            .map((line) => line.trim().split('\t'))
            .map((line) => [Number(line[0]), Number(line[1]), line[2]])
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
    static getShaForBranchLatest(git, branch) {
        if (git.runGraceful(['ls-remote', '--exit-code', git.getRepoGitUrl(), branch]).status === 2) {
            Log.debug(`No '${branch}' branch exists on upstream, skipping.`);
            return null;
        }
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
        const g3 = this.getShaForBranchLatest(git, 'g3');
        const main = this.getShaForBranchLatest(git, git.mainBranchName);
        if (g3 === null || main === null) {
            Log.debug(`Either the g3 or ${git.mainBranchName} was unable to be retrieved`);
            return null;
        }
        return { g3, main };
    }
}
//# sourceMappingURL=g3.js.map