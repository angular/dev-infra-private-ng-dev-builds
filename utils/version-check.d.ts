export declare const localVersion = "0.0.0-4d49b0c20fe119594533194ee3f1cb8995f94b3a";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
