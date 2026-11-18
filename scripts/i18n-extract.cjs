// Lists user-visible text candidates (JSX text, UI attributes, string/template literals) in TSX files.
// Usage: node scripts/i18n-extract.cjs <files...>
const ts = require('typescript');
const fs = require('fs');
const SKIP_ATTR = new Set(['className', 'key', 'type', 'variant', 'size', 'id', 'href', 'to', 'src', 'value', 'name', 'htmlFor', 'role', 'align', 'side', 'dataKey', 'stroke', 'fill', 'strokeDasharray', 'inputMode', 'autoComplete', 'accept', 'target', 'rel', 'mode', 'defaultValue', 'orientation', 'layout', 'format', 'step', 'tone', 'icon', 'lang', 'translate', 'stackId', 'yAxisId', 'xAxisId', 'path', 'method', 'action', 'pattern']);
const SKIP_CALL = /^(supabase\.|.*\.(from|eq|neq|select|order|in|is|gte|lte|gt|lt|rpc|invoke|ilike|like|or|not|match|contains|update|insert|upsert|delete|channel|on|range|limit|filter)|format|parseISO|import|require|localStorage\.\w+|sessionStorage\.\w+|t|tr|i18n\.t|addEventListener|querySelector|getElementById|setAttribute|cn|clsx|startsWith|endsWith|includes|split|replace|join|padStart|toFixed|toLocaleString|toLocaleDateString|Intl\.\w+|new Intl\.\w+|console\.\w+|navigate|useState)$/;
const looksText = (s) => /[A-Za-zÀ-ÿ]{2,}/.test(s) && (/[À-ÿ]/.test(s) || /\s/.test(s.trim()) || /^[A-ZÀ-Ú][a-zà-ÿ]+/.test(s.trim())) && !/^[\w.-]+\/[\w./-]+$/.test(s) && !/^(https?:|mailto:|#|\/)/.test(s.trim()) && !/^[a-z_]+$/.test(s.trim()) && !/^(bg|text|border|flex|grid|w|h|p|m|px|py|rounded|gap)-/.test(s.trim());
for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out = [];
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const callName = (n) => { let p = n.parent; while (p && (ts.isBinaryExpression(p) || ts.isConditionalExpression(p) || ts.isParenthesizedExpression(p) || ts.isTemplateSpan(p) || ts.isTemplateExpression(p))) p = p.parent; if (p && ts.isCallExpression(p)) return p.expression.getText(sf).replace(/\s+/g, ''); if (p && ts.isNewExpression(p)) return 'new ' + p.expression.getText(sf); return ''; };
  const inSkippedAttr = (n) => { let p = n.parent; while (p && !ts.isJsxAttribute(p) && !ts.isJsxElement(p) && !ts.isJsxSelfClosingElement(p) && !ts.isSourceFile(p)) p = p.parent; return p && ts.isJsxAttribute(p) && SKIP_ATTR.has(p.name.getText(sf)); };
  const inPropKey = (n) => n.parent && ts.isPropertyAssignment(n.parent) && n.parent.name === n;
  const inTypeOrImport = (n) => { let p = n.parent; while (p) { if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isTypeNode(p) || ts.isLiteralTypeNode?.(p)) return true; p = p.parent; } return false; };
  const inCompare = (n) => n.parent && ts.isBinaryExpression(n.parent) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(n.parent.operatorToken.kind);
  const inCase = (n) => n.parent && ts.isCaseClause(n.parent);
  const visit = (n) => {
    if (ts.isJsxText(n)) { const s = n.text.replace(/\s+/g, ' ').trim(); if (looksText(s)) out.push([line(n), 'jsx', s]); }
    else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !inTypeOrImport(n) && !inPropKey(n) && !inSkippedAttr(n) && !inCompare(n) && !inCase(n) && !(n.parent && ts.isElementAccessExpression(n.parent))) {
      const cn = callName(n); if (!SKIP_CALL.test(cn) && looksText(n.text)) out.push([line(n), n.parent && ts.isJsxAttribute(n.parent) ? 'attr:' + n.parent.name.getText(sf) : 'str' + (cn ? '@' + cn : ''), n.text]);
    } else if (ts.isTemplateExpression(n) && !inSkippedAttr(n)) {
      const cn = callName(n); const txt = n.getText(sf).slice(1, -1);
      if (!SKIP_CALL.test(cn) && looksText([n.head.text, ...n.templateSpans.map(s => s.literal.text)].join(' '))) out.push([line(n), 'tpl' + (cn ? '@' + cn : ''), txt]);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  for (const [l, k, s] of out) console.log(`${file.split('/').pop()}:${l} [${k}] ${s.replace(/\n/g, '\\n')}`);
}
