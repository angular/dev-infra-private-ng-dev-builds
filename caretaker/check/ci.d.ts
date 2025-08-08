import { BaseModule } from './base.js';
type CiBranchStatus = 'pending' | 'passing' | 'failing' | null;
type CiData = {
    active: boolean;
    name: string;
    label: string;
    status: CiBranchStatus;
}[];
export declare class CiModule extends BaseModule<CiData> {
    retrieveData(): Promise<{
        active: boolean;
        name: string;
        label: string;
        status: "pending" | "passing" | "failing" | null;
    }[]>;
    printToTerminal(): Promise<void>;
}
export {};
