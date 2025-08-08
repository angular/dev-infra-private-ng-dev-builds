import semver from 'semver';
import { CommandModule } from 'yargs';
export interface Options {
    from: string;
    to: string;
    prependToChangelog: boolean;
    releaseVersion: semver.SemVer;
    type: 'github-release' | 'changelog';
}
export declare const ReleaseNotesCommandModule: CommandModule<{}, Options>;
