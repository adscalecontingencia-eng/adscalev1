#!/usr/bin/env python3
"""Aplica um arquivo de mapeamento de traduções (DSL) ao código e aos JSON de área.

Formato:
  @area client                 -> src/i18n/locales/areas/client.json
  @file src/x.tsx              -> arquivo onde substituir
  @prefix client.loyalty       -> prefixo das chaves
  nome | PT | EN | ES          -> cria chave e troca o texto PT no arquivo por tr('chave')
  +nome | PT | EN | ES         -> só cria a chave (uso em !raw)
  !raw TRECHO ==> NOVO         -> substituição literal (todas as ocorrências) no arquivo atual
Nome começando com '=' é chave absoluta.
"""
import json, re, sys, os
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def jpath(area): return os.path.join(ROOT, 'src/i18n/locales/areas', area + '.json')

def setk(d, key, val):
    parts = key.split('.')
    for p in parts[:-1]:
        d = d.setdefault(p, OrderedDict())
        if not isinstance(d, dict): raise SystemExit(f'conflito de chave {key}')
    if parts[-1] in d and d[parts[-1]] != val:
        raise SystemExit(f'chave {key} já existe com outro texto: {d[parts[-1]]!r} vs {val!r}')
    d[parts[-1]] = val

def bare_re(pt):
    e = re.escape(pt)
    return re.compile(r'(?:(?<=[>}])|(?<=^)|(?<=\n))([ \t]*)' + e + r'([ \t]*)(?=[<{]|\n|$)')

def main(path):
    area = None; file = None; prefix = ''; src = None
    data = None; ops = []  # per file
    report = []
    def flush():
        nonlocal src
        if file is None: return
        s = open(file, encoding='utf8').read()
        orig = s
        for kind, a, b in [o for o in ops if o[0] == 'raw']:
            if a not in s: report.append(f'  ⚠ raw não encontrado em {file}: {a[:80]!r}')
            s = s.replace(a, b)
        # longest PT first
        for kind, a, b in sorted([o for o in ops if o[0] == 'tr'], key=lambda o: -len(o[1])):
            pt, key = a, b
            call = f"tr('{key}')"
            n = 0
            lit = re.compile(r'(\b[\w-]+=)?([\'"`])' + re.escape(pt) + r'\2')
            def rl(m):
                nonlocal n; n += 1
                return (m.group(1) + '{' + call + '}') if m.group(1) else call
            s = lit.sub(rl, s)
            def rb(m):
                nonlocal n; n += 1
                return m.group(1) + '{' + call + '}' + m.group(2)
            s = bare_re(pt).sub(rb, s)
            if n == 0: report.append(f'  ⚠ não encontrado em {file}: {pt!r}')
        if s != orig and not re.search(r"import \{[^}]*\btr\b[^}]*\} from '@/i18n'", s):
            m = re.search(r'^import .*?;\s*$', s, re.M | re.S)
            # insert after first complete import statement
            idx = s.find('\n', s.find(';', s.find('import '))) + 1
            s = s[:idx] + "import { tr } from '@/i18n';\n" + s[idx:]
        open(file, 'w', encoding='utf8').write(s)
    areas = {}
    for raw in open(path, encoding='utf8').read().split('\n'):
        line = raw.rstrip()
        if not line.strip() or line.lstrip().startswith('#'): continue
        if line.startswith('@area '):
            area = line[6:].strip()
            if area not in areas: areas[area] = json.load(open(jpath(area)), object_pairs_hook=OrderedDict)
            continue
        if line.startswith('@file '):
            flush(); file = os.path.join(ROOT, line[6:].strip()); ops = []; continue
        if line.startswith('@prefix '):
            prefix = line[8:].strip(); continue
        if line.startswith('!raw '):
            a, b = raw.rstrip('\r')[5:].split(' ==>', 1)
            b = b[1:] if b.startswith(' ') else b
            a = a.replace('\\n', '\n'); b = b.replace('\\n', '\n')
            ops.append(('raw', a, b)); continue
        only_key = line.startswith('+')
        if only_key: line = line[1:]
        parts = [p.strip() for p in line.split(' | ')]
        if len(parts) != 4: raise SystemExit(f'linha inválida: {raw}')
        name, pt, en, es = parts
        key = name[1:] if name.startswith('=') else f'{prefix}.{name}'
        d = areas[area]
        setk(d['pt'], key, pt); setk(d['en'], key, en); setk(d['es'], key, es)
        if not only_key: ops.append(('tr', pt, key))
    flush()
    for a, d in areas.items():
        json.dump(d, open(jpath(a), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print('\n'.join(report) or 'ok')

if __name__ == '__main__':
    for p in sys.argv[1:]: main(p)
