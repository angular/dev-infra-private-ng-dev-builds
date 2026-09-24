export declare const localVersion = "0.0.0-a98a0a6d48067af7768f4dded0c4f159af687e2b";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
