import { BaseModule } from './base.js';
interface ServiceConfig {
    name: string;
    url: string;
    prettyUrl: string;
}
interface StatusCheckResult {
    name: string;
    status: 'passing' | 'failing';
    description: string;
    lastUpdated: Date;
    statusUrl: string;
}
export declare const services: ServiceConfig[];
export declare class ServicesModule extends BaseModule<StatusCheckResult[]> {
    retrieveData(): Promise<StatusCheckResult[]>;
    printToTerminal(): Promise<void>;
    getStatusFromStandardApi(service: ServiceConfig): Promise<StatusCheckResult>;
}
export {};
