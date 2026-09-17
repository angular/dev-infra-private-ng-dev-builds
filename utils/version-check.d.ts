export declare const localVersion = "0.0.0-71e60c68d9d483b0d763b8e6ed4dd9deb8da3b1a";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
