export declare const localVersion = "0.0.0-5c5cdb966e905973cdc6d55a79a5944e73ae063b";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
