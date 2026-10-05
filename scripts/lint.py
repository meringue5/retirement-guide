#!/usr/bin/env python3
"""출판 전 점검 (DESIGN.md 8장).

사용법: python3 scripts/lint.py [content/guide.md]
오류가 있으면 종료 코드 1. 경고는 출력만 한다.
"""
import difflib
import re
import sys
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / 'content' / 'guide.md')
BLOCK_TYPES = {'핵심', '세부', '시각화', '시뮬레이터', '체크리스트', '문서판', '전제', '메모'}
SIM_KEYS = ['pension_credit_limit', 'pension_saving_credit_limit', 'pension_deposit_limit', 'credit_rate_low',
            'credit_rate_high', 'isa_annual_limit', 'return_low', 'return_high', 'sim_years']

errors, warns = [], []
err = lambda m: errors.append(m)
warn = lambda m: warns.append(m)

text = SRC.read_text(encoding='utf-8')
meta = {}
if text.startswith('---\n'):
    end = text.index('\n---', 4)
    for line in text[4:end].splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            meta[k.strip()] = v.strip()
    body = text[end + 4:]
else:
    body = text
    err('frontmatter가 없다')
if not meta.get('기준일'):
    err('frontmatter에 기준일이 없다')

lines = body.split('\n')
units, unit, chapter, block, in_fn = [], None, None, None, False
fn_defs = {}
for no, line in enumerate(lines, 1):
    if block is not None:
        if line.strip() == ':::':
            (unit['blocks'] if unit else []).append(block)
            block = None
        else:
            block['lines'].append(line)
        continue
    m = re.match(r'^\[\^([\w-]+)\]:\s*(.*)$', line)
    if m:
        fn_defs[m.group(1)] = no
        continue
    m = re.match(r'^:::\s*(\S+)(?:\s+"([^"]*)")?(?:\s*→\s*(\d+))?\s*$', line)
    if m:
        t = m.group(1)
        if t not in BLOCK_TYPES:
            err(f'{no}행: 알 수 없는 블록 종류 "{t}"')
        block = {'type': t, 'title': m.group(2), 'link': int(m.group(3) or 0), 'lines': [], 'line': no}
        continue
    m = re.match(r'^# (.+)$', line)
    if m:
        h = m.group(1).strip()
        in_fn = h == '각주'
        mm = re.match(r'^(\d+)\.\s+(.+)$', h) or re.match(r'^(부록\s+[A-Z])\.\s*(.+)$', h)
        if mm:
            chapter = {'no': mm.group(1), 'title': mm.group(2), 'appendix': h.startswith('부록')}
            unit = {'no': mm.group(1), 'title': mm.group(2), 'chapter': chapter, 'blocks': [], 'summary': False,
                    'free': [], 'line': no, 'has_sections': False}
            units.append(unit)
        else:
            unit = None
        continue
    m = re.match(r'^## (\S+?)\.\s+(.+)$', line)
    if m and chapter:
        units[-1]['has_sections'] = units[-1]['has_sections'] or units[-1]['chapter'] is chapter
        unit = {'no': m.group(1), 'title': m.group(2), 'chapter': chapter, 'blocks': [], 'summary': False,
                'free': [], 'line': no, 'has_sections': False, 'section': True}
        units.append(unit)
        continue
    if in_fn or unit is None:
        continue
    if line.startswith('요약:'):
        unit['summary'] = True
        unit['summary_text'] = line[3:].strip()
        if '작성 예정' in line or '추가 예정' in line:
            warn(f'{no}행 [{unit["no"]}]: 자리표시 요약이 남아 있다 → "{line.strip()}"')
        continue
    if line.startswith('할 일:'):
        if re.search(r'(^|\s)(위|아래)(\s|의|에|로|$)', line[5:]):
            err(f'{no}행 [{unit["no"]}]: 할 일에 "위/아래" 같은 위치 표현이 있다. 할 일은 "할 일 모아 보기"에도 따로 나오므로 이름으로 가리킬 것 (예: "납입 시뮬레이터")')
        continue
    if not line.strip() or line.strip() == '---':
        continue
    unit['free'].append((no, line))

if block is not None:
    err(f'{block["line"]}행: ::: {block["type"]} 블록이 닫히지 않았다')

# 장 단위 유닛 중 절이 있는 것은 '장 머리'로만 취급
chapter_heads = {id(u['chapter']) for u in units if u.get('section')}
for u in units:
    is_head = not u.get('section') and id(u['chapter']) in chapter_heads
    appendix = u['chapter']['appendix']
    label = f'[{u["no"]} {u["title"]}]'
    cores = [b for b in u['blocks'] if b['type'] == '핵심']
    if is_head:
        if cores:
            err(f'{label} 장 머리에 핵심 블록이 있다 (절 안으로 옮길 것)')
        continue
    if not appendix:
        if not u['summary']:
            warn(f'{label} 요약이 없다') if u['no'] == '6' else err(f'{label} 요약이 없다')
        if not cores:
            warn(f'{label} 핵심 블록이 없다') if u['no'] == '6' else err(f'{label} 핵심 블록이 없다')
    n_core = 0
    if cores:
        if len(cores) > 1:
            err(f'{label} 핵심 블록이 {len(cores)}개다 (절당 1개)')
        n_core = len([l for l in cores[0]['lines'] if re.match(r'^\d+\.\s', l)])
        if n_core > 3:
            err(f'{label} 핵심 항목이 {n_core}개다 (최대 3개)')
    if cores and u.get('summary_text'):           # 요약이 핵심을 그대로 되풀이하면 경고
        items = [re.sub(r'^\d+\.\s*', '', l).replace('**', '') for l in cores[0]['lines'] if re.match(r'^\d+\.\s', l)]
        for sent in re.split(r'(?<=[.다])\s+', u['summary_text'].replace('**', '')):
            if sent and items and max(difflib.SequenceMatcher(None, sent, it).ratio() for it in items) > 0.85:
                warn(f'{label} 요약 문장이 핵심과 거의 같다 → "{sent[:30]}…"')
    for b in u['blocks']:
        if b['type'] == '세부':
            if not b['title']:
                err(f'{b["line"]}행 {label}: 세부에 제목이 없다')
            if b['link'] and not (1 <= b['link'] <= n_core):
                err(f'{b["line"]}행 {label}: →{b["link"]}이 가리키는 핵심이 없다 (핵심 {n_core}개)')
        if b['type'] in ('시각화', '시뮬레이터') and not b['title']:
            err(f'{b["line"]}행 {label}: {b["type"]}에 id가 없다')
    if not appendix and u['no'] != '6':
        stray = [no for no, l in u['free'] if not l.startswith('|')]
        if stray:
            warn(f'{label} 블록 밖 일반 텍스트 {len(stray)}줄 (첫 줄 {stray[0]}행)')

# 각주 짝
refs = set(re.findall(r'\[\^([\w-]+)\](?!:)', body))
refs.discard('키')
for k in sorted(refs - fn_defs.keys()):
    err(f'각주 [^{k}] 정의가 없다')
for k in sorted(fn_defs.keys() - refs):
    warn(f'각주 [^{k}]가 본문에서 쓰이지 않는다')

# 미해결 표시
for no, line in enumerate(lines, 1):
    for tag in re.findall(r'`([^`]*(?:확인필요|추정|링크 추가)[^`]*)`', line):
        warn(f'{no}행: `{tag}`')

# 시뮬레이터가 읽는 파라미터
params = dict(re.findall(r'^\|\s*([a-z][a-z0-9_]*)\s*\|\s*([0-9.,]+)\s*\|', body, re.M))
for k in SIM_KEYS:
    if k not in params:
        err(f'부록 C에 시뮬레이터 파라미터 {k}가 없다')

print(f'점검 대상: {SRC}  (기준일 {meta.get("기준일", "?")})')
for m in errors:
    print('  오류  ', m)
for m in warns:
    print('  경고  ', m)
print(f'오류 {len(errors)}건, 경고 {len(warns)}건')
sys.exit(1 if errors else 0)
