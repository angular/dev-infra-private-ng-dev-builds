export declare const localVersion = "0.0.0-438f31efd5c7e1267eaadb4636f7ec0a6c1a088f";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
