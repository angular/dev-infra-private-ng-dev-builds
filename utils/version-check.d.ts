export declare const localVersion = "0.0.0-2a0ecc004dda97a081bdbd3ee719eb957026c10f";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
