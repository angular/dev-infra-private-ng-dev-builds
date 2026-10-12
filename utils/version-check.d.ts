export declare const localVersion = "0.0.0-b5099d69dcfb3550e1a7a5e69c5c90920076d822";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
