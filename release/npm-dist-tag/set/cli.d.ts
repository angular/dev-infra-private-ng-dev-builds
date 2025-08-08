import { CommandModule } from 'yargs';
export interface ReleaseNpmDistTagSetOptions {
    tagName: string;
    targetVersion: string;
    skipExperimentalPackages: boolean;
}
export declare const ReleaseNpmDistTagSetCommand: CommandModule<{}, ReleaseNpmDistTagSetOptions>;
