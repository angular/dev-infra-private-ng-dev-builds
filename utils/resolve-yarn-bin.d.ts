export interface YarnConfiguration {
    'yarnPath': string | undefined;
    'yarn-path': string | undefined;
}
export type ConfigWithParser = {
    fileName: string;
    parse: (c: string) => YarnConfiguration;
};
export interface YarnCommandInfo {
    binary: string;
    args: string[];
    legacy?: boolean;
}
export declare const yarnConfigFiles: ConfigWithParser[];
export declare function resolveYarnScriptForProject(projectDir: string): Promise<YarnCommandInfo>;
export declare function getYarnPathFromNpmGlobalBinaries(): Promise<string | null>;
