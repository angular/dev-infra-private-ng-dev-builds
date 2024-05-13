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
        this.text = text;
        /** The id of the interval being used to trigger frame printing. */
        this.intervalId = setInterval(() => this.printFrame(), 125);
        /** The characters to iterate through to create the appearance of spinning in the spinner. */
        this.spinnerCharacters = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        /** The index of the spinner character used in the frame. */
        this.currentSpinnerCharacterIndex = 0;
        process.stdout.write(hideCursor);
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
    }
    /** Completes the spinner. */
    complete() {
        clearInterval(this.intervalId);
        process.stdout.write('\n');
        process.stdout.write(showCursor);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3Bpbm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25nLWRldi91dGlscy9zcGlubmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxRQUFRLEVBQUUsU0FBUyxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBRTdDLG1EQUFtRDtBQUNuRCxNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUM7QUFDL0IsbURBQW1EO0FBQ25ELE1BQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQztBQUUvQixNQUFNLE9BQU8sT0FBTztJQVFsQixZQUFvQixJQUFZO1FBQVosU0FBSSxHQUFKLElBQUksQ0FBUTtRQVBoQyxtRUFBbUU7UUFDM0QsZUFBVSxHQUFHLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDL0QsNkZBQTZGO1FBQ3JGLHNCQUFpQixHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDL0UsNERBQTREO1FBQ3BELGlDQUE0QixHQUFHLENBQUMsQ0FBQztRQUd2QyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRUQsc0NBQXNDO0lBQzlCLHVCQUF1QjtRQUM3QixJQUFJLENBQUMsNEJBQTRCO1lBQy9CLENBQUMsSUFBSSxDQUFDLDRCQUE0QixHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUM7UUFDMUUsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLENBQUM7SUFDbkUsQ0FBQztJQUVELHFEQUFxRDtJQUM3QyxVQUFVLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxFQUFFLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSTtRQUMxRSxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1QixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLE1BQU0sSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQzNDLGdHQUFnRztRQUNoRyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM3QixRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBRUQsdURBQXVEO0lBQ3ZELE1BQU0sQ0FBQyxJQUFZO1FBQ2pCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQ25CLENBQUM7SUFFRCw2QkFBNkI7SUFDN0IsUUFBUTtRQUNOLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDL0IsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0IsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDbkMsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Y3Vyc29yVG8sIGNsZWFyTGluZX0gZnJvbSAncmVhZGxpbmUnO1xuXG4vKiogQU5TSSBlc2NhcGUgY29kZSB0byBoaWRlIGN1cnNvciBpbiB0ZXJtaW5hbC4gKi9cbmNvbnN0IGhpZGVDdXJzb3IgPSAnXFx4MWJbPzI1bCc7XG4vKiogQU5TSSBlc2NhcGUgY29kZSB0byBzaG93IGN1cnNvciBpbiB0ZXJtaW5hbC4gKi9cbmNvbnN0IHNob3dDdXJzb3IgPSAnXFx4MWJbPzI1aCc7XG5cbmV4cG9ydCBjbGFzcyBTcGlubmVyIHtcbiAgLyoqIFRoZSBpZCBvZiB0aGUgaW50ZXJ2YWwgYmVpbmcgdXNlZCB0byB0cmlnZ2VyIGZyYW1lIHByaW50aW5nLiAqL1xuICBwcml2YXRlIGludGVydmFsSWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB0aGlzLnByaW50RnJhbWUoKSwgMTI1KTtcbiAgLyoqIFRoZSBjaGFyYWN0ZXJzIHRvIGl0ZXJhdGUgdGhyb3VnaCB0byBjcmVhdGUgdGhlIGFwcGVhcmFuY2Ugb2Ygc3Bpbm5pbmcgaW4gdGhlIHNwaW5uZXIuICovXG4gIHByaXZhdGUgc3Bpbm5lckNoYXJhY3RlcnMgPSBbJ+KgiycsICfioJknLCAn4qC5JywgJ+KguCcsICfioLwnLCAn4qC0JywgJ+KgpicsICfioKcnLCAn4qCHJywgJ+KgjyddO1xuICAvKiogVGhlIGluZGV4IG9mIHRoZSBzcGlubmVyIGNoYXJhY3RlciB1c2VkIGluIHRoZSBmcmFtZS4gKi9cbiAgcHJpdmF0ZSBjdXJyZW50U3Bpbm5lckNoYXJhY3RlckluZGV4ID0gMDtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHRleHQ6IHN0cmluZykge1xuICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGhpZGVDdXJzb3IpO1xuICB9XG5cbiAgLyoqIEdldCB0aGUgbmV4dCBzcGlubmVyIGNoYXJhY3Rlci4gKi9cbiAgcHJpdmF0ZSBnZXROZXh0U3Bpbm5lckNoYXJhY3RlcigpIHtcbiAgICB0aGlzLmN1cnJlbnRTcGlubmVyQ2hhcmFjdGVySW5kZXggPVxuICAgICAgKHRoaXMuY3VycmVudFNwaW5uZXJDaGFyYWN0ZXJJbmRleCArIDEpICUgdGhpcy5zcGlubmVyQ2hhcmFjdGVycy5sZW5ndGg7XG4gICAgcmV0dXJuIHRoaXMuc3Bpbm5lckNoYXJhY3RlcnNbdGhpcy5jdXJyZW50U3Bpbm5lckNoYXJhY3RlckluZGV4XTtcbiAgfVxuXG4gIC8qKiBQcmludCB0aGUgY3VycmVudCB0ZXh0IGZvciB0aGUgc3Bpbm5lciB0byB0aGUgICovXG4gIHByaXZhdGUgcHJpbnRGcmFtZShwcmVmaXggPSB0aGlzLmdldE5leHRTcGlubmVyQ2hhcmFjdGVyKCksIHRleHQgPSB0aGlzLnRleHQpIHtcbiAgICBjdXJzb3JUbyhwcm9jZXNzLnN0ZG91dCwgMCk7XG4gICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoYCAke3ByZWZpeH0gJHt0ZXh0fWApO1xuICAgIC8vIENsZWFyIHRvIHRoZSByaWdodCBvZiB0aGUgY3Vyc29yIGxvY2F0aW9uIGluIGNhc2UgdGhlIG5ldyBmcmFtZSBpcyBzaG9ydGVyIHRoYW4gdGhlIHByZXZpb3VzLlxuICAgIGNsZWFyTGluZShwcm9jZXNzLnN0ZG91dCwgMSk7XG4gICAgY3Vyc29yVG8ocHJvY2Vzcy5zdGRvdXQsIDApO1xuICB9XG5cbiAgLyoqIFVwZGF0ZXMgdGhlIHNwaW5uZXIgdGV4dCB3aXRoIHRoZSBwcm92aWRlZCB0ZXh0LiAqL1xuICB1cGRhdGUodGV4dDogc3RyaW5nKSB7XG4gICAgdGhpcy50ZXh0ID0gdGV4dDtcbiAgfVxuXG4gIC8qKiBDb21wbGV0ZXMgdGhlIHNwaW5uZXIuICovXG4gIGNvbXBsZXRlKCkge1xuICAgIGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbElkKTtcbiAgICBwcm9jZXNzLnN0ZG91dC53cml0ZSgnXFxuJyk7XG4gICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoc2hvd0N1cnNvcik7XG4gIH1cbn1cbiJdfQ==