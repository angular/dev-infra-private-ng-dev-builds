import { Commit } from '../../../commit-message/parse.js';
import { Label, LabelParams } from './base.js';
export interface ManageLabelParams extends LabelParams {
    /** A matching function, if the label is automatically applied by our github action, otherwise false. */
    commitCheck: (c: Commit) => boolean;
}
declare class ManagedLabel extends Label<ManageLabelParams> {
    /** A matching function, if the label is automatically applied by our github action, otherwise false. */
    commitCheck: (c: Commit) => boolean;
}
export declare const managedLabels: Record<PropertyKey, ManagedLabel>;
export {};
