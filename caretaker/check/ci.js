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
//# sourceMappingURL=ci.js.map