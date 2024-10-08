/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { confirm, input, checkbox, select, editor } from '@inquirer/prompts';
/**
 * A set of prompts from inquirer to be used throughout our tooling.  We access them via static metonds on this
 * class to allow easier mocking management in test environments.
 */
export class Prompt {
}
Prompt.confirm = confirm;
Prompt.input = input;
Prompt.checkbox = checkbox;
Prompt.select = select;
Prompt.editor = editor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbmctZGV2L3V0aWxzL3Byb21wdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7QUFFSCxPQUFPLEVBQUMsT0FBTyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBQyxNQUFNLG1CQUFtQixDQUFDO0FBRTNFOzs7R0FHRztBQUNILE1BQU0sT0FBTyxNQUFNOztBQUNWLGNBQU8sR0FBbUIsT0FBTyxDQUFDO0FBQ2xDLFlBQUssR0FBaUIsS0FBSyxDQUFDO0FBQzVCLGVBQVEsR0FBb0IsUUFBUSxDQUFDO0FBQ3JDLGFBQU0sR0FBa0IsTUFBTSxDQUFDO0FBQy9CLGFBQU0sR0FBa0IsTUFBTSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7Y29uZmlybSwgaW5wdXQsIGNoZWNrYm94LCBzZWxlY3QsIGVkaXRvcn0gZnJvbSAnQGlucXVpcmVyL3Byb21wdHMnO1xuXG4vKipcbiAqIEEgc2V0IG9mIHByb21wdHMgZnJvbSBpbnF1aXJlciB0byBiZSB1c2VkIHRocm91Z2hvdXQgb3VyIHRvb2xpbmcuICBXZSBhY2Nlc3MgdGhlbSB2aWEgc3RhdGljIG1ldG9uZHMgb24gdGhpc1xuICogY2xhc3MgdG8gYWxsb3cgZWFzaWVyIG1vY2tpbmcgbWFuYWdlbWVudCBpbiB0ZXN0IGVudmlyb25tZW50cy5cbiAqL1xuZXhwb3J0IGNsYXNzIFByb21wdCB7XG4gIHN0YXRpYyBjb25maXJtOiB0eXBlb2YgY29uZmlybSA9IGNvbmZpcm07XG4gIHN0YXRpYyBpbnB1dDogdHlwZW9mIGlucHV0ID0gaW5wdXQ7XG4gIHN0YXRpYyBjaGVja2JveDogdHlwZW9mIGNoZWNrYm94ID0gY2hlY2tib3g7XG4gIHN0YXRpYyBzZWxlY3Q6IHR5cGVvZiBzZWxlY3QgPSBzZWxlY3Q7XG4gIHN0YXRpYyBlZGl0b3I6IHR5cGVvZiBlZGl0b3IgPSBlZGl0b3I7XG59XG4iXX0=