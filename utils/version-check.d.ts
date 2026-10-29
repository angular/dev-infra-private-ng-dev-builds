export declare const localVersion = "0.0.0-b8ce0e167ac2a0edba1a94adb3071cb913ae2cbe";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
