export interface ValidationResult {
    name: string;
    failures: string[];
}
export declare function validateSkills(repoRoot: string): Promise<{
    results: ValidationResult[];
    exitCode: number;
}>;
export declare function validateSkill(filePath: string): Promise<ValidationResult>;
