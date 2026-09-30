export declare const localVersion = "0.0.0-d8b93a4147f2635985bc8f24ec66bf2b00b9f06e";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
