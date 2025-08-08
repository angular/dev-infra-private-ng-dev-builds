import { Buildifier } from './buildifier.js';
import { Prettier } from './prettier.js';
export declare function getActiveFormatters(): Promise<(Buildifier | Prettier)[]>;
export { Formatter, type FormatterAction } from './base-formatter.js';
