export declare const localVersion = "0.0.0-d45884cba93817d0e1a2be67ca5638227f64e508";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
