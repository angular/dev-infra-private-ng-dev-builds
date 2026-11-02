export declare const localVersion = "0.0.0-f7a91b76e0c2ca6c8cbdd7991327da052b9f6e00";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
