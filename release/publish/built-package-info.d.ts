import { BuiltPackage, BuiltPackageWithInfo, NpmPackage } from '../config/index.js';
export declare function analyzeAndExtendBuiltPackagesWithInfo(builtPackages: BuiltPackage[], npmPackages: NpmPackage[]): Promise<BuiltPackageWithInfo[]>;
export declare function assertIntegrityOfBuiltPackages(builtPackagesWithInfo: BuiltPackageWithInfo[]): Promise<void>;
