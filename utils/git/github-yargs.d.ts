import { Argv } from 'yargs';
export declare function addGithubTokenOption<T>(argv: Argv<T>): Argv<T & {
    githubToken: void;
}>;
export declare function configureGitClientWithTokenOrFromEnvironment(token: string | undefined): void;
