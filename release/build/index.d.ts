import { BuiltPackage } from '../config/index.js';
export declare abstract class BuildWorker {
    static invokeBuild(): Promise<BuiltPackage[] | null>;
}
