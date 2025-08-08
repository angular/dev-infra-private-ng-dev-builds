import { CommandModule } from 'yargs';
export interface ReleaseNpmDistTagDeleteOptions {
    tagName: string;
}
export declare const ReleaseNpmDistTagDeleteCommand: CommandModule<{}, ReleaseNpmDistTagDeleteOptions>;
