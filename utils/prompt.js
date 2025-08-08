import { confirm, input, checkbox, select, editor } from '@inquirer/prompts';
export class Prompt {
}
Prompt.confirm = (_config, _context) => {
    const config = {
        default: false,
        ..._config,
    };
    return confirm(config, _context);
};
Prompt.input = input;
Prompt.checkbox = checkbox;
Prompt.select = select;
Prompt.editor = editor;
//# sourceMappingURL=prompt.js.map