export declare const localVersion = "0.0.0-6afd924ca295eb0f17cec3530e2d2855e82dde06";
export declare function ngDevVersionMiddleware(): Promise<void>;
export declare function verifyNgDevToolIsUpToDate(workspacePath: string): Promise<boolean>;
export declare function extractNgDevVersionFromPnpmList(stdout: string): string | null;
