export declare const localVersion = "0.0.0-e5e802e7fabd8e5f1c3d66c9fa676856168acaa8";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
