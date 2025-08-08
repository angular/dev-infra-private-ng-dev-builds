import { PullApproveGroup } from './group.js';
export declare class PullApproveStringArray extends Array<string> {
    include(pattern: string): PullApproveStringArray;
    exclude(pattern: string): PullApproveStringArray;
}
export declare class PullApproveGroupArray extends Array<PullApproveGroup> {
    include(pattern: string): PullApproveGroupArray;
    exclude(pattern: string): PullApproveGroupArray;
    get approved(): void;
    get pending(): void;
    get active(): void;
    get inactive(): void;
    get rejected(): void;
    get names(): string[];
}
