export declare const RepositoryMergeMode: {
    readonly TEAM_ONLY: "team-only";
    readonly CARETAKER_ONLY: "caretaker-only";
};
export type RepositoryMergeMode = (typeof RepositoryMergeMode)[keyof typeof RepositoryMergeMode];
export declare const MergeMode: {
    readonly RELEASE: "release";
    readonly TEAM_ONLY: "team-only";
    readonly CARETAKER_ONLY: "caretaker-only";
};
export type MergeMode = (typeof MergeMode)[keyof typeof MergeMode];
export declare function getCurrentMergeMode(): Promise<MergeMode>;
export declare function setRepoMergeMode(value: MergeMode): Promise<boolean>;
