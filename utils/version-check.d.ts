export declare const localVersion = "0.0.0-2a8cf970ef815ffaefeacef48e9f5cccb1dfb2c9";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
