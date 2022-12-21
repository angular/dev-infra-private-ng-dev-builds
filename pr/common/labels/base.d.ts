export declare const createTypedObject: <T>() => <O extends Record<PropertyKey, T>>(v: O) => O;
export interface LabelParams {
    name: string;
    description: string;
    color?: string;
}
export declare class Label {
    name: string;
    description: string;
    color?: string;
    constructor({ name, description, color }: LabelParams);
}
