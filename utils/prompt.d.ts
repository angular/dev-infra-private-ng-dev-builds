import { confirm, input, checkbox, select, editor } from '@inquirer/prompts';
export declare class Prompt {
    static confirm: (_config: Parameters<typeof confirm>[0], _context?: Parameters<typeof confirm>[1]) => Promise<boolean>;
    static input: typeof input;
    static checkbox: typeof checkbox;
    static select: typeof select;
    static editor: typeof editor;
}
