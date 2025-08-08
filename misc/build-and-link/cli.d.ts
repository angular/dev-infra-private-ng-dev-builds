import { CommandModule } from 'yargs';
export interface BuildAndLinkOptions {
    projectRoot: string;
}
export declare const BuildAndLinkCommandModule: CommandModule<{}, BuildAndLinkOptions>;
