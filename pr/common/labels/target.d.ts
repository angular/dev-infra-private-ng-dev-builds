import { Label } from './base.js';
export declare class TargetLabel extends Label {
    __hasTargetLabelMarker__: boolean;
}
/**
 * Record capturing available target label names in the Angular organization.
 * A target label is set on a pull request to specify where its changes should land.
 *
 * More details can be found here:
 * https://docs.google.com/document/d/197kVillDwx-RZtSVOBtPb4BBIAw0E9RT3q3v6DZkykU#heading=h.lkuypj38h15d
 */
export declare const targetLabels: Record<PropertyKey, TargetLabel>;
