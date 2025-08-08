export declare class PnpmVersioning {
    isUsingPnpm(repoPath: string): Promise<boolean>;
    getPackageSpec(repoPath: string): Promise<string>;
}
