/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { cursorTo, clearLine } from 'readline';
/** ANSI escape code to hide cursor in terminal. */
const hideCursor = '\x1b[?25l';
/** ANSI escape code to show cursor in terminal. */
const showCursor = '\x1b[?25h';
export class Spinner {
    constructor(text) {
        /** Whether the spinner is currently running. */
        this.isRunning = true;
        /** The id of the interval being used to trigger frame printing. */
        this.intervalId = setInterval(() => this.printFrame(), 125);
        /** The characters to iterate through to create the appearance of spinning in the spinner. */
        this.spinnerCharacters = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        /** The index of the spinner character used in the frame. */
        this.currentSpinnerCharacterIndex = 0;
        /** The current text of the spinner. */
        this.text = '';
        process.stdout.write(hideCursor);
        this.update(text);
    }
    /** Get the next spinner character. */
    getNextSpinnerCharacter() {
        this.currentSpinnerCharacterIndex =
            (this.currentSpinnerCharacterIndex + 1) % this.spinnerCharacters.length;
        return this.spinnerCharacters[this.currentSpinnerCharacterIndex];
    }
    /** Print the current text for the spinner to the  */
    printFrame(prefix = this.getNextSpinnerCharacter(), text = this.text) {
        cursorTo(process.stdout, 0);
        process.stdout.write(` ${prefix} ${text}`);
        // Clear to the right of the cursor location in case the new frame is shorter than the previous.
        clearLine(process.stdout, 1);
        cursorTo(process.stdout, 0);
    }
    /** Updates the spinner text with the provided text. */
    update(text) {
        this.text = text;
        this.printFrame(this.spinnerCharacters[this.currentSpinnerCharacterIndex]);
    }
    complete(text) {
        if (!this.isRunning) {
            return;
        }
        clearInterval(this.intervalId);
        clearLine(process.stdout, 1);
        cursorTo(process.stdout, 0);
        if (text) {
            process.stdout.write(text);
            process.stdout.write('\n');
        }
        process.stdout.write(showCursor);
        this.isRunning = false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3Bpbm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25nLWRldi91dGlscy9zcGlubmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxRQUFRLEVBQUUsU0FBUyxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBRTdDLG1EQUFtRDtBQUNuRCxNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUM7QUFDL0IsbURBQW1EO0FBQ25ELE1BQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQztBQUUvQixNQUFNLE9BQU8sT0FBTztJQVlsQixZQUFZLElBQVk7UUFYeEIsZ0RBQWdEO1FBQ3hDLGNBQVMsR0FBRyxJQUFJLENBQUM7UUFDekIsbUVBQW1FO1FBQzNELGVBQVUsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQy9ELDZGQUE2RjtRQUNyRixzQkFBaUIsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQy9FLDREQUE0RDtRQUNwRCxpQ0FBNEIsR0FBRyxDQUFDLENBQUM7UUFDekMsdUNBQXVDO1FBQy9CLFNBQUksR0FBVyxFQUFFLENBQUM7UUFHeEIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDakMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNwQixDQUFDO0lBRUQsc0NBQXNDO0lBQzlCLHVCQUF1QjtRQUM3QixJQUFJLENBQUMsNEJBQTRCO1lBQy9CLENBQUMsSUFBSSxDQUFDLDRCQUE0QixHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUM7UUFDMUUsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLENBQUM7SUFDbkUsQ0FBQztJQUVELHFEQUFxRDtJQUM3QyxVQUFVLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxFQUFFLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSTtRQUMxRSxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1QixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLE1BQU0sSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQzNDLGdHQUFnRztRQUNoRyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM3QixRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBRUQsdURBQXVEO0lBQ3ZELE1BQU0sQ0FBQyxJQUFZO1FBQ2pCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDLENBQUM7SUFDN0UsQ0FBQztJQUtELFFBQVEsQ0FBQyxJQUFhO1FBQ3BCLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDcEIsT0FBTztRQUNULENBQUM7UUFDRCxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQy9CLFNBQVMsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzdCLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVCLElBQUksSUFBSSxFQUFFLENBQUM7WUFDVCxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMzQixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QixDQUFDO1FBQ0QsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDakMsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7SUFDekIsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Y3Vyc29yVG8sIGNsZWFyTGluZX0gZnJvbSAncmVhZGxpbmUnO1xuXG4vKiogQU5TSSBlc2NhcGUgY29kZSB0byBoaWRlIGN1cnNvciBpbiB0ZXJtaW5hbC4gKi9cbmNvbnN0IGhpZGVDdXJzb3IgPSAnXFx4MWJbPzI1bCc7XG4vKiogQU5TSSBlc2NhcGUgY29kZSB0byBzaG93IGN1cnNvciBpbiB0ZXJtaW5hbC4gKi9cbmNvbnN0IHNob3dDdXJzb3IgPSAnXFx4MWJbPzI1aCc7XG5cbmV4cG9ydCBjbGFzcyBTcGlubmVyIHtcbiAgLyoqIFdoZXRoZXIgdGhlIHNwaW5uZXIgaXMgY3VycmVudGx5IHJ1bm5pbmcuICovXG4gIHByaXZhdGUgaXNSdW5uaW5nID0gdHJ1ZTtcbiAgLyoqIFRoZSBpZCBvZiB0aGUgaW50ZXJ2YWwgYmVpbmcgdXNlZCB0byB0cmlnZ2VyIGZyYW1lIHByaW50aW5nLiAqL1xuICBwcml2YXRlIGludGVydmFsSWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnByaW50RnJhbWUoKSwgMTI1KTtcbiAgLyoqIFRoZSBjaGFyYWN0ZXJzIHRvIGl0ZXJhdGUgdGhyb3VnaCB0byBjcmVhdGUgdGhlIGFwcGVhcmFuY2Ugb2Ygc3Bpbm5pbmcgaW4gdGhlIHNwaW5uZXIuICovXG4gIHByaXZhdGUgc3Bpbm5lckNoYXJhY3RlcnMgPSBbJ+KgiycsICfioJknLCAn4qC5JywgJ+KguCcsICfioLwnLCAn4qC0JywgJ+KgpicsICfioKcnLCAn4qCHJywgJ+KgjyddO1xuICAvKiogVGhlIGluZGV4IG9mIHRoZSBzcGlubmVyIGNoYXJhY3RlciB1c2VkIGluIHRoZSBmcmFtZS4gKi9cbiAgcHJpdmF0ZSBjdXJyZW50U3Bpbm5lckNoYXJhY3RlckluZGV4ID0gMDtcbiAgLyoqIFRoZSBjdXJyZW50IHRleHQgb2YgdGhlIHNwaW5uZXIuICovXG4gIHByaXZhdGUgdGV4dDogc3RyaW5nID0gJyc7XG5cbiAgY29uc3RydWN0b3IodGV4dDogc3RyaW5nKSB7XG4gICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoaGlkZUN1cnNvcik7XG4gICAgdGhpcy51cGRhdGUodGV4dCk7XG4gIH1cblxuICAvKiogR2V0IHRoZSBuZXh0IHNwaW5uZXIgY2hhcmFjdGVyLiAqL1xuICBwcml2YXRlIGdldE5leHRTcGlubmVyQ2hhcmFjdGVyKCkge1xuICAgIHRoaXMuY3VycmVudFNwaW5uZXJDaGFyYWN0ZXJJbmRleCA9XG4gICAgICAodGhpcy5jdXJyZW50U3Bpbm5lckNoYXJhY3RlckluZGV4ICsgMSkgJSB0aGlzLnNwaW5uZXJDaGFyYWN0ZXJzLmxlbmd0aDtcbiAgICByZXR1cm4gdGhpcy5zcGlubmVyQ2hhcmFjdGVyc1t0aGlzLmN1cnJlbnRTcGlubmVyQ2hhcmFjdGVySW5kZXhdO1xuICB9XG5cbiAgLyoqIFByaW50IHRoZSBjdXJyZW50IHRleHQgZm9yIHRoZSBzcGlubmVyIHRvIHRoZSAgKi9cbiAgcHJpdmF0ZSBwcmludEZyYW1lKHByZWZpeCA9IHRoaXMuZ2V0TmV4dFNwaW5uZXJDaGFyYWN0ZXIoKSwgdGV4dCA9IHRoaXMudGV4dCkge1xuICAgIGN1cnNvclRvKHByb2Nlc3Muc3Rkb3V0LCAwKTtcbiAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShgICR7cHJlZml4fSAke3RleHR9YCk7XG4gICAgLy8gQ2xlYXIgdG8gdGhlIHJpZ2h0IG9mIHRoZSBjdXJzb3IgbG9jYXRpb24gaW4gY2FzZSB0aGUgbmV3IGZyYW1lIGlzIHNob3J0ZXIgdGhhbiB0aGUgcHJldmlvdXMuXG4gICAgY2xlYXJMaW5lKHByb2Nlc3Muc3Rkb3V0LCAxKTtcbiAgICBjdXJzb3JUbyhwcm9jZXNzLnN0ZG91dCwgMCk7XG4gIH1cblxuICAvKiogVXBkYXRlcyB0aGUgc3Bpbm5lciB0ZXh0IHdpdGggdGhlIHByb3ZpZGVkIHRleHQuICovXG4gIHVwZGF0ZSh0ZXh0OiBzdHJpbmcpIHtcbiAgICB0aGlzLnRleHQgPSB0ZXh0O1xuICAgIHRoaXMucHJpbnRGcmFtZSh0aGlzLnNwaW5uZXJDaGFyYWN0ZXJzW3RoaXMuY3VycmVudFNwaW5uZXJDaGFyYWN0ZXJJbmRleF0pO1xuICB9XG5cbiAgLyoqIENvbXBsZXRlcyB0aGUgc3Bpbm5lci4gKi9cbiAgY29tcGxldGUoKTogdm9pZDtcbiAgY29tcGxldGUodGV4dDogc3RyaW5nKTogdm9pZDtcbiAgY29tcGxldGUodGV4dD86IHN0cmluZykge1xuICAgIGlmICghdGhpcy5pc1J1bm5pbmcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsSWQpO1xuICAgIGNsZWFyTGluZShwcm9jZXNzLnN0ZG91dCwgMSk7XG4gICAgY3Vyc29yVG8ocHJvY2Vzcy5zdGRvdXQsIDApO1xuICAgIGlmICh0ZXh0KSB7XG4gICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZSh0ZXh0KTtcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKCdcXG4nKTtcbiAgICB9XG4gICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoc2hvd0N1cnNvcik7XG4gICAgdGhpcy5pc1J1bm5pbmcgPSBmYWxzZTtcbiAgfVxufVxuIl19