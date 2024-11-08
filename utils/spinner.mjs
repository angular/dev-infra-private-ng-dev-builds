/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { cursorTo, clearLine } from 'readline';
import { green, red } from './logging.js';
/** Whether execution is in a CI environment. */
const IS_CI = process.env['CI'];
/** ANSI escape code to hide cursor in terminal. */
const hideCursor = '\x1b[?25l';
/** ANSI escape code to show cursor in terminal. */
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
        /** Whether the spinner is marked as completed. */
        this.completed = false;
        /** The id of the interval being used to trigger frame printing. */
        this.intervalId = setInterval(() => this.printFrame(), IS_CI ? 2500 : 125);
        /** The characters to iterate through to create the appearance of spinning in the spinner. */
        this.spinnerCharacters = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        /** The index of the spinner character used in the frame. */
        this.currentSpinnerCharacterIndex = 0;
        /** The current text of the spinner. */
        this._text = '';
        this.hideCursor();
        this.text = text;
    }
    /** Updates the spinner text with the provided text. */
    update(text) {
        this.text = text;
    }
    /** Completes the spinner marking it as successful with a `✓`. */
    success(text) {
        this._complete(green('✓'), text);
    }
    /** Completes the spinner marking it as failing with an `✘`. */
    failure(text) {
        this._complete(red('✘'), text);
    }
    /** Completes the spinner. */
    complete() {
        this._complete('', this.text);
    }
    /**
     * Internal implementation for completing the spinner, marking it as completed, and printing the
     * final frame.
     */
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
    /** Get the next spinner character. */
    getNextSpinnerCharacter() {
        this.currentSpinnerCharacterIndex =
            (this.currentSpinnerCharacterIndex + 1) % this.spinnerCharacters.length;
        return this.spinnerCharacters[this.currentSpinnerCharacterIndex];
    }
    /**
     * Print the next frame either in CI mode or local terminal mode based on whether the script is run in a
     * CI environment.
     */
    printFrame(prefix = this.getNextSpinnerCharacter(), text) {
        if (IS_CI) {
            this.printNextCIFrame(text);
        }
        else {
            this.printNextLocalFrame(prefix, text);
        }
    }
    /** Print the current text for the spinner to the terminal.  */
    printNextLocalFrame(prefix, text) {
        cursorTo(process.stdout, 0);
        process.stdout.write(` ${prefix} ${text || this.text}`);
        // Clear to the right of the cursor location in case the new frame is shorter than the previous.
        clearLine(process.stdout, 1);
    }
    /** Print the next expected piece for the spinner to stdout for CI usage.  */
    printNextCIFrame(text) {
        if (text) {
            process.stdout.write(`\n${text}.`);
            return;
        }
        process.stdout.write('.');
    }
    /** Hide the cursor in the terminal, only executed in local environments. */
    hideCursor() {
        if (!IS_CI) {
            process.stdout.write(hideCursor);
        }
    }
    /** Resume showing the cursor in the terminal, only executed in local environments. */
    showCursor() {
        if (!IS_CI) {
            process.stdout.write(showCursor);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3Bpbm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25nLWRldi91dGlscy9zcGlubmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxRQUFRLEVBQUUsU0FBUyxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBQzdDLE9BQU8sRUFBQyxLQUFLLEVBQUUsR0FBRyxFQUFDLE1BQU0sY0FBYyxDQUFDO0FBRXhDLGdEQUFnRDtBQUNoRCxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2hDLG1EQUFtRDtBQUNuRCxNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUM7QUFDL0IsbURBQW1EO0FBQ25ELE1BQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQztBQUUvQixNQUFNLE9BQU8sT0FBTztJQVdsQixJQUFZLElBQUksQ0FBQyxJQUF3QjtRQUN2QyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQ2hDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLHVCQUF1QixFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDeEQsQ0FBQztJQUNELElBQVksSUFBSTtRQUNkLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNwQixDQUFDO0lBSUQsWUFBWSxJQUFhO1FBcEJ6QixrREFBa0Q7UUFDMUMsY0FBUyxHQUFHLEtBQUssQ0FBQztRQUMxQixtRUFBbUU7UUFDM0QsZUFBVSxHQUFHLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzlFLDZGQUE2RjtRQUNyRixzQkFBaUIsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFB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SyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFFRCw0RUFBNEU7SUFDcEUsVUFBVTtRQUNoQixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDWCxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNuQyxDQUFDO0lBQ0gsQ0FBQztJQUVELHNGQUFzRjtJQUM5RSxVQUFVO1FBQ2hCLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNYLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ25DLENBQUM7SUFDSCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQ1xuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtjdXJzb3JUbywgY2xlYXJMaW5lfSBmcm9tICdyZWFkbGluZSc7XG5pbXBvcnQge2dyZWVuLCByZWR9IGZyb20gJy4vbG9nZ2luZy5qcyc7XG5cbi8qKiBXaGV0aGVyIGV4ZWN1dGlvbiBpcyBpbiBhIENJIGVudmlyb25tZW50LiAqL1xuY29uc3QgSVNfQ0kgPSBwcm9jZXNzLmVudlsnQ0knXTtcbi8qKiBBTlNJIGVzY2FwZSBjb2RlIHRvIGhpZGUgY3Vyc29yIGluIHRlcm1pbmFsLiAqL1xuY29uc3QgaGlkZUN1cnNvciA9ICdcXHgxYls/MjVsJztcbi8qKiBBTlNJIGVzY2FwZSBjb2RlIHRvIHNob3cgY3Vyc29yIGluIHRlcm1pbmFsLiAqL1xuY29uc3Qgc2hvd0N1cnNvciA9ICdcXHgxYls/MjVoJztcblxuZXhwb3J0IGNsYXNzIFNwaW5uZXIge1xuICAvKiogV2hldGhlciB0aGUgc3Bpbm5lciBpcyBtYXJrZWQgYXMgY29tcGxldGVkLiAqL1xuICBwcml2YXRlIGNvbXBsZXRlZCA9IGZhbHNlO1xuICAvKiogVGhlIGlkIG9mIHRoZSBpbnRlcnZhbCBiZWluZyB1c2VkIHRvIHRyaWdnZXIgZnJhbWUgcHJpbnRpbmcuICovXG4gIHByaXZhdGUgaW50ZXJ2YWxJZCA9IHNldEludGVydmFsKCgpID0+IHRoaXMucHJpbnRGcmFtZSgpLCBJU19DSSA/IDI1MDAgOiAxMjUpO1xuICAvKiogVGhlIGNoYXJhY3RlcnMgdG8gaXRlcmF0ZSB0aHJvdWdoIHRvIGNyZWF0ZSB0aGUgYXBwZWFyYW5jZSBvZiBzcGlubmluZyBpbiB0aGUgc3Bpbm5lci4gKi9cbiAgcHJpdmF0ZSBzcGlubmVyQ2hhcmFjdGVycyA9IFsn4qCLJywgJ+KgmScsICfioLknLCAn4qC4JywgJ+KgvCcsICfioLQnLCAn4qCmJywgJ+KgpycsICfioIcnLCAn4qCPJ107XG4gIC8qKiBUaGUgaW5kZXggb2YgdGhlIHNwaW5uZXIgY2hhcmFjdGVyIHVzZWQgaW4gdGhlIGZyYW1lLiAqL1xuICBwcml2YXRlIGN1cnJlbnRTcGlubmVyQ2hhcmFjdGVySW5kZXggPSAwO1xuICAvKiogVGhlIGN1cnJlbnQgdGV4dCBvZiB0aGUgc3Bpbm5lci4gKi9cbiAgcHJpdmF0ZSBfdGV4dDogc3RyaW5nID0gJyc7XG4gIHByaXZhdGUgc2V0IHRleHQodGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG4gICAgdGhpcy5fdGV4dCA9IHRleHQgfHwgdGhpcy5fdGV4dDtcbiAgICB0aGlzLnByaW50RnJhbWUodGhpcy5nZXROZXh0U3Bpbm5lckNoYXJhY3RlcigpLCB0ZXh0KTtcbiAgfVxuICBwcml2YXRlIGdldCB0ZXh0KCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuX3RleHQ7XG4gIH1cblxuICBjb25zdHJ1Y3RvcigpO1xuICBjb25zdHJ1Y3Rvcih0ZXh0OiBzdHJpbmcpO1xuICBjb25zdHJ1Y3Rvcih0ZXh0Pzogc3RyaW5nKSB7XG4gICAgdGhpcy5oaWRlQ3Vyc29yKCk7XG4gICAgdGhpcy50ZXh0ID0gdGV4dDtcbiAgfVxuXG4gIC8qKiBVcGRhdGVzIHRoZSBzcGlubmVyIHRleHQgd2l0aCB0aGUgcHJvdmlkZWQgdGV4dC4gKi9cbiAgdXBkYXRlKHRleHQ6IHN0cmluZykge1xuICAgIHRoaXMudGV4dCA9IHRleHQ7XG4gIH1cblxuICAvKiogQ29tcGxldGVzIHRoZSBzcGlubmVyIG1hcmtpbmcgaXQgYXMgc3VjY2Vzc2Z1bCB3aXRoIGEgYOKck2AuICovXG4gIHN1Y2Nlc3ModGV4dDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5fY29tcGxldGUoZ3JlZW4oJ+KckycpLCB0ZXh0KTtcbiAgfVxuXG4gIC8qKiBDb21wbGV0ZXMgdGhlIHNwaW5uZXIgbWFya2luZyBpdCBhcyBmYWlsaW5nIHdpdGggYW4gYOKcmGAuICovXG4gIGZhaWx1cmUodGV4dDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5fY29tcGxldGUocmVkKCfinJgnKSwgdGV4dCk7XG4gIH1cblxuICAvKiogQ29tcGxldGVzIHRoZSBzcGlubmVyLiAqL1xuICBjb21wbGV0ZSgpIHtcbiAgICB0aGlzLl9jb21wbGV0ZSgnJywgdGhpcy50ZXh0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBpbXBsZW1lbnRhdGlvbiBmb3IgY29tcGxldGluZyB0aGUgc3Bpbm5lciwgbWFya2luZyBpdCBhcyBjb21wbGV0ZWQsIGFuZCBwcmludGluZyB0aGVcbiAgICogZmluYWwgZnJhbWUuXG4gICAqL1xuICBwcml2YXRlIF9jb21wbGV0ZShwcmVmaXg6IHN0cmluZywgdGV4dDogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuY29tcGxldGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbElkKTtcbiAgICB0aGlzLnByaW50RnJhbWUocHJlZml4LCB0ZXh0KTtcbiAgICBwcm9jZXNzLnN0ZG91dC53cml0ZSgnXFxuJyk7XG4gICAgdGhpcy5zaG93Q3Vyc29yKCk7XG4gICAgdGhpcy5jb21wbGV0ZWQgPSB0cnVlO1xuICB9XG5cbiAgLyoqIEdldCB0aGUgbmV4dCBzcGlubmVyIGNoYXJhY3Rlci4gKi9cbiAgcHJpdmF0ZSBnZXROZXh0U3Bpbm5lckNoYXJhY3RlcigpIHtcbiAgICB0aGlzLmN1cnJlbnRTcGlubmVyQ2hhcmFjdGVySW5kZXggPVxuICAgICAgKHRoaXMuY3VycmVudFNwaW5uZXJDaGFyYWN0ZXJJbmRleCArIDEpICUgdGhpcy5zcGlubmVyQ2hhcmFjdGVycy5sZW5ndGg7XG4gICAgcmV0dXJuIHRoaXMuc3Bpbm5lckNoYXJhY3RlcnNbdGhpcy5jdXJyZW50U3Bpbm5lckNoYXJhY3RlckluZGV4XTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcmludCB0aGUgbmV4dCBmcmFtZSBlaXRoZXIgaW4gQ0kgbW9kZSBvciBsb2NhbCB0ZXJtaW5hbCBtb2RlIGJhc2VkIG9uIHdoZXRoZXIgdGhlIHNjcmlwdCBpcyBydW4gaW4gYVxuICAgKiBDSSBlbnZpcm9ubWVudC5cbiAgICovXG4gIHByaXZhdGUgcHJpbnRGcmFtZShwcmVmaXggPSB0aGlzLmdldE5leHRTcGlubmVyQ2hhcmFjdGVyKCksIHRleHQ/OiBzdHJpbmcpOiB2b2lkIHtcbiAgICBpZiAoSVNfQ0kpIHtcbiAgICAgIHRoaXMucHJpbnROZXh0Q0lGcmFtZSh0ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wcmludE5leHRMb2NhbEZyYW1lKHByZWZpeCwgdGV4dCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFByaW50IHRoZSBjdXJyZW50IHRleHQgZm9yIHRoZSBzcGlubmVyIHRvIHRoZSB0ZXJtaW5hbC4gICovXG4gIHByaXZhdGUgcHJpbnROZXh0TG9jYWxGcmFtZShwcmVmaXg6IHN0cmluZywgdGV4dD86IHN0cmluZykge1xuICAgIGN1cnNvclRvKHByb2Nlc3Muc3Rkb3V0LCAwKTtcbiAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShgICR7cHJlZml4fSAke3RleHQgfHwgdGhpcy50ZXh0fWApO1xuICAgIC8vIENsZWFyIHRvIHRoZSByaWdodCBvZiB0aGUgY3Vyc29yIGxvY2F0aW9uIGluIGNhc2UgdGhlIG5ldyBmcmFtZSBpcyBzaG9ydGVyIHRoYW4gdGhlIHByZXZpb3VzLlxuICAgIGNsZWFyTGluZShwcm9jZXNzLnN0ZG91dCwgMSk7XG4gIH1cblxuICAvKiogUHJpbnQgdGhlIG5leHQgZXhwZWN0ZWQgcGllY2UgZm9yIHRoZSBzcGlubmVyIHRvIHN0ZG91dCBmb3IgQ0kgdXNhZ2UuICAqL1xuICBwcml2YXRlIHByaW50TmV4dENJRnJhbWUodGV4dD86IHN0cmluZykge1xuICAgIGlmICh0ZXh0KSB7XG4gICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShgXFxuJHt0ZXh0fS5gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoJy4nKTtcbiAgfVxuXG4gIC8qKiBIaWRlIHRoZSBjdXJzb3IgaW4gdGhlIHRlcm1pbmFsLCBvbmx5IGV4ZWN1dGVkIGluIGxvY2FsIGVudmlyb25tZW50cy4gKi9cbiAgcHJpdmF0ZSBoaWRlQ3Vyc29yKCkge1xuICAgIGlmICghSVNfQ0kpIHtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGhpZGVDdXJzb3IpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBSZXN1bWUgc2hvd2luZyB0aGUgY3Vyc29yIGluIHRoZSB0ZXJtaW5hbCwgb25seSBleGVjdXRlZCBpbiBsb2NhbCBlbnZpcm9ubWVudHMuICovXG4gIHByaXZhdGUgc2hvd0N1cnNvcigpIHtcbiAgICBpZiAoIUlTX0NJKSB7XG4gICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShzaG93Q3Vyc29yKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==