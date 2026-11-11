export declare const localVersion = "0.0.0-0c134fb123a6bfed88468b13152e8ce6610ba5eb";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
