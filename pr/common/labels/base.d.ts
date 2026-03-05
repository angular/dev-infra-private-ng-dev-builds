export declare const createTypedObject: <T extends new (...args: any) => any>(LabelConstructor: T) => (val: Record<PropertyKey, ConstructorParameters<T>[0]>) => Record<PropertyKey, InstanceType<T>>;
export interface LabelParams {
    name: string;
    description: string;
    color?: string;
    repositories?: ManagedRepositories[];
}
export declare class Label<T extends LabelParams = LabelParams> {
    readonly params: T;
    repositories: ManagedRepositories[];
    name: string;
    description: string;
    color: string | undefined;
    constructor(params: T);
}
export declare enum ManagedRepositories {
    COMPONENTS = "components",
    ANGULAR = "angular",
    ANGULAR_CLI = "angular-cli",
    DEV_INFRA = "dev-infra",
    RULES_ANGULAR = "rules_angular",
    RULES_BROWSERS = "rules_browsers",
    RULES_SASS = "rules_sass"
}
