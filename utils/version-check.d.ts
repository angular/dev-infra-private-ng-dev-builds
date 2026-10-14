export declare const localVersion = "0.0.0-1ae310edf8e3212bf9dbeeb1799f489fc2a96ac7";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
