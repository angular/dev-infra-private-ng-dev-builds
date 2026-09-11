export declare const localVersion = "0.0.0-cde7ad16c16f5c7dbd57b62e8b930443813484ec";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmLock(content: string): string | null;
