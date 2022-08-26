import { HttpsCallableResult } from 'firebase/functions';
/** Data for the user of an ng-dev token. */
interface NgDevUser {
    email: string;
}
/**
 * Setup and invoke a firebase function on the server after confirming a ng-dev token is present.
 */
export declare function invokeServerFunction<P extends {}, R>(name: string, params?: P): Promise<HttpsCallableResult<R>>;
/**
 * Request a new ng-dev token from the server, storing it the file system for use.
 */
export declare function requestNgDevToken(): Promise<NgDevUser>;
/**
 * Check the validity of the local ng-dev token with the server, if a local token is present. If a
 * valid token is present, restores it to the current ngDevToken in memory.
 */
export declare function restoreNgTokenFromDiskIfValid(): Promise<void>;
/** Get the current user for the ng-dev token, if defined. */
export declare function getCurrentUser(): Promise<NgDevUser | null>;
/**
 * Configure the AuthorizedGitClient using a temporary token from the ng-dev credential service.
 * The token is valid for the life of the socket being open, which is expected to be for the life
 * of the command running.
 */
export declare function configureAuthorizedGitClientWithTemporaryToken(): Promise<void>;
/** Whether there is already a file at the location used for login credentials. */
export declare function hasTokenStoreFile(): Promise<boolean>;
export {};
