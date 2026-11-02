export declare const localVersion = "0.0.0-4b4b82ac5abe501bf51f5fcd41dedb2df08f72b2";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
