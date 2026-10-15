export declare const localVersion = "0.0.0-fc3ee9120f89f16cd2aa7af75a6bc8434571c4f6";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
