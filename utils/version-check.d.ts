export declare const localVersion = "0.0.0-5fb5ac8b22fb074ec50302e64f24c8397ea3b632";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
