import type { PluginObj, types } from '@babel/core';

// 预览通过 Function 执行脚本，需要在编译阶段移除模块语法。
export function previewModulePlugin({ types: t }: { types: typeof types }): PluginObj {
  return {
    visitor: {
      ImportDeclaration(path) {
        path.remove();
      },
      ExportNamedDeclaration(path) {
        if (path.node.declaration) path.replaceWith(path.node.declaration);
        else path.remove();
      },
      ExportAllDeclaration(path) {
        path.remove();
      },
      ExportDefaultDeclaration(path) {
        const declaration = path.node.declaration;
        if (t.isFunctionDeclaration(declaration) || t.isClassDeclaration(declaration)) {
          if (declaration.id) {
            path.replaceWithMultiple([
              declaration,
              t.variableDeclaration('const', [t.variableDeclarator(t.identifier('__previewDefault'), t.identifier(declaration.id.name))]),
            ]);
            return;
          }
        }
        if (t.isTSDeclareFunction(declaration)) {
          path.remove();
          return;
        }
        path.replaceWith(t.variableDeclaration('const', [
          t.variableDeclarator(t.identifier('__previewDefault'), t.toExpression(declaration)),
        ]));
      },
    },
  };
}
