import { CommandModule } from 'yargs';
import { ReleaseToolFlags } from './index.js';
export interface ReleasePublishOptions extends ReleaseToolFlags {
}
export declare const ReleasePublishCommandModule: CommandModule<{}, ReleasePublishOptions>;
