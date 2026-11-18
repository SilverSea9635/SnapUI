// 多参数函数签名分行；函数调用与泛型实参保持独立，不受本规则影响。
export default {
  meta: {
    type: 'layout',
    docs: { description: '函数声明有多个参数时，每个参数独占一行' },
    fixable: 'whitespace',
    schema: [],
    messages: { newline: '多个函数参数需要分行，并在括号内换行。' },
  },
  create(context) {
    const source = context.sourceCode;

    function check(node) {
      if (node.params.length < 2) return;
      const first = source.getFirstToken(node.params[0]);
      const open = source.getTokenBefore(first);
      const close = source.getTokenAfter(node.params.at(-1), token => token.value === ')');
      if (open?.value !== '(' || !close) return;

      const pairs = [[open, first]];
      for (let i = 1; i < node.params.length; i++) {
        const next = source.getFirstToken(node.params[i]);
        pairs.push([source.getTokenBefore(next), next]);
      }
      pairs.push([source.getTokenBefore(close), close]);

      for (const [before, after] of pairs) {
        if (before.loc.end.line !== after.loc.start.line) continue;
        context.report({
          node,
          loc: after.loc,
          messageId: 'newline',
          fix: fixer => {
            const gap = [before.range[1], after.range[0]];
            return /^\s*$/.test(source.text.slice(...gap))
              ? fixer.replaceTextRange(gap, '\n')
              : fixer.insertTextBefore(after, '\n');
          },
        });
      }
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
      TSDeclareFunction: check,
      TSFunctionType: check,
    };
  },
};
