// Lista chamadas tr() fora de funções (avaliadas uma vez só, não mudam com o idioma).
const ts = require('typescript'); const fs = require('fs');
for (const f of process.argv.slice(2)) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (n, inFn) => {
    const fn = inFn || ts.isFunctionLike(n);
    if (!fn && ts.isCallExpression(n) && n.expression.getText(sf) === 'tr') {
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      console.log(`${f}:${line + 1}: ${n.getText(sf)}`);
    }
    ts.forEachChild(n, c => visit(c, fn));
  };
  visit(sf, false);
}
