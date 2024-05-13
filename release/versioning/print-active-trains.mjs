/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { blue, bold, underline, Log } from '../../utils/logging.js';
import { fetchLongTermSupportBranchesFromNpm } from './long-term-support.js';
import { isVersionPublishedToNpm } from './npm-registry.js';
/**
 * Prints the active release trains to the console.
 * @params active Active release trains that should be printed.
 * @params config Release configuration used for querying NPM on published versions.
 */
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
        // An exceptional minor may not be published yet. e.g. when we branch off there
        // will not be a release immediately.
        if (exceptionalMinorPublished) {
            Log.info(`   Most recent pre-release for this branch is "${bold(`v${version}`)}".`);
        }
        else {
            Log.info(`   Version is set to "${bold(`v${version}`)}", but has not been published yet.`);
        }
    }
    // Print information for release trains in the feature-freeze/release-candidate phase.
    if (releaseCandidate !== null) {
        const rcVersion = releaseCandidate.version;
        const rcTrainType = releaseCandidate.isMajor ? 'major' : 'minor';
        const rcTrainPhase = rcVersion.prerelease[0] === 'next' ? 'feature-freeze' : 'release-candidate';
        Log.info(` • ${bold(releaseCandidate.branchName)} contains changes for an upcoming ` +
            `${rcTrainType} that is currently in ${bold(rcTrainPhase)} phase.`);
        Log.info(`   Most recent pre-release for this branch is "${bold(`v${rcVersion}`)}".`);
    }
    // Print information about the release-train in the latest phase. i.e. the patch branch.
    Log.info(` • ${bold(latest.branchName)} contains changes for the most recent patch.`);
    Log.info(`   Most recent patch version for this branch is "${bold(`v${latest.version}`)}".`);
    // Print information about the release-train in the next phase.
    Log.info(` • ${bold(next.branchName)} contains changes for a ${nextTrainType} ` +
        `currently in active development.`);
    // Note that there is a special case for versions in the next release-train. The version in
    // the next branch is not always published to NPM. This can happen when we recently branched
    // off for a feature-freeze release-train. More details are in the next pre-release action.
    if (isNextPublishedToNpm) {
        Log.info(`   Most recent pre-release version for this branch is "${bold(`v${next.version}`)}".`);
    }
    else {
        Log.info(`   Version is currently set to "${bold(`v${next.version}`)}", but has not been ` +
            `published yet.`);
    }
    // If no release-train in release-candidate or feature-freeze phase is active,
    // we print a message as last bullet point to make this clear.
    if (releaseCandidate === null) {
        Log.info(' • No release-candidate or feature-freeze branch currently active.');
    }
    Log.info();
    Log.info(blue('Current active LTS version branches:'));
    // Print all active LTS branches (each branch as own bullet point).
    if (ltsBranches.active.length !== 0) {
        for (const ltsBranch of ltsBranches.active) {
            Log.info(` • ${bold(ltsBranch.name)} is currently in active long-term support phase.`);
            Log.info(`   Most recent patch version for this branch is "${bold(`v${ltsBranch.version}`)}".`);
        }
    }
    Log.info();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJpbnQtYWN0aXZlLXRyYWlucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9yZWxlYXNlL3ZlcnNpb25pbmcvcHJpbnQtYWN0aXZlLXRyYWlucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFJbEUsT0FBTyxFQUFDLG1DQUFtQyxFQUFDLE1BQU0sd0JBQXdCLENBQUM7QUFDM0UsT0FBTyxFQUFDLHVCQUF1QixFQUFDLE1BQU0sbUJBQW1CLENBQUM7QUFFMUQ7Ozs7R0FJRztBQUNILE1BQU0sQ0FBQyxLQUFLLFVBQVUsd0JBQXdCLENBQzVDLE1BQTJCLEVBQzNCLE1BQXFCO0lBRXJCLE1BQU0sRUFBQyxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLGdCQUFnQixFQUFDLEdBQUcsTUFBTSxDQUFDO0lBQ2xFLE1BQU0sb0JBQW9CLEdBQUcsTUFBTSx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ2pGLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO0lBQ3ZELE1BQU0sV0FBVyxHQUFHLE1BQU0sbUNBQW1DLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFdEUsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ1gsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsMENBQTBDLENBQUMsQ0FBQyxDQUFDO0lBRTNELElBQUksZ0JBQWdCLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDOUIsTUFBTSxPQUFPLEdBQUcsZ0JBQWdCLENBQUMsT0FBTyxDQUFDO1FBQ3pDLE1BQU0seUJBQXlCLEdBQUcsTUFBTSx1QkFBdUIs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QUNYLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHNDQUFzQyxDQUFDLENBQUMsQ0FBQztJQUV2RCxtRUFBbUU7SUFDbkUsSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUNwQyxLQUFLLE1BQU0sU0FBUyxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUMzQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsa0RBQWtELENBQUMsQ0FBQztZQUN2RixHQUFHLENBQUMsSUFBSSxDQUNOLG9EQUFvRCxJQUFJLENBQUMsSUFBSSxTQUFTLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUN0RixDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7SUFFRCxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDYixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Ymx1ZSwgYm9sZCwgdW5kZXJsaW5lLCBMb2d9IGZyb20gJy4uLy4uL3V0aWxzL2xvZ2dpbmcuanMnO1xuaW1wb3J0IHtSZWxlYXNlQ29uZmlnfSBmcm9tICcuLi9jb25maWcvaW5kZXguanMnO1xuXG5pbXBvcnQge0FjdGl2ZVJlbGVhc2VUcmFpbnN9IGZyb20gJy4vYWN0aXZlLXJlbGVhc2UtdHJhaW5zLmpzJztcbmltcG9ydCB7ZmV0Y2hMb25nVGVybVN1cHBvcnRCcmFuY2hlc0Zyb21OcG19IGZyb20gJy4vbG9uZy10ZXJtLXN1cHBvcnQuanMnO1xuaW1wb3J0IHtpc1ZlcnNpb25QdWJsaXNoZWRUb05wbX0gZnJvbSAnLi9ucG0tcmVnaXN0cnkuanMnO1xuXG4vKipcbiAqIFByaW50cyB0aGUgYWN0aXZlIHJlbGVhc2UgdHJhaW5zIHRvIHRoZSBjb25zb2xlLlxuICogQHBhcmFtcyBhY3RpdmUgQWN0aXZlIHJlbGVhc2UgdHJhaW5zIHRoYXQgc2hvdWxkIGJlIHByaW50ZWQuXG4gKiBAcGFyYW1zIGNvbmZpZyBSZWxlYXNlIGNvbmZpZ3VyYXRpb24gdXNlZCBmb3IgcXVlcnlpbmcgTlBNIG9uIHB1Ymxpc2hlZCB2ZXJzaW9ucy5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHByaW50QWN0aXZlUmVsZWFzZVRyYWlucyhcbiAgYWN0aXZlOiBBY3RpdmVSZWxlYXNlVHJhaW5zLFxuICBjb25maWc6IFJlbGVhc2VDb25maWcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qge3JlbGVhc2VDYW5kaWRhdGUsIG5leHQsIGxhdGVzdCwgZXhjZXB0aW9uYWxNaW5vcn0gPSBhY3RpdmU7XG4gIGNvbnN0IGlzTmV4dFB1Ymxpc2hlZFRvTnBtID0gYXdhaXQgaXNWZXJzaW9uUHVibGlzaGVkVG9OcG0obmV4dC52ZXJzaW9uLCBjb25maWcpO1xuICBjb25zdCBuZXh0VHJhaW5UeXBlID0gbmV4dC5pc01ham9yID8gJ21ham9yJyA6ICdtaW5vcic7XG4gIGNvbnN0IGx0c0JyYW5jaGVzID0gYXdhaXQgZmV0Y2hMb25nVGVybVN1cHBvcnRCcmFuY2hlc0Zyb21OcG0oY29uZmlnKTtcblxuICBMb2cuaW5mbygpO1xuICBMb2cuaW5mbyhibHVlKCdDdXJyZW50IHZlcnNpb24gYnJhbmNoZXMgaW4gdGhlIHByb2plY3Q6JykpO1xuXG4gIGlmIChleGNlcHRpb25hbE1pbm9yICE9PSBudWxsKSB7XG4gICAgY29uc3QgdmVyc2lvbiA9IGV4Y2VwdGlvbmFsTWlub3IudmVyc2lvbjtcbiAgICBjb25zdCBleGNlcHRpb25hbE1pbm9yUHVibGlzaGVkID0gYXdhaXQgaXNWZXJzaW9uUHVibGlzaGVkVG9OcG0odmVyc2lvbiwgY29uZmlnKTtcbiAgICBjb25zdCB0cmFpblBoYXNlID0gdmVyc2lvbi5wcmVyZWxlYXNlWzBdID09PSAnbmV4dCcgPyAnbmV4dCcgOiAncmVsZWFzZS1jYW5kaWRhdGUnO1xuICAgIGNvbnN0IG1pbm9yTGFiZWwgPSB1bmRlcmxpbmUoJ2V4Y2VwdGlvbmFsIG1pbm9yJyk7XG5cbiAgICBMb2cuaW5mbyhcbiAgICAgIGAg4oCiICR7Ym9sZChleGNlcHRpb25hbE1pbm9yLmJyYW5jaE5hbWUpfSBjb250YWlucyBjaGFuZ2VzIGZvciBhbiAke21pbm9yTGFiZWx9IGAgK1xuICAgICAgICBgdGhhdCBpcyBjdXJyZW50bHkgaW4gJHtib2xkKHRyYWluUGhhc2UpfSBwaGFzZS5gLFxuICAgICk7XG4gICAgLy8gQW4gZXhjZXB0aW9uYWwgbWlub3IgbWF5IG5vdCBiZSBwdWJsaXNoZWQgeWV0LiBlLmcuIHdoZW4gd2UgYnJhbmNoIG9mZiB0aGVyZVxuICAgIC8vIHdpbGwgbm90IGJlIGEgcmVsZWFzZSBpbW1lZGlhdGVseS5cbiAgICBpZiAoZXhjZXB0aW9uYWxNaW5vclB1Ymxpc2hlZCkge1xuICAgICAgTG9nLmluZm8oYCAgIE1vc3QgcmVjZW50IHByZS1yZWxlYXNlIGZvciB0aGlzIGJyYW5jaCBpcyBcIiR7Ym9sZChgdiR7dmVyc2lvbn1gKX1cIi5gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgTG9nLmluZm8oYCAgIFZlcnNpb24gaXMgc2V0IHRvIFwiJHtib2xkKGB2JHt2ZXJzaW9ufWApfVwiLCBidXQgaGFzIG5vdCBiZWVuIHB1Ymxpc2hlZCB5ZXQuYCk7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJpbnQgaW5mb3JtYXRpb24gZm9yIHJlbGVhc2UgdHJhaW5zIGluIHRoZSBmZWF0dXJlLWZyZWV6ZS9yZWxlYXNlLWNhbmRpZGF0ZSBwaGFzZS5cbiAgaWYgKHJlbGVhc2VDYW5kaWRhdGUgIT09IG51bGwpIHtcbiAgICBjb25zdCByY1ZlcnNpb24gPSByZWxlYXNlQ2FuZGlkYXRlLnZlcnNpb247XG4gICAgY29uc3QgcmNUcmFpblR5cGUgPSByZWxlYXNlQ2FuZGlkYXRlLmlzTWFqb3IgPyAnbWFqb3InIDogJ21pbm9yJztcbiAgICBjb25zdCByY1RyYWluUGhhc2UgPVxuICAgICAgcmNWZXJzaW9uLnByZXJlbGVhc2VbMF0gPT09ICduZXh0JyA/ICdmZWF0dXJlLWZyZWV6ZScgOiAncmVsZWFzZS1jYW5kaWRhdGUnO1xuICAgIExvZy5pbmZvKFxuICAgICAgYCDigKIgJHtib2xkKHJlbGVhc2VDYW5kaWRhdGUuYnJhbmNoTmFtZSl9IGNvbnRhaW5zIGNoYW5nZXMgZm9yIGFuIHVwY29taW5nIGAgK1xuICAgICAgICBgJHtyY1RyYWluVHlwZX0gdGhhdCBpcyBjdXJyZW50bHkgaW4gJHtib2xkKHJjVHJhaW5QaGFzZSl9IHBoYXNlLmAsXG4gICAgKTtcbiAgICBMb2cuaW5mbyhgICAgTW9zdCByZWNlbnQgcHJlLXJlbGVhc2UgZm9yIHRoaXMgYnJhbmNoIGlzIFwiJHtib2xkKGB2JHtyY1ZlcnNpb259YCl9XCIuYCk7XG4gIH1cblxuICAvLyBQcmludCBpbmZvcm1hdGlvbiBhYm91dCB0aGUgcmVsZWFzZS10cmFpbiBpbiB0aGUgbGF0ZXN0IHBoYXNlLiBpLmUuIHRoZSBwYXRjaCBicmFuY2guXG4gIExvZy5pbmZvKGAg4oCiICR7Ym9sZChsYXRlc3QuYnJhbmNoTmFtZSl9IGNvbnRhaW5zIGNoYW5nZXMgZm9yIHRoZSBtb3N0IHJlY2VudCBwYXRjaC5gKTtcbiAgTG9nLmluZm8oYCAgIE1vc3QgcmVjZW50IHBhdGNoIHZlcnNpb24gZm9yIHRoaXMgYnJhbmNoIGlzIFwiJHtib2xkKGB2JHtsYXRlc3QudmVyc2lvbn1gKX1cIi5gKTtcblxuICAvLyBQcmludCBpbmZvcm1hdGlvbiBhYm91dCB0aGUgcmVsZWFzZS10cmFpbiBpbiB0aGUgbmV4dCBwaGFzZS5cbiAgTG9nLmluZm8oXG4gICAgYCDigKIgJHtib2xkKG5leHQuYnJhbmNoTmFtZSl9IGNvbnRhaW5zIGNoYW5nZXMgZm9yIGEgJHtuZXh0VHJhaW5UeXBlfSBgICtcbiAgICAgIGBjdXJyZW50bHkgaW4gYWN0aXZlIGRldmVsb3BtZW50LmAsXG4gICk7XG4gIC8vIE5vdGUgdGhhdCB0aGVyZSBpcyBhIHNwZWNpYWwgY2FzZSBmb3IgdmVyc2lvbnMgaW4gdGhlIG5leHQgcmVsZWFzZS10cmFpbi4gVGhlIHZlcnNpb24gaW5cbiAgLy8gdGhlIG5leHQgYnJhbmNoIGlzIG5vdCBhbHdheXMgcHVibGlzaGVkIHRvIE5QTS4gVGhpcyBjYW4gaGFwcGVuIHdoZW4gd2UgcmVjZW50bHkgYnJhbmNoZWRcbiAgLy8gb2ZmIGZvciBhIGZlYXR1cmUtZnJlZXplIHJlbGVhc2UtdHJhaW4uIE1vcmUgZGV0YWlscyBhcmUgaW4gdGhlIG5leHQgcHJlLXJlbGVhc2UgYWN0aW9uLlxuICBpZiAoaXNOZXh0UHVibGlzaGVkVG9OcG0pIHtcbiAgICBMb2cuaW5mbyhcbiAgICAgIGAgICBNb3N0IHJlY2VudCBwcmUtcmVsZWFzZSB2ZXJzaW9uIGZvciB0aGlzIGJyYW5jaCBpcyBcIiR7Ym9sZChgdiR7bmV4dC52ZXJzaW9ufWApfVwiLmAsXG4gICAgKTtcbiAgfSBlbHNlIHtcbiAgICBMb2cuaW5mbyhcbiAgICAgIGAgICBWZXJzaW9uIGlzIGN1cnJlbnRseSBzZXQgdG8gXCIke2JvbGQoYHYke25leHQudmVyc2lvbn1gKX1cIiwgYnV0IGhhcyBub3QgYmVlbiBgICtcbiAgICAgICAgYHB1Ymxpc2hlZCB5ZXQuYCxcbiAgICApO1xuICB9XG5cbiAgLy8gSWYgbm8gcmVsZWFzZS10cmFpbiBpbiByZWxlYXNlLWNhbmRpZGF0ZSBvciBmZWF0dXJlLWZyZWV6ZSBwaGFzZSBpcyBhY3RpdmUsXG4gIC8vIHdlIHByaW50IGEgbWVzc2FnZSBhcyBsYXN0IGJ1bGxldCBwb2ludCB0byBtYWtlIHRoaXMgY2xlYXIuXG4gIGlmIChyZWxlYXNlQ2FuZGlkYXRlID09PSBudWxsKSB7XG4gICAgTG9nLmluZm8oJyDigKIgTm8gcmVsZWFzZS1jYW5kaWRhdGUgb3IgZmVhdHVyZS1mcmVlemUgYnJhbmNoIGN1cnJlbnRseSBhY3RpdmUuJyk7XG4gIH1cblxuICBMb2cuaW5mbygpO1xuICBMb2cuaW5mbyhibHVlKCdDdXJyZW50IGFjdGl2ZSBMVFMgdmVyc2lvbiBicmFuY2hlczonKSk7XG5cbiAgLy8gUHJpbnQgYWxsIGFjdGl2ZSBMVFMgYnJhbmNoZXMgKGVhY2ggYnJhbmNoIGFzIG93biBidWxsZXQgcG9pbnQpLlxuICBpZiAobHRzQnJhbmNoZXMuYWN0aXZlLmxlbmd0aCAhPT0gMCkge1xuICAgIGZvciAoY29uc3QgbHRzQnJhbmNoIG9mIGx0c0JyYW5jaGVzLmFjdGl2ZSkge1xuICAgICAgTG9nLmluZm8oYCDigKIgJHtib2xkKGx0c0JyYW5jaC5uYW1lKX0gaXMgY3VycmVudGx5IGluIGFjdGl2ZSBsb25nLXRlcm0gc3VwcG9ydCBwaGFzZS5gKTtcbiAgICAgIExvZy5pbmZvKFxuICAgICAgICBgICAgTW9zdCByZWNlbnQgcGF0Y2ggdmVyc2lvbiBmb3IgdGhpcyBicmFuY2ggaXMgXCIke2JvbGQoYHYke2x0c0JyYW5jaC52ZXJzaW9ufWApfVwiLmAsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIExvZy5pbmZvKCk7XG59XG4iXX0=