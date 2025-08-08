import { blue, bold, underline, Log } from '../../utils/logging.js';
import { fetchLongTermSupportBranchesFromNpm } from './long-term-support.js';
import { isVersionPublishedToNpm } from './npm-registry.js';
export async function printActiveReleaseTrains(active, config) {
    const { releaseCandidate, next, latest, exceptionalMinor } = active;
    const isNextPublishedToNpm = await isVersionPublishedToNpm(next.version, config);
    const nextTrainType = next.isMajor ? 'major' : 'minor';
    const ltsBranches = await fetchLongTermSupportBranchesFromNpm(config);
    Log.info();
    Log.info(blue('Current version branches in the project:'));
    if (exceptionalMinor !== null) {
        const version = exceptionalMinor.version;
        const exceptionalMinorPublished = await isVersionPublishedToNpm(version, config);
        const trainPhase = version.prerelease[0] === 'next' ? 'next' : 'release-candidate';
        const minorLabel = underline('exceptional minor');
        Log.info(` • ${bold(exceptionalMinor.branchName)} contains changes for an ${minorLabel} ` +
            `that is currently in ${bold(trainPhase)} phase.`);
        if (exceptionalMinorPublished) {
            Log.info(`   Most recent pre-release for this branch is "${bold(`v${version}`)}".`);
        }
        else {
            Log.info(`   Version is set to "${bold(`v${version}`)}", but has not been published yet.`);
        }
    }
    if (releaseCandidate !== null) {
        const rcVersion = releaseCandidate.version;
        const rcTrainType = releaseCandidate.isMajor ? 'major' : 'minor';
        const rcTrainPhase = rcVersion.prerelease[0] === 'next' ? 'feature-freeze' : 'release-candidate';
        Log.info(` • ${bold(releaseCandidate.branchName)} contains changes for an upcoming ` +
            `${rcTrainType} that is currently in ${bold(rcTrainPhase)} phase.`);
        Log.info(`   Most recent pre-release for this branch is "${bold(`v${rcVersion}`)}".`);
    }
    Log.info(` • ${bold(latest.branchName)} contains changes for the most recent patch.`);
    Log.info(`   Most recent patch version for this branch is "${bold(`v${latest.version}`)}".`);
    Log.info(` • ${bold(next.branchName)} contains changes for a ${nextTrainType} ` +
        `currently in active development.`);
    if (isNextPublishedToNpm) {
        Log.info(`   Most recent pre-release version for this branch is "${bold(`v${next.version}`)}".`);
    }
    else {
        Log.info(`   Version is currently set to "${bold(`v${next.version}`)}", but has not been ` +
            `published yet.`);
    }
    if (releaseCandidate === null) {
        Log.info(' • No release-candidate or feature-freeze branch currently active.');
    }
    Log.info();
    Log.info(blue('Current active LTS version branches:'));
    if (ltsBranches.active.length !== 0) {
        for (const ltsBranch of ltsBranches.active) {
            Log.info(` • ${bold(ltsBranch.name)} is currently in active long-term support phase.`);
            Log.info(`   Most recent patch version for this branch is "${bold(`v${ltsBranch.version}`)}".`);
        }
    }
    Log.info();
}
//# sourceMappingURL=print-active-trains.js.map