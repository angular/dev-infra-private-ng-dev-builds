export declare const localVersion = "0.0.0-5708c4df037871bab3ce15d27e020dbdbe9fe0fc";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
