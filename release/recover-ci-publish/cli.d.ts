import { CommandModule } from 'yargs';
export interface ReleaseRecoverCiPublishOptions {
    runId: number;
    dryRun: boolean;
    publishRegistry: string | undefined;
}
export declare const ReleaseRecoverCiPublishCommandModule: CommandModule<{}, ReleaseRecoverCiPublishOptions>;
