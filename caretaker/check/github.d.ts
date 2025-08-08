import { BaseModule } from './base.js';
type GithubQueryResults = {
    queryName: string;
    count: number;
    queryUrl: string;
    matchedUrls: string[];
}[];
export declare class GithubQueriesModule extends BaseModule<GithubQueryResults | void> {
    retrieveData(): Promise<{
        queryName: string;
        count: number;
        queryUrl: string;
        matchedUrls: string[];
    }[] | undefined>;
    private buildGraphqlQuery;
    printToTerminal(): Promise<void>;
}
export {};
