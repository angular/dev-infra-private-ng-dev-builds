import { CommandModule } from 'yargs';
export interface ReleasePublishCiOptions {
    builtPackagesDir: string;
    expectedSha: string;
    dryRun?: boolean;
}
export declare const ReleasePublishCiCommandModule: CommandModule<{}, ReleasePublishCiOptions>;
