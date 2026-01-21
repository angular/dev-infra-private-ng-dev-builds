export declare enum MergeMode {
    TEAM_ONLY = "team-only",
    CARETAKER_ONLY = "caretaker-only",
    RELEASE = "release"
}
export declare function getCurrentMergeMode(): Promise<MergeMode>;
export declare function setRepoMergeMode(value: MergeMode): Promise<boolean>;
