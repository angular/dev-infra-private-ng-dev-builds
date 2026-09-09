export declare const localVersion = "0.0.0-f5c817076b8e4da7b6e91783dbcd553c5003a296";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmLock(content: string): string | null;
