export declare function isNodeJSWrappedError<T extends new (...args: any) => Error>(value: Error | unknown, errorType: T): value is InstanceType<T> & NodeJS.ErrnoException;
