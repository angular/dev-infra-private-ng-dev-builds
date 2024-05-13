/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import ts from 'typescript';
/**
 * Finds all module references in the specified source file.
 * @param node Source file which should be parsed.
 * @returns List of import specifiers in the source file.
 */
export function getModuleReferences(initialNode, ignoreTypeOnlyChecks) {
    const references = [];
    const visitNode = (node) => {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
            // When ignoreTypeOnlyChecks are enabled, if the declaration is found to be type only, it is skipped.
            if (ignoreTypeOnlyChecks &&
                ((ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) ||
                    (ts.isExportDeclaration(node) && node.isTypeOnly))) {
                return;
            }
            if (node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
                references.push(node.moduleSpecifier.text);
            }
        }
        ts.forEachChild(node, visitNode);
    };
    ts.forEachChild(initialNode, visitNode);
    return references;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbmctZGV2L3RzLWNpcmN1bGFyLWRlcGVuZGVuY2llcy9wYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRTVCOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsbUJBQW1CLENBQ2pDLFdBQTBCLEVBQzFCLG9CQUE2QjtJQUU3QixNQUFNLFVBQVUsR0FBYSxFQUFFLENBQUM7SUFDaEMsTUFBTSxTQUFTLEdBQUcsQ0FBQyxJQUFhLEVBQUUsRUFBRTtRQUNsQyxJQUFJLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUNqRSxxR0FBcUc7WUFDckcsSUFDRSxvQkFBb0I7Z0JBQ3BCLENBQUMsQ0FBQyxFQUFFLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUM7b0JBQzlELENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUNwRCxDQUFDO2dCQUNELE9BQU87WUFDVCxDQUFDO1lBRUQsSUFBSSxJQUFJLENBQUMsZUFBZSxLQUFLLFNBQVMsSUFBSSxFQUFFLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDO2dCQUNuRixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDN0MsQ0FBQztRQUNILENBQUM7UUFDRCxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNuQyxDQUFDLENBQUM7SUFFRixFQUFFLENBQUMsWUFBWSxDQUFDLFdBQVcsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUV4QyxPQUFPLFVBQVUsQ0FBQztBQUNwQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuLyoqXG4gKiBGaW5kcyBhbGwgbW9kdWxlIHJlZmVyZW5jZXMgaW4gdGhlIHNwZWNpZmllZCBzb3VyY2UgZmlsZS5cbiAqIEBwYXJhbSBub2RlIFNvdXJjZSBmaWxlIHdoaWNoIHNob3VsZCBiZSBwYXJzZWQuXG4gKiBAcmV0dXJucyBMaXN0IG9mIGltcG9ydCBzcGVjaWZpZXJzIGluIHRoZSBzb3VyY2UgZmlsZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldE1vZHVsZVJlZmVyZW5jZXMoXG4gIGluaXRpYWxOb2RlOiB0cy5Tb3VyY2VGaWxlLFxuICBpZ25vcmVUeXBlT25seUNoZWNrczogYm9vbGVhbixcbik6IHN0cmluZ1tdIHtcbiAgY29uc3QgcmVmZXJlbmNlczogc3RyaW5nW10gPSBbXTtcbiAgY29uc3QgdmlzaXROb2RlID0gKG5vZGU6IHRzLk5vZGUpID0+IHtcbiAgICBpZiAodHMuaXNJbXBvcnREZWNsYXJhdGlvbihub2RlKSB8fCB0cy5pc0V4cG9ydERlY2xhcmF0aW9uKG5vZGUpKSB7XG4gICAgICAvLyBXaGVuIGlnbm9yZVR5cGVPbmx5Q2hlY2tzIGFyZSBlbmFibGVkLCBpZiB0aGUgZGVjbGFyYXRpb24gaXMgZm91bmQgdG8gYmUgdHlwZSBvbmx5LCBpdCBpcyBza2lwcGVkLlxuICAgICAgaWYgKFxuICAgICAgICBpZ25vcmVUeXBlT25seUNoZWNrcyAmJlxuICAgICAgICAoKHRzLmlzSW1wb3J0RGVjbGFyYXRpb24obm9kZSkgJiYgbm9kZS5pbXBvcnRDbGF1c2U/LmlzVHlwZU9ubHkpIHx8XG4gICAgICAgICAgKHRzLmlzRXhwb3J0RGVjbGFyYXRpb24obm9kZSkgJiYgbm9kZS5pc1R5cGVPbmx5KSlcbiAgICAgICkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChub2RlLm1vZHVsZVNwZWNpZmllciAhPT0gdW5kZWZpbmVkICYmIHRzLmlzU3RyaW5nTGl0ZXJhbChub2RlLm1vZHVsZVNwZWNpZmllcikpIHtcbiAgICAgICAgcmVmZXJlbmNlcy5wdXNoKG5vZGUubW9kdWxlU3BlY2lmaWVyLnRleHQpO1xuICAgICAgfVxuICAgIH1cbiAgICB0cy5mb3JFYWNoQ2hpbGQobm9kZSwgdmlzaXROb2RlKTtcbiAgfTtcblxuICB0cy5mb3JFYWNoQ2hpbGQoaW5pdGlhbE5vZGUsIHZpc2l0Tm9kZSk7XG5cbiAgcmV0dXJuIHJlZmVyZW5jZXM7XG59XG4iXX0=