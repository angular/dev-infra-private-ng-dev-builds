export declare const createTypedObject: <T>() => <O extends Record<PropertyKey, T>>(v: O) => O;
export interface Label {
    name: string;
    description: string;
    color?: string;
}
