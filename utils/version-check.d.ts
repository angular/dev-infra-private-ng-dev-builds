export declare const localVersion = "0.0.0-3b181b7da71ce256d7dc44532ed3df8198f7d853";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
