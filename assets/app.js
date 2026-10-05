/* ============================================================
   노후대비 가이드 — 렌더러
   content/guide.md → 콘텐츠 모델 → 정독/요점 모드 (설계 3~6장)
   ============================================================ */
(function () {
  'use strict';
  const root = document.documentElement;
  const mdi = window.markdownit({ html: true, linkify: false, typographer: false });
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 못 해도 동작 */ } },
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  /* ---------------- 1. 파싱 ---------------- */
  function parse(src) {
    const doc = { meta: {}, title: '', premise: [], chapters: [], footnotes: {}, fnOrder: [], glossary: [], params: {} };
    let text = src.replace(/\r\n/g, '\n');
    if (text.startsWith('---\n')) {
      const end = text.indexOf('\n---', 4);
      text.slice(4, end).split('\n').forEach((l) => { const m = l.match(/^([^:]+):\s*(.*)$/); if (m) doc.meta[m[1].trim()] = m[2].trim(); });
      text = text.slice(end + 4);
    }
    const lines = text.split('\n');
    let ch = null, sec = null, block = null, inFootnotes = false;
    const target = () => sec || (ch && ch.self) || null;
    const pushItem = (item) => {
      const t = target();
      if (!t) { if (item.type === '전제') doc.premise.push(item); return; }
      if (item.type === 'free') {
        const last = t.items[t.items.length - 1];
        if (last && last.type === 'free') { last.lines.push(...item.lines); return; }
      }
      t.items.push(item);
    };
    const newUnit = (no, title) => ({ no, title, summary: '', todo: '', items: [] });

    for (const line of lines) {
      if (block) {
        if (line.trim() === ':::') { pushItem(block); block = null; } else block.lines.push(line);
        continue;
      }
      let m;
      if ((m = line.match(/^\[\^([\w-]+)\]:\s*(.*)$/))) { doc.footnotes[m[1]] = m[2]; continue; }
      if ((m = line.match(/^:::\s*(\S+)(?:\s+"([^"]*)")?(?:\s*→\s*(\d+))?\s*$/))) {
        block = { type: m[1], title: m[2] || '', link: m[3] ? +m[3] : 0, lines: [] };
        continue;
      }
      if ((m = line.match(/^# (.+)$/))) {
        const h = m[1].trim();
        let mm;
        sec = null; inFootnotes = false;
        if ((mm = h.match(/^(\d+)\.\s+(.+)$/))) { ch = { no: mm[1], title: mm[2], self: newUnit(mm[1], mm[2]), sections: [] }; doc.chapters.push(ch); }
        else if ((mm = h.match(/^부록\s+([A-Z])\.\s*(.+)$/))) { ch = { no: '부록 ' + mm[1], title: mm[2], appendix: mm[1], self: newUnit('부록' + mm[1], mm[2]), sections: [] }; doc.chapters.push(ch); }
        else if (h === '각주') { ch = null; inFootnotes = true; }
        else if (!ch) { doc.title = h; }
        continue;
      }
      if ((m = line.match(/^## (\S+?)\.\s+(.+)$/)) && ch) { sec = newUnit(m[1], m[2]); ch.sections.push(sec); continue; }
      if (inFootnotes) continue;
      if (/^---\s*$/.test(line)) continue;
      const t = target();
      if (t && (m = line.match(/^요약:\s*(.*)$/))) { t.summary = m[1]; continue; }
      if (t && (m = line.match(/^할 일:\s*(.*)$/))) { t.todo = m[1]; continue; }
      if (!t) continue;                       // 첫 장 이전의 일반 텍스트는 렌더하지 않는다
      pushItem({ type: 'free', lines: [line] });
    }
    // 각주 번호: 본문에 처음 나오는 순서
    const seen = new Set();
    text.replace(/\[\^([\w-]+)\](?!:)/g, (_, k) => { if (!seen.has(k) && doc.footnotes[k] !== undefined) { seen.add(k); doc.fnOrder.push(k); } });
    // 부록 B 용어집, 부록 C 파라미터
    for (const c of doc.chapters) {
      const rows = [].concat(...c.self.items.filter((i) => i.type === 'free').map((i) => i.lines))
        .filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l)).map((l) => l.split('|').slice(1, -1).map((x) => x.trim()));
      if (c.appendix === 'B') rows.slice(1).forEach((r) => doc.glossary.push({ term: r[0], desc: r[1], where: r[2] }));
      if (c.appendix === 'C') rows.forEach((r) => { if (/^[a-z][a-z0-9_]*$/.test(r[0])) doc.params[r[0]] = parseFloat(r[1].replace(/,/g, '')); });
    }
    doc.params._asof = doc.meta['기준일'] || '';
    return doc;
  }

  /* ---------------- 2. 렌더링 ---------------- */
  let DOC = null;
  const mode = () => root.dataset.mode;
  const layout = () => root.dataset.layout;

  function fnMarkup(key) {
    const n = DOC.fnOrder.indexOf(key) + 1;
    if (!n) return '';
    if (mode() === 'read') return `<sup class="fnref"><a href="#fn-${key}" id="fnref-${key}" aria-label="각주 ${n}">${n}</a></sup>`;
    return `<sup class="fnref"><button type="button" data-fn="${key}" aria-label="각주 ${n}">${n}</button></sup>`;
  }
  // 한글 바로 앞뒤의 **굵게**는 CommonMark 규칙상 인식되지 않는 경우가 있어 직접 바꾼다
  const bold = (s) => s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  const withFn = (s) => bold(s).replace(/\[\^([\w-]+)\]/g, (_, k) => fnMarkup(k));
  // 목록 바로 뒤에 붙은 표는 목록에 흡수되므로, 표 앞뒤에 빈 줄을 넣는다
  const fixTables = (lines) => {
    const out = [];
    lines.forEach((l, i) => {
      const isT = /^\|/.test(l), prev = lines[i - 1];
      if (isT && prev !== undefined && prev.trim() && !/^\|/.test(prev)) out.push('');
      if (!isT && l.trim() && prev !== undefined && /^\|/.test(prev)) out.push('');
      out.push(l);
    });
    return out;
  };
  const md = (lines) => mdi.render(withFn(fixTables(Array.isArray(lines) ? lines : lines.split('\n')).join('\n')));
  const mdInline = (s) => mdi.renderInline(withFn(s));

  function allUnits() {
    const out = [];
    DOC.chapters.forEach((c) => { if (c.sections.length) c.sections.forEach((s) => out.push(s)); else out.push(c.self); });
    return out;
  }

  // 그림: 블록 내용(설명, '키: 값' 줄, 표)을 모아 두었다가 화면에 붙인 뒤 실제 폭으로 그린다
  const FIGS = [];
  function renderFig(item) {
    const id = item.title;
    const chart = window.GuideSim.charts[id];
    if (!chart) return '';                          // 아직 그리지 않은 그림은 공개 화면에 자리표시를 내지 않는다
    let caption = '';
    const kvAll = [], tableLines = [], notes = [];
    item.lines.forEach((l) => {
      let m;
      if (/^\|/.test(l)) tableLines.push(l);
      else if (/^- /.test(l)) notes.push(l);
      else if ((m = l.match(/^([^:|]{1,12}):\s*(.*)$/))) { if (m[1] === '설명') caption = m[2]; else kvAll.push([m[1].trim(), m[2].trim()]); }
    });
    const tbl = tableLines.filter((l) => !/^\|\s*-/.test(l)).map((l) => l.split('|').slice(1, -1).map((x) => x.trim()));
    const ctx = { header: tbl[0] || [], rows: tbl.slice(1), kv: Object.fromEntries(kvAll), kvAll };
    const k = FIGS.push({ id, ctx }) - 1;
    const assume = ctx.kv['가정'];
    return `<figure class="fig" data-fig="${k}"><div class="chart"></div><figcaption>${mdInline(caption)}${assume ? `<br>가정: ${mdInline(assume)}` : ''}${mode() === 'read' && notes.length ? md(notes) : ''}</figcaption></figure>`;
  }
  function mountFigs() {
    $$('figure[data-fig]').forEach((f) => {
      const { id, ctx } = FIGS[+f.dataset.fig];
      const el = $('.chart', f);
      const live = mode() === 'point' && window.GuideSim.live[id];
      try { window.GuideSim.charts[id](el, ctx, DOC.params, live); } catch (e) { el.innerHTML = ''; console.error(id, e); }
    });
  }

  function renderSim(item) {
    if (mode() === 'point') {
      if (item.title === 'contribution') return `<div class="sim sim-live" data-sim="contribution"></div>`;
      return '';                                     // 아직 만들지 않은 위젯은 숨긴다
    }
    const body = item.lines.filter((l) => !/^설명:/.test(l));
    return body.join('').trim() ? `<div class="detail">${md(body)}</div>` : '';
  }

  function renderChecklist(item, unit) {
    const items = item.lines.filter((l) => /^\d+\.\s/.test(l)).map((l) => l.replace(/^\d+\.\s/, ''));
    return `<ol class="checklist">${items.map((t, i) => {
      const k = `chk:${unit.no}:${i}`;
      return `<li><input type="checkbox" id="${k}" data-k="${k}"${store.get(k) === '1' ? ' checked' : ''}><label for="${k}">${mdInline(t)}</label></li>`;
    }).join('')}</ol>`;
  }

  function renderUnit(unit, opts) {
    const m = mode();
    const core = unit.items.find((i) => i.type === '핵심');
    const details = unit.items.filter((i) => i.type === '세부');
    let h = `<section class="sec" id="s-${unit.no}" data-no="${esc(unit.no)}" data-title="${esc(unit.title)}" data-summary="${esc(unit.summary.replace(/\*\*/g, ''))}"><div class="sec-main">`;
    if (!opts.chapterOnly) h += `<div class="sec-head"><span class="no">${esc(unit.no)}</span><h2>${esc(unit.title)}</h2></div>`;
    if (unit.summary) h += `<p class="summary">${mdInline(unit.summary)}</p>`;
    if (core) {
      let coreHtml = md(core.lines).replace(/^<ol[^>]*>/, '<ol class="core">');
      if (m === 'point') {
        // 좁은 화면용 '근거 N ▸' 칩 (연결된 세부 개수)
        const counts = {};
        details.forEach((d) => { if (d.link) counts[d.link] = (counts[d.link] || 0) + 1; });
        let idx = 0;
        coreHtml = coreHtml.replace(/<\/li>/g, () => { idx += 1; const c = counts[idx]; return (c ? `<button class="ev-chip" data-k="${idx}">근거 ${c} ▸</button>` : '') + '</li>'; });
      }
      h += coreHtml;
      const unlinked = details.filter((d) => !d.link).length;
      if (m === 'point' && unlinked) h += `<button class="ev-chip ev-all" data-k="0">이 절의 근거 ${unlinked} ▸</button>`;
    }
    unit.items.forEach((it) => {
      if (it.type === '핵심' || it.type === '메모' || it.type === '전제') return;
      if (it.type === '세부') { if (m === 'read') h += `<div class="detail"><h4 class="detail-title">${esc(it.title)}</h4>${md(it.lines)}</div>`; return; }
      if (it.type === '시각화') { h += renderFig(it); return; }
      if (it.type === '시뮬레이터') { h += renderSim(it); return; }
      if (it.type === '체크리스트') { h += renderChecklist(it, unit); return; }
      if (it.type === '문서판') { if (m === 'read') h += `<div class="free">${md(it.lines)}</div>`; return; }
      if (it.type === 'free') { const t = it.lines.join('\n').trim(); if (t) h += `<div class="free">${md(it.lines)}</div>`; }
    });
    if (unit.todo) {
      const k = `todo:${unit.no}`;
      h += `<div class="todo"><input type="checkbox" id="t-${esc(unit.no)}" data-k="${k}"${store.get(k) === '1' ? ' checked' : ''}><label for="t-${esc(unit.no)}"><span class="todo-label">할 일</span> ${mdInline(unit.todo)}</label></div>`;
    }
    if (opts.next) h += `<p class="next"><a href="#s-${opts.next.no}">다음 <span>${esc(opts.next.no)}</span> ${esc(opts.next.title)} →</a></p>`;
    h += `</div>`;
    if (m === 'point') {
      const ordered = details.filter((d) => d.link).sort((a, b) => a.link - b.link).concat(details.filter((d) => !d.link));
      h += `<aside class="margin" aria-label="${esc(unit.no)} 근거">${ordered.map((d, i) =>
        `<div class="ev" data-link="${d.link}" data-i="${details.indexOf(d)}"><button class="ev-title" aria-expanded="false">${esc(d.title)}</button><div class="ev-body" hidden>${md(d.lines)}</div></div>`).join('')}</aside>`;
    }
    return h + `</section>`;
  }

  function render() {
    FIGS.length = 0;
    const units = allUnits();
    const nextOf = (u) => units[units.indexOf(u) + 1];
    let h = `<header class="doc-head"><h1 class="doc-title">노후대비 가이드</h1>`;
    DOC.premise.forEach((p) => { h += `<div class="premise">${md(p.lines)}</div>`; });
    h += `</header>`;
    DOC.chapters.forEach((c) => {
      const single = !c.sections.length;
      h += `<article class="chapter" id="c-${esc(c.no.replace(/\s/g, ''))}"><header class="ch-head"><h1 class="ch-title"><span class="no">${esc(c.no)}</span>${esc(c.title)}</h1></header>`;
      if (single) h += renderUnit(c.self, { chapterOnly: true, next: nextOf(c.self) });
      else {
        c.self.items.forEach((it) => {
          if (it.type === '문서판' && mode() === 'read') h += `<div class="ch-intro sec-main">${md(it.lines)}</div>`;
          if (it.type === 'free' && it.lines.join('').trim()) h += `<div class="free sec-main">${md(it.lines)}</div>`;
        });
        c.sections.forEach((s) => { h += renderUnit(s, { next: nextOf(s) }); });
      }
      h += `</article>`;
    });
    if (mode() === 'read' && DOC.fnOrder.length) {
      h += `<section class="endnotes" id="endnotes"><h2>각주</h2><ol>${DOC.fnOrder.map((k) =>
        `<li id="fn-${k}">${mdi.renderInline(DOC.footnotes[k])} <a href="#fnref-${k}" aria-label="본문으로">↩</a></li>`).join('')}</ol></section>`;
    }
    $('#doc').innerHTML = h;
    mountFigs();
    $$('#doc a[href^="http"]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
    $$('.sim-live').forEach((el) => window.GuideSim.contribution(el, DOC.params));
    if (mode() === 'point') markTerms();
    renderNav();
    renderTodos();
    placeMargins();
    onScroll();
  }

  /* 용어: 부록 B에 적힌 절에서 처음 나오는 곳에만 점선 밑줄 */
  function markTerms() {
    DOC.glossary.forEach((g) => {
      const sec = document.getElementById('s-' + g.where) || document.getElementById('s-' + g.where.replace(/\s/g, ''));
      if (!sec) return;
      const variants = g.term.split(/\s*\/\s*/).filter(Boolean);
      const main = $('.sec-main', sec);
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement.closest('button, .sec-head, .fig, .sim, a, .term') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      let node;
      while ((node = walker.nextNode())) {
        const v = variants.find((x) => node.nodeValue.includes(x));
        if (!v) continue;
        const i = node.nodeValue.indexOf(v);
        const after = node.splitText(i); after.splitText(v.length);
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'term'; b.dataset.term = g.term; b.textContent = v;
        after.replaceWith(b);
        return;
      }
    });
  }

  function renderNav() {
    const tree = DOC.chapters.map((c) => {
      const cid = 'c-' + c.no.replace(/\s/g, '');
      const first = c.sections.length ? c.sections[0] : c.self;
      const secs = c.sections.map((s) => `<li class="n-sec"><a href="#s-${s.no}" data-no="${s.no}"><span class="no">${s.no}</span>${esc(s.title)}</a></li>`).join('');
      return `<li class="n-ch"><a href="#${c.sections.length ? cid : 's-' + first.no}" data-no="${c.sections.length ? '' : first.no}"><span class="no">${esc(c.no.replace('부록 ', ''))}</span>${esc(c.title)}</a>${secs ? `<ol>${secs}</ol>` : ''}</li>`;
    }).join('');
    $('#nav').innerHTML = `<ol>${tree}</ol>`;
    $('#tocBody').innerHTML = `<ol>${tree}</ol>`;
  }

  /* 할 일 모아 보기: 모든 절의 '할 일'을 한 목록으로. 체크 상태는 절 안의 카드와 같은 값을 쓴다 */
  function renderTodos() {
    const done = (k) => store.get(k) === '1';
    let total = 0, checked = 0, h = '<p class="todo-intro">이 글에서 실제로 해야 할 일만 모았다. 누르면 해당 절로 간다. 체크는 이 브라우저에만 저장된다.</p>';
    DOC.chapters.forEach((c) => {
      const units = (c.sections.length ? c.sections : [c.self]).filter((u) => u.todo);
      if (!units.length) return;
      h += `<h3 class="todo-ch"><span class="no">${esc(c.no)}</span>${esc(c.title)}</h3><ol class="todo-list">`;
      units.forEach((u) => {
        const k = `todo:${u.no}`; total += 1; if (done(k)) checked += 1;
        h += `<li><input type="checkbox" id="tp-${esc(u.no)}" data-k="${k}"${done(k) ? ' checked' : ''}><div><label for="tp-${esc(u.no)}">${mdInline(u.todo)}</label>
          <a class="todo-go" href="#s-${u.no}" data-go="${u.no}">${esc(u.no)} ${esc(u.title)} →</a>`;
        const cl = u.items.find((i) => i.type === '체크리스트');
        if (cl) {
          const items = cl.lines.filter((l) => /^\d+\.\s/.test(l)).map((l) => l.replace(/^\d+\.\s/, ''));
          h += `<ol class="todo-sub">${items.map((t, i) => { const kk = `chk:${u.no}:${i}`; return `<li><input type="checkbox" id="tp-${esc(u.no)}-${i}" data-k="${kk}"${done(kk) ? ' checked' : ''}><label for="tp-${esc(u.no)}-${i}">${mdInline(t)}</label></li>`; }).join('')}</ol>`;
        }
        h += `</div></li>`;
      });
      h += `</ol>`;
    });
    $('#todoBody').innerHTML = h;
    $('#todoCount').textContent = `${checked}/${total}`;
    $('#todoOpen').setAttribute('aria-label', `할 일 ${total}개 중 ${checked}개 완료. 모아 보기`);
  }
  function syncCheck(k, on) {
    store.set(k, on ? '1' : '0');
    $$(`input[data-k="${k}"]`).forEach((x) => { x.checked = on; });
    const all = $$('#todoBody input[data-k^="todo:"]');
    $('#todoCount').textContent = `${all.filter((x) => x.checked).length}/${all.length}`;
  }
  function openTodo() { $('#todoPanel').hidden = false; $('#todoBackdrop').hidden = false; history.pushState({ todo: 1 }, ''); $('#todoClose').focus(); }
  function closeTodo(fromPop) { if ($('#todoPanel').hidden) return; $('#todoPanel').hidden = true; $('#todoBackdrop').hidden = true; if (!fromPop) history.back(); }

  /* ---------------- 3. 여백 레인 배치 (넓은 화면) ---------------- */
  function placeMargins() {
    if (mode() !== 'point' || layout() === 'narrow') return;
    $$('.sec').forEach((sec) => {
      const aside = $('.margin', sec); if (!aside) return;
      const lis = $$('.core > li', sec);
      const base = aside.getBoundingClientRect().top;
      const lastTop = lis.length ? lis[lis.length - 1].getBoundingClientRect().top - base : 0;
      let cursor = 0;
      $$('.ev', aside).forEach((ev) => {
        const k = +ev.dataset.link;
        const desired = k && lis[k - 1] ? lis[k - 1].getBoundingClientRect().top - base : lastTop;
        const top = Math.max(desired, cursor);
        ev.style.top = top + 'px';
        cursor = top + ev.offsetHeight + 6;
      });
      aside.style.height = cursor + 'px';
    });
  }

  /* ---------------- 4. 위치 추적 ---------------- */
  let current = null;
  function onScroll() {
    const secs = $$('.sec');
    const y = ($('#topbar').offsetHeight || 52) + innerHeight * 0.3;   // 화면 위쪽 1/3 지점을 지나간 절이 '현재'
    let cur = null;                                   // 첫 절에 들어가기 전(문서 머리)에는 현재 절 없음
    for (const s of secs) { if (s.getBoundingClientRect().top <= y) cur = s; else break; }
    const max = document.documentElement.scrollHeight - innerHeight;
    $('#progress').style.width = (max > 0 ? Math.min(100, (scrollY / max) * 100) : 0) + '%';
    updateSticky();
    if (cur === current) return;
    current = cur;
    if (!cur) {
      $('#locNo').textContent = ''; $('#locTitle').textContent = '노후대비 가이드';
      $$('.nav a, .toc-body a').forEach((a) => a.setAttribute('aria-current', 'false'));
      updateSticky(); return;
    }
    const no = cur.dataset.no;
    $('#locNo').textContent = layout() === 'wide' ? '' : no;
    $('#locTitle').textContent = layout() === 'wide' ? '노후대비 가이드' : cur.dataset.title;
    const ss = $('#stickySum');
    $('.ss-no', ss).textContent = no;
    $('.ss-text', ss).textContent = cur.dataset.summary || cur.dataset.title;
    $$('.nav a, .toc-body a').forEach((a) => a.setAttribute('aria-current', String(a.dataset.no === no)));
    updateSticky();
  }

  /* 고정 요약 바: 현재 절의 요약이 화면 위로 지나간 뒤에만 보인다 (같은 문장이 두 번 보이지 않게) */
  function updateSticky() {
    const ss = $('#stickySum');
    let show = false;
    if (current) {
      const anchor = $('.summary', current) || $('.sec-head', current);
      show = !!anchor && anchor.getBoundingClientRect().bottom < ($('#topbar').offsetHeight || 52);
    }
    ss.classList.toggle('is-empty', !show);
  }

  /* ---------------- 5. 하단 시트 · 팝오버 ---------------- */
  const sheet = { list: [], i: 0, open: false };
  function openSheet(list, i, small, anchorEl) {
    closePop();
    sheet.list = list; sheet.i = i;
    $('#sheet').classList.toggle('small', !!small);
    if (anchorEl) {                                 // 연결된 핵심이 화면 위쪽에 오도록
      const top = anchorEl.getBoundingClientRect().top + scrollY - $('#topbar').offsetHeight - 12;
      window.scrollTo({ top, behavior: 'auto' });
    }
    $$('.core > li.hl').forEach((x) => x.classList.remove('hl'));
    if (anchorEl && anchorEl.matches('li')) anchorEl.classList.add('hl');
    drawSheet();
    $('#sheet').hidden = false; $('#sheetBackdrop').hidden = false;
    if (!sheet.open) { history.pushState({ sheet: 1 }, ''); sheet.open = true; }
    $('#sheetClose').focus({ preventScroll: true });
  }
  function drawSheet() {
    const it = sheet.list[sheet.i];
    $('#sheetTitle').textContent = it.title;
    $('#sheetBody').innerHTML = it.html;
    $('#sheetBody').scrollTop = 0;
    const multi = sheet.list.length > 1;
    $('#sheetPager').hidden = !multi;
    $('#sheetCount').textContent = `${sheet.i + 1}/${sheet.list.length}`;
    $$('#sheetBody a[href^="http"]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
  }
  function closeSheet(fromPop) {
    if (!sheet.open) return;
    $('#sheet').hidden = true; $('#sheetBackdrop').hidden = true; $('#sheet').style.transform = '';
    $$('.core > li.hl').forEach((x) => x.classList.remove('hl'));
    sheet.open = false;
    if (!fromPop) history.back();
  }
  function showPop(trigger, html) {
    const pop = $('#pop');
    pop.innerHTML = html; pop.hidden = false;
    const r = trigger.getBoundingClientRect();
    const w = Math.min(340, innerWidth - 24);
    pop.style.maxWidth = w + 'px';
    let left = r.left + scrollX - 12;
    left = Math.max(12, Math.min(left, scrollX + innerWidth - w - 12));
    pop.style.left = left + 'px';
    pop.style.top = (r.bottom + scrollY + 8) + 'px';
  }
  function closePop() { $('#pop').hidden = true; }

  function evList(sec, k) {
    const evs = $$('.ev', sec).filter((e) => (k ? +e.dataset.link === k : !+e.dataset.link));
    return evs.map((e) => ({ title: $('.ev-title', e).textContent, html: $('.ev-body', e).innerHTML }));
  }

  /* ---------------- 6. 이벤트 ---------------- */
  function bind() {
    document.addEventListener('click', (e) => {
      const t = e.target;
      const modeBtn = t.closest('.mode button');
      if (modeBtn) { setMode(modeBtn.dataset.mode); return; }
      const evt = t.closest('.ev-title');
      if (evt) {
        const ev = evt.parentElement, body = $('.ev-body', ev), open = body.hidden;
        body.hidden = !open; ev.classList.toggle('open', open); evt.setAttribute('aria-expanded', String(open));
        placeMargins(); return;
      }
      const chip = t.closest('.ev-chip');
      if (chip) {
        const sec = chip.closest('.sec'); const k = +chip.dataset.k;
        const anchor = k ? $$('.core > li', sec)[k - 1] : $('.core', sec);
        openSheet(evList(sec, k), 0, false, anchor); return;
      }
      const fn = t.closest('[data-fn]');
      if (fn) {
        const k = fn.dataset.fn, n = DOC.fnOrder.indexOf(k) + 1;
        const html = `<p>${mdi.renderInline(DOC.footnotes[k])}</p>`;
        if (layout() === 'narrow') openSheet([{ title: `각주 ${n}`, html }], 0, true); else showPop(fn, html);
        e.stopPropagation(); return;
      }
      const term = t.closest('.term');
      if (term) {
        const g = DOC.glossary.find((x) => x.term === term.dataset.term);
        const html = `<p><strong>${esc(g.term)}</strong> — ${esc(g.desc)}</p>`;
        if (layout() === 'narrow') openSheet([{ title: g.term, html }], 0, true); else showPop(term, html);
        e.stopPropagation(); return;
      }
      if (!t.closest('#pop')) closePop();
      const go = t.closest('.todo-go');
      if (go) { e.preventDefault(); closeTodo(); setTimeout(() => document.getElementById('s-' + go.dataset.go)?.scrollIntoView(), 30); return; }
      const navA = t.closest('#tocBody a');
      if (navA) { closeToc(); }
    });
    document.addEventListener('change', (e) => {
      const c = e.target.closest('input[type="checkbox"][data-k]');
      if (c) syncCheck(c.dataset.k, c.checked);
    });
    // 핵심 ↔ 근거 연결 강조 (넓은 화면)
    document.addEventListener('mouseover', (e) => {
      if (sheet.open) return;
      $$('.hl').forEach((x) => x.classList.remove('hl'));
      const ev = e.target.closest('.ev');
      const li = e.target.closest('.core > li');
      if (ev && +ev.dataset.link) { const l = $$('.core > li', ev.closest('.sec'))[+ev.dataset.link - 1]; if (l) l.classList.add('hl'); ev.classList.add('hl'); }
      if (li && mode() === 'point' && layout() !== 'narrow') {
        const k = $$('.core > li', li.closest('.sec')).indexOf(li) + 1;
        $$(`.ev[data-link="${k}"]`, li.closest('.sec')).forEach((x) => x.classList.add('hl'));
      }
    });
    $('#tocOpen').addEventListener('click', () => { if (layout() !== 'wide') openToc(); });
    $('#tocClose').addEventListener('click', () => closeToc());
    $('#todoOpen').addEventListener('click', openTodo);
    $('#todoClose').addEventListener('click', () => closeTodo());
    $('#todoBackdrop').addEventListener('click', () => closeTodo());
    $('#sheetClose').addEventListener('click', () => closeSheet());
    $('#sheetBackdrop').addEventListener('click', () => closeSheet());
    $('#sheetPrev').addEventListener('click', () => { sheet.i = (sheet.i - 1 + sheet.list.length) % sheet.list.length; drawSheet(); });
    $('#sheetNext').addEventListener('click', () => { sheet.i = (sheet.i + 1) % sheet.list.length; drawSheet(); });
    window.addEventListener('popstate', () => { if (sheet.open) closeSheet(true); if (!$('#toc').hidden) closeToc(true); closeTodo(true); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      closePop(); if (sheet.open) closeSheet(); if (!$('#toc').hidden) closeToc(); closeTodo();
    });
    // 시트 손잡이를 아래로 끌어 닫기
    let y0 = null;
    const grip = $('#sheetGrip');
    grip.addEventListener('pointerdown', (e) => { y0 = e.clientY; grip.setPointerCapture(e.pointerId); });
    grip.addEventListener('pointermove', (e) => { if (y0 === null) return; const d = Math.max(0, e.clientY - y0); $('#sheet').style.transform = `translateY(${d}px)`; });
    grip.addEventListener('pointerup', (e) => { const d = e.clientY - y0; y0 = null; if (d > 80) closeSheet(); else $('#sheet').style.transform = ''; });
    let raf = 0;
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; onScroll(); }); }, { passive: true });
    window.addEventListener('resize', () => { const before = layout(); computeLayout(); if (layout() !== before) { const at = current && current.id; render(); if (at) document.getElementById(at)?.scrollIntoView(); } else { redrawFigs(); placeMargins(); } });
    window.addEventListener('beforeprint', () => { if (mode() === 'point') { root.dataset.printSwap = '1'; root.dataset.mode = 'read'; render(); } });
    window.addEventListener('afterprint', () => { if (root.dataset.printSwap) { delete root.dataset.printSwap; root.dataset.mode = 'point'; render(); } });
  }

  // 폭이 바뀌면 그림만 다시 그린다 (조작 중인 값은 유지)
  let lastW = 0;
  function redrawFigs() {
    const w = $('#doc').clientWidth; if (Math.abs(w - lastW) < 8) return; lastW = w;
    $$('figure[data-fig]').forEach((f) => {
      const { id, ctx } = FIGS[+f.dataset.fig]; const el = $('.chart', f);
      if (window.GuideSim.live[id] && mode() === 'point') { const st = el._st; window.GuideSim.charts[id](el, ctx, DOC.params, true); if (st) el._st = st; }
      else window.GuideSim.charts[id](el, ctx, DOC.params, false);
    });
  }

  function openToc() { $('#toc').hidden = false; history.pushState({ toc: 1 }, ''); $('#tocClose').focus(); const cur = $('.toc-body a[aria-current="true"]'); if (cur) cur.scrollIntoView({ block: 'center' }); }
  function closeToc(fromPop) { if ($('#toc').hidden) return; $('#toc').hidden = true; if (!fromPop) history.back(); }

  function setMode(m) {
    if (m === mode()) return;
    const at = current && current.id;
    root.dataset.mode = m; store.set('mode', m);
    $$('.mode button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    current = null; render();
    if (at) document.getElementById(at)?.scrollIntoView();
  }

  /* 레이아웃 전환: 기기 종류가 아니라 '본문 한 줄 + 레인 폭이 들어가는가' (설계 6-5) */
  function computeLayout() {
    const cs = getComputedStyle(root);
    const px = (v) => parseFloat(cs.getPropertyValue(v));
    const body = px('--measure-chars') * px('--char-w') * px('--fs-body');
    const w = root.clientWidth;
    const need3 = px('--pad') * 2 + px('--nav-w') + px('--gap') + body + px('--gap') + px('--margin-w');
    const need2 = px('--pad') * 2 + body + px('--gap') + px('--margin-w');
    root.dataset.layout = w >= need3 ? 'wide' : w >= need2 ? 'mid' : 'narrow';
  }

  async function init() {
    const m = new URLSearchParams(location.search).get('mode') || store.get('mode') || 'point';
    root.dataset.mode = m === 'read' ? 'read' : 'point';
    $$('.mode button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === root.dataset.mode)));
    computeLayout();
    const inline = document.getElementById('guide-src');
    const src = inline ? inline.textContent : await (await fetch('content/guide.md', { cache: 'no-cache' })).text();
    DOC = parse(src);
    bind();
    render();
    // 글꼴이 늦게 도착하면 배치가 바뀌므로 위치 추적과 여백 레인을 다시 계산한다
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { placeMargins(); current = undefined; onScroll(); });
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }
  init().catch((e) => { $('#doc').innerHTML = `<p>내용을 불러오지 못했다: ${esc(e.message)}</p>`; console.error(e); });
})();
