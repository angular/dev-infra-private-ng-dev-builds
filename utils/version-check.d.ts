export declare const localVersion = "0.0.0-026e5025ba2681e7000c20e916fa1f8b82eb260f";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
