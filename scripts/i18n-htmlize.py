#!/usr/bin/env python3
"""Turns static rich-text JSX blocks (<p>/<li>/<span>/<div> with only <b>/<code>/<span>/<strong> inside and no
{expressions} except {" "}) into dangerouslySetInnerHTML={{ __html: tr(key) }}, storing the PT HTML in the area JSON.
Usage: i18n-htmlize.py <file> <area> <prefix>  -> prints key<TAB>pt for each block (fill en/es afterwards)."""
import re, sys, json, os
from collections import OrderedDict
file, area, prefix = sys.argv[1:4]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
jp = os.path.join(ROOT, 'src/i18n/locales/areas', area + '.json')
d = json.load(open(jp), object_pairs_hook=OrderedDict)
s = open(file, encoding='utf8').read()
pat = re.compile(r'<(p|li|span|div)((?:\s+className="[^"]*")?)>((?:(?!<(?:p|li|div)[\s>]).)*?)</\1>', re.S)
n = 0
def rep(m):
    global n
    tag, attrs, inner = m.groups()
    if re.search(r'<[A-Z]', inner) or '{' in inner.replace('{" "}', ''): return m.group(0)
    if not re.search(r'[A-Za-zÀ-ÿ]{3,}', re.sub(r'<[^>]+>', '', inner)): return m.group(0)
    if not re.search(r'<(b|code|span|strong)\b', inner): return m.group(0)
    html = inner.replace('{" "}', ' ').replace('className=', 'class=')
    html = re.sub(r'\s+', ' ', html).strip()
    n += 1
    key = f'{prefix}.h{n}'
    node = d['pt']
    for p in key.split('.')[:-1]: node = node.setdefault(p, OrderedDict())
    node[key.split('.')[-1]] = html
    print(f'{key}\t{html}')
    return f'<{tag}{attrs} dangerouslySetInnerHTML={{{{ __html: tr(\'{key}\') }}}} />'
s = pat.sub(rep, s)
open(file, 'w', encoding='utf8').write(s)
json.dump(d, open(jp, 'w'), ensure_ascii=False, indent=1)
