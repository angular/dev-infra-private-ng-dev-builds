export declare const localVersion = "0.0.0-7d2d4a84c91ac77dbaed99bf860b39cef800287b";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
