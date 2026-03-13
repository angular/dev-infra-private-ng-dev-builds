export interface PackageJson {
    engines?: {
        pnpm?: string;
        node?: string;
    };
    dependencies?: {
        typescript?: string;
    };
    devDependencies?: {
        typescript?: string;
    };
}
export declare function syncPnpm(content: string, version: string): Promise<string>;
export declare function syncTypeScript(content: string, version: string): Promise<string>;
export declare function syncNodeJs(content: string, nvmrcVersion: string | undefined): Promise<string>;
