import { Commit } from '../../../commit-message/parse.js';
import { Label, LabelParams } from './base.js';
export interface ManageLabelParams extends LabelParams {
    commitCheck: (c: Commit) => boolean;
}
declare class ManagedLabel extends Label<ManageLabelParams> {
    commitCheck: (c: Commit) => boolean;
}
export declare const managedLabels: Record<PropertyKey, ManagedLabel>;
export {};
