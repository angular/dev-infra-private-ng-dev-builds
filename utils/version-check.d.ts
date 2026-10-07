export declare const localVersion = "0.0.0-8b6cbbca278a26f2495275c5d9d0d8633573162d";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
