export declare class Spinner {
    private completed;
    private intervalId;
    private spinnerCharacters;
    private currentSpinnerCharacterIndex;
    private _text;
    private set text(value);
    private get text();
    constructor();
    constructor(text: string);
    update(text: string): void;
    success(text: string): void;
    failure(text: string): void;
    complete(): void;
    private _complete;
    private getNextSpinnerCharacter;
    private printFrame;
    private printNextLocalFrame;
    private printNextCIFrame;
    private hideCursor;
    private showCursor;
}
