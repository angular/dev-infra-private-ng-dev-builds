/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import inquirer from 'inquirer';
export class Prompt {
    /** Prompts the user with a confirmation question and a specified message. */
    static async confirm(message, defaultValue = false) {
        return (await inquirer.prompt({
            type: 'confirm',
            name: 'result',
            message: message,
            default: defaultValue,
        })).result;
    }
    /** Prompts the user for one line of input. */
    static async input(message) {
        return (await inquirer.prompt({ type: 'input', name: 'result', message }))
            .result;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbmctZGV2L3V0aWxzL3Byb21wdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLFFBQVEsTUFBTSxVQUFVLENBQUM7QUFFaEMsTUFBTSxPQUFnQixNQUFNO0lBQzFCLDZFQUE2RTtJQUM3RSxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFlLEVBQUUsWUFBWSxHQUFHLEtBQUs7UUFDeEQsT0FBTyxDQUNMLE1BQU0sUUFBUSxDQUFDLE1BQU0sQ0FBb0I7WUFDdkMsSUFBSSxFQUFFLFNBQVM7WUFDZixJQUFJLEVBQUUsUUFBUTtZQUNkLE9BQU8sRUFBRSxPQUFPO1lBQ2hCLE9BQU8sRUFBRSxZQUFZO1NBQ3RCLENBQUMsQ0FDSCxDQUFDLE1BQU0sQ0FBQztJQUNYLENBQUM7SUFFRCw4Q0FBOEM7SUFDOUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBZTtRQUNoQyxPQUFPLENBQUMsTUFBTSxRQUFRLENBQUMsTUFBTSxDQUFtQixFQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUMsQ0FBQyxDQUFDO2FBQ3ZGLE1BQU0sQ0FBQztJQUNaLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgaW5xdWlyZXIgZnJvbSAnaW5xdWlyZXInO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgUHJvbXB0IHtcbiAgLyoqIFByb21wdHMgdGhlIHVzZXIgd2l0aCBhIGNvbmZpcm1hdGlvbiBxdWVzdGlvbiBhbmQgYSBzcGVjaWZpZWQgbWVzc2FnZS4gKi9cbiAgc3RhdGljIGFzeW5jIGNvbmZpcm0obWVzc2FnZTogc3RyaW5nLCBkZWZhdWx0VmFsdWUgPSBmYWxzZSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHJldHVybiAoXG4gICAgICBhd2FpdCBpbnF1aXJlci5wcm9tcHQ8e3Jlc3VsdDogYm9vbGVhbn0+KHtcbiAgICAgICAgdHlwZTogJ2NvbmZpcm0nLFxuICAgICAgICBuYW1lOiAncmVzdWx0JyxcbiAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgICAgZGVmYXVsdDogZGVmYXVsdFZhbHVlLFxuICAgICAgfSlcbiAgICApLnJlc3VsdDtcbiAgfVxuXG4gIC8qKiBQcm9tcHRzIHRoZSB1c2VyIGZvciBvbmUgbGluZSBvZiBpbnB1dC4gKi9cbiAgc3RhdGljIGFzeW5jIGlucHV0KG1lc3NhZ2U6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIChhd2FpdCBpbnF1aXJlci5wcm9tcHQ8e3Jlc3VsdDogc3RyaW5nfT4oe3R5cGU6ICdpbnB1dCcsIG5hbWU6ICdyZXN1bHQnLCBtZXNzYWdlfSkpXG4gICAgICAucmVzdWx0O1xuICB9XG59XG4iXX0=