export declare const localVersion = "0.0.0-2e1b5f749c2315fe8bab7b2630b46b2cee7c82db";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
