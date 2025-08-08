export declare const findOwnedForksOfRepoQuery: {
    repository: {
        forks: {
            nodes: {
                owner: {
                    login: string;
                };
                name: string;
            }[];
        };
    };
};
