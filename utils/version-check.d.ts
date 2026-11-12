export declare const localVersion = "0.0.0-2bc6a148e1adcc70e9ce68d0eb26d052a4890b42";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
