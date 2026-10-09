export declare const localVersion = "0.0.0-9cfc822cc3dd2004d1918aed9da74bf4011346fa";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
