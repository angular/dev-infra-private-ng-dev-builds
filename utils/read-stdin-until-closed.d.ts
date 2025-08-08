export declare class ReadBufferFromStdinError extends Error {
}
export declare function readBufferFromStdinUntilClosed(input?: NodeJS.ReadStream): Promise<Buffer>;
