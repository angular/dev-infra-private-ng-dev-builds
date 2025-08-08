import { cursorTo, clearLine } from 'readline';
import { green, red } from './logging.js';
const IS_CI = process.env['CI'];
const hideCursor = '\x1b[?25l';
const showCursor = '\x1b[?25h';
export class Spinner {
    set text(text) {
        this._text = text || this._text;
        this.printFrame(this.getNextSpinnerCharacter(), text);
    }
    get text() {
        return this._text;
    }
    constructor(text) {
        this.completed = false;
        this.intervalId = setInterval(() => this.printFrame(), IS_CI ? 2500 : 125);
        this.spinnerCharacters = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.currentSpinnerCharacterIndex = 0;
        this._text = '';
        this.hideCursor();
        this.text = text;
    }
    update(text) {
        this.text = text;
    }
    success(text) {
        this._complete(green('✓'), text);
    }
    failure(text) {
        this._complete(red('✘'), text);
    }
    complete() {
        this._complete('', this.text);
    }
    _complete(prefix, text) {
        if (this.completed) {
            return;
        }
        clearInterval(this.intervalId);
        this.printFrame(prefix, text);
        process.stdout.write('\n');
        this.showCursor();
        this.completed = true;
    }
    getNextSpinnerCharacter() {
        this.currentSpinnerCharacterIndex =
            (this.currentSpinnerCharacterIndex + 1) % this.spinnerCharacters.length;
        return this.spinnerCharacters[this.currentSpinnerCharacterIndex];
    }
    printFrame(prefix = this.getNextSpinnerCharacter(), text) {
        if (IS_CI) {
            this.printNextCIFrame(text);
        }
        else {
            this.printNextLocalFrame(prefix, text);
        }
    }
    printNextLocalFrame(prefix, text) {
        cursorTo(process.stdout, 0);
        process.stdout.write(` ${prefix} ${text || this.text}`);
        clearLine(process.stdout, 1);
    }
    printNextCIFrame(text) {
        if (text) {
            process.stdout.write(`\n${text}.`);
            return;
        }
        process.stdout.write('.');
    }
    hideCursor() {
        if (!IS_CI) {
            process.stdout.write(hideCursor);
        }
    }
    showCursor() {
        if (!IS_CI) {
            process.stdout.write(showCursor);
        }
    }
}
//# sourceMappingURL=spinner.js.map