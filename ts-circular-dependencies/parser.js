import ts from 'typescript';
export function getModuleReferences(initialNode, ignoreTypeOnlyChecks) {
    const references = [];
    const visitNode = (node) => {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
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
//# sourceMappingURL=parser.js.map