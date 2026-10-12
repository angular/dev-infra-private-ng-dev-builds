export declare const localVersion = "0.0.0-c240b6a65af4b66f1fdee06c9e87312ce79e3205";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
