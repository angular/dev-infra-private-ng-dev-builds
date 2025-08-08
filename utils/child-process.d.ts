import { SpawnOptions as _SpawnOptions, SpawnSyncOptions as _SpawnSyncOptions, ExecOptions as _ExecOptions } from 'child_process';
export interface CommonCmdOpts {
    input?: string;
    mode?: 'enabled' | 'silent' | 'on-error';
    suppressErrorOnFailingExitCode?: boolean;
}
export interface SpawnSyncOptions extends CommonCmdOpts, Omit<_SpawnSyncOptions, 'shell' | 'stdio' | 'input'> {
}
export interface SpawnOptions extends CommonCmdOpts, Omit<_SpawnOptions, 'shell' | 'stdio'> {
}
export interface ExecOptions extends CommonCmdOpts, Omit<_ExecOptions, 'shell' | 'stdio'> {
}
export interface SpawnInteractiveCommandOptions extends Omit<_SpawnOptions, 'shell' | 'stdio'> {
}
export interface SpawnResult {
    stdout: string;
    stderr: string;
    status: number | NodeJS.Signals;
}
export type ExecResult = SpawnResult;
export declare abstract class ChildProcess {
    static spawnInteractive(command: string, args: string[], options?: SpawnInteractiveCommandOptions): Promise<void>;
    static spawnSync(command: string, args: string[], options?: SpawnSyncOptions): SpawnResult;
    static spawn(command: string, args: string[], options?: SpawnOptions): Promise<SpawnResult>;
    static exec(command: string, options?: ExecOptions): Promise<SpawnResult>;
}
