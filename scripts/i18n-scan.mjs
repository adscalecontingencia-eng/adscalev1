#!/usr/bin/env node
// Lista textos possivelmente fixos em português (não traduzidos) nos arquivos indicados.
// Uso: node scripts/i18n-scan.mjs <arquivo...>
import fs from 'node:fs';
const PT = /[ãõçáéíóúâêôà]|\b(faltam|atual|depois|topo|de|da|do|das|dos|não|nao|para|com|sem|por|conta|contas|cliente|clientes|gasto|saldo|semana|salvar|cancelar|carregando|nenhum|nenhuma|erro|sucesso|atualizar|excluir|editar|adicionar|buscar|pesquisar|selecione|valor|data|ativo|ativa|ativas|bloqueada|pendente|pago|mês|hoje|ontem|últimos|período|total|enviar|fechar|voltar|novo|nova)\b/i;
const files = process.argv.slice(2);
let count = 0;
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const l = line.trim().replace(/\b(t|tr|i18n\.t)\(\s*(['"`])[\w.-]+\2\s*,\s*(['"`])(?:\\.|(?!\3).)*\3/g, 't()');
    if (!l || l.startsWith('//') || l.startsWith('*') || l.startsWith('/*') || l.startsWith('import ')) return;
    if (/console\.(log|warn|error|info|debug)\(/.test(l)) return;
    const hits = [];
    // JSX text between tags
    for (const m of l.matchAll(/>([^<>{}]*[A-Za-zÀ-ú][^<>{}]*)</g)) if (PT.test(m[1])) hits.push(m[1].trim());
    for (const m of l.matchAll(/>([^<>{}]*[A-Za-zÀ-ú][^<>{}]*)$/g)) if (PT.test(m[1]) && !/[;=]\s*$/.test(m[1])) hits.push(m[1].trim());
    for (const m of l.matchAll(/^([^<>{}'"`]*[A-Za-zÀ-ú][^<>{}'"`]*)</g)) if (PT.test(m[1]) && !/[=(&|?:]/.test(m[1])) hits.push(m[1].trim());
    // line that is only JSX text
    if (!/[<>{}=;()]/.test(l) && /[A-Za-zÀ-ú]{3,}/.test(l) && PT.test(l)) hits.push(l);
    // string literals
    for (const m of l.matchAll(/(['"`])((?:\\.|(?!\1).)*?)\1/g)) {
      const s = m[2];
      if (s.length < 3 || !/\s|[ãõçáéíóúâêô]/.test(s)) continue;
      if (/^[\w.-]+$/.test(s) || /^(bg|text|border|flex|grid|px|py|p|m|w|h|rounded|gap|items|justify|hover|font|absolute|relative|inline|space|min|max|shadow|ring|opacity|transition|col|row|overflow|truncate|z|top|left|right|bottom|sm|md|lg|xl|dark)[-:\s]/.test(s)) continue;
      if (PT.test(s)) hits.push(s);
    }
    for (const h of hits) { count++; console.log(`${f}:${i + 1}: ${h.slice(0, 120)}`); }
  });
}
console.error(`\n${count} possíveis textos fixos em português`);
