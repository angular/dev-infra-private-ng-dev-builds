import semver from 'semver';
import { Log } from '../../utils/logging.js';
import { ReleaseNotes } from './release-notes.js';
import { GitClient } from '../../utils/git/git-client.js';
function builder(argv) {
    return argv
        .option('releaseVersion', {
        type: 'string',
        default: '0.0.0',
        coerce: (version) => new semver.SemVer(version),
    })
        .option('from', {
        type: 'string',
        description: 'The git tag or ref to start the changelog entry from',
        demandOption: true,
    })
        .option('to', {
        type: 'string',
        description: 'The git tag or ref to end the changelog entry with',
        default: 'HEAD',
    })
        .option('type', {
        type: 'string',
        description: 'The type of release notes to create',
        choices: ['github-release', 'changelog'],
        default: 'changelog',
    })
        .option('prependToChangelog', {
        type: 'boolean',
        default: false,
        description: 'Whether to update the changelog with the newly created entry',
    });
}
async function handler({ releaseVersion, from, to, prependToChangelog, type }) {
    const git = await GitClient.get();
    const releaseNotes = await ReleaseNotes.forRange(git, releaseVersion, from, to);
    if (prependToChangelog) {
        await releaseNotes.prependEntryToChangelogFile();
        Log.info(`Added release notes for "${releaseVersion}" to the changelog`);
        return;
    }
    const releaseNotesEntry = type === 'changelog'
        ? await releaseNotes.getChangelogEntry()
        : await releaseNotes.getGithubReleaseEntry();
    process.stdout.write(releaseNotesEntry);
}
export const ReleaseNotesCommandModule = {
    builder,
    handler,
    command: 'notes',
    describe: 'Generate release notes',
};
//# sourceMappingURL=cli.js.map