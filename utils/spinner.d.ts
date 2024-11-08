/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export declare class Spinner {
    /** Whether the spinner is marked as completed. */
    private completed;
    /** The id of the interval being used to trigger frame printing. */
    private intervalId;
    /** The characters to iterate through to create the appearance of spinning in the spinner. */
    private spinnerCharacters;
    /** The index of the spinner character used in the frame. */
    private currentSpinnerCharacterIndex;
    /** The current text of the spinner. */
    private _text;
    private set text(value);
    private get text();
    constructor();
    constructor(text: string);
    /** Updates the spinner text with the provided text. */
    update(text: string): void;
    /** Completes the spinner marking it as successful with a `✓`. */
    success(text: string): void;
    /** Completes the spinner marking it as failing with an `✘`. */
    failure(text: string): void;
    /** Completes the spinner. */
    complete(): void;
    /**
     * Internal implementation for completing the spinner, marking it as completed, and printing the
     * final frame.
     */
    private _complete;
    /** Get the next spinner character. */
    private getNextSpinnerCharacter;
    /**
     * Print the next frame either in CI mode or local terminal mode based on whether the script is run in a
     * CI environment.
     */
    private printFrame;
    /** Print the current text for the spinner to the terminal.  */
    private printNextLocalFrame;
    /** Print the next expected piece for the spinner to stdout for CI usage.  */
    private printNextCIFrame;
    /** Hide the cursor in the terminal, only executed in local environments. */
    private hideCursor;
    /** Resume showing the cursor in the terminal, only executed in local environments. */
    private showCursor;
}
