export declare const localVersion = "0.0.0-f8062d1d0f50e59fcb36a9375a596f416204ee28";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
