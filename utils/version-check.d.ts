export declare const localVersion = "0.0.0-a1993a758648b43d3ccf7be9e3eade089a82a4e7";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmLock(content: string): string | null;
