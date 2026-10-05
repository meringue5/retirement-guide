/* ============================================================
   시뮬레이터와 그림. 숫자는 원본 md(그림 블록의 표, 부록 C)에서만 받는다(설계 7장).
   그림은 실제 화면 폭에 맞춰 그린다 — 글자가 화면에서 늘 같은 크기로 보이게.
   ============================================================ */
(function () {
  'use strict';
  const won = (manwon) => {
    if (Math.abs(manwon) >= 10000) return (manwon / 10000).toFixed(1).replace(/\.0$/, '') + '억원';
    return Math.round(manwon).toLocaleString('ko-KR') + '만원';
  };
  const fv = (monthly, rate, years) => { if (years <= 0) return 0; const i = rate / 12, n = years * 12; return monthly * ((Math.pow(1 + i, n) - 1) / i); };
  const num = (s) => parseFloat(String(s).replace(/[,억원만%+\s]/g, '').replace('−', '-'));
  let uid = 0;

  /* ---------- 그리기 도구 ---------- */
  const T = (x, y, t, o = {}) =>
    `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${o.fs || 13}" fill="${o.fill || 'var(--ink-muted)'}" text-anchor="${o.anchor || 'start'}"${o.w ? ` font-weight="${o.w}"` : ''}${o.base ? ` dominant-baseline="${o.base}"` : ''}>${t}</text>`;
  const svg = (w, h, inner, aria) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${aria}">${inner}</svg>`;
  function monotone(pts) {                         // 단조 3차 보간 (Fritsch–Carlson): 점 사이에서 튀지 않는 곡선
    const n = pts.length; if (n < 2) return '';
    const dx = [], dy = [], m = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; m[i] = dy[i] / dx[i]; }
    const t = [m[0]];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    t[n - 1] = m[n - 2];
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += `C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + t[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - t[i + 1] * h).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
    }
    return d;
  }
  const linePath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const W = (el) => Math.max(280, Math.min(el.clientWidth || 600, 760));

  /* 꺾은선 공통: x 숫자축, 여러 계열, 기준선, 끝점 라벨 */
  function lineChart(el, o) {
    const w = W(el), h = o.h || Math.round(Math.min(340, Math.max(230, w * 0.52)));
    const L = o.left || 44, R = o.right || 92, Tp = 26, B = 34;
    const xs = o.x, x0 = Math.min(...xs), x1 = Math.max(...xs);
    const X = (v) => L + (w - L - R) * (v - x0) / (x1 - x0);
    const Y = (v) => Tp + (h - Tp - B) * (1 - (v - o.yMin) / (o.yMax - o.yMin));
    let g = '';
    (o.yTicks || []).forEach((v) => { g += `<line x1="${L}" x2="${w - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--rule)" stroke-width="1"/>` + T(L - 8, Y(v), o.yFmt(v), { anchor: 'end', base: 'middle', fs: 12 }); });
    (o.xTicks || xs).forEach((v) => { g += T(X(v), h - 10, o.xFmt ? o.xFmt(v) : v, { anchor: 'middle', fs: 12 }); });
    if (o.band) {
      const top = xs.map((v, i) => [X(v), Y(o.band.hi[i])]), bot = xs.map((v, i) => [X(v), Y(o.band.lo[i])]).reverse();
      g += `<path d="${linePath(top)}${linePath(bot).replace('M', 'L')}Z" fill="${o.band.color}" fill-opacity=".14"/>`;
    }
    (o.refs || []).forEach((r) => { g += `<line x1="${L}" x2="${w - R}" y1="${Y(r.y)}" y2="${Y(r.y)}" stroke="var(--ink-faint)" stroke-dasharray="4 4"/>` + (r.label ? T(L + 4, Y(r.y) - 6, r.label, { fs: 12 }) : ''); });
    const ends = [];
    o.series.forEach((s) => {
      const pts = xs.map((v, i) => [X(v), Y(s.ys[i])]);
      g += `<path d="${o.smooth === false ? linePath(pts) : monotone(pts)}" fill="none" stroke="${s.color}" stroke-width="2.2"${s.dash ? ' stroke-dasharray="5 4"' : ''}/>`;
      if (o.dots) pts.forEach((p, i) => { g += `<circle cx="${p[0]}" cy="${p[1]}" r="3.2" fill="${s.color}"><title>${s.name} ${o.xFmt ? o.xFmt(xs[i]) : xs[i]}: ${o.yFmt(s.ys[i])}</title></circle>`; });
      const last = pts[pts.length - 1];
      g += `<circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${s.color}" stroke="var(--paper)" stroke-width="2"/>`;
      ends.push({ y: last[1], x: last[0], s });
    });
    ends.sort((a, b) => a.y - b.y);                // 끝 라벨이 겹치지 않게 아래로 민다
    let prev = -1e9;
    ends.forEach((e) => {
      const y = Math.max(e.y, prev + 30); prev = y;
      g += T(e.x + 10, y - 3, e.s.name, { fs: 12.5 }) + T(e.x + 10, y + 13, o.yFmt(e.s.ys[e.s.ys.length - 1], true), { fs: 13.5, fill: 'var(--ink-strong)', w: 600 });
    });
    el.innerHTML = svg(w, h, g, o.aria);
  }

  /* ---------- 그림들 ---------- */
  const charts = {};

  // 2-1 인생의 손익계산서
  charts.lifecycle = (el, ctx) => {
    const rows = ctx.rows.map((r) => ({ age: num(r[0]), v: num(r[1]), kind: r[2] || '' }));
    const life = num(ctx.kv['기대수명'] || 0);
    const w = W(el), narrow = w < 460, h = narrow ? 310 : Math.round(Math.min(360, Math.max(250, w * 0.56)));
    const L = 50, R = 16, Tp = 30, B = 34;
    const vmin = Math.min(...rows.map((r) => r.v)), vmax = Math.max(...rows.map((r) => r.v));
    const yMin = Math.floor(vmin * 1.15 / 1000) * 1000, yMax = Math.ceil(vmax * 1.45 / 1000) * 1000;
    const X = (a) => L + (w - L - R) * a / 90, Y = (v) => Tp + (h - Tp - B) * (1 - (v - yMin) / (yMax - yMin));
    const id = 'lc' + (++uid);
    const pts = rows.map((r) => [X(r.age), Y(r.v)]);
    const curve = monotone(pts);
    const area = `${curve}L${pts[pts.length - 1][0]},${Y(0)}L${pts[0][0]},${Y(0)}Z`;
    let g = `<defs><clipPath id="${id}a"><rect x="0" y="0" width="${w}" height="${Y(0)}"/></clipPath><clipPath id="${id}b"><rect x="0" y="${Y(0)}" width="${w}" height="${h}"/></clipPath></defs>`;
    for (let v = yMin; v <= yMax; v += 2000) g += `<line x1="${L}" x2="${w - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--rule)"/>` + T(L - 8, Y(v), v.toLocaleString('ko-KR'), { anchor: 'end', base: 'middle', fs: 12 });
    for (let a = 0; a <= 90; a += narrow ? 20 : 10) g += T(X(a), h - 10, a === 90 || (narrow && a === 80) ? a + '세' : a, { anchor: a === 90 ? 'end' : 'middle', fs: 12 });
    g += T(L - 8, Tp - 12, '만원/년', { anchor: 'end', fs: 11.5 });
    g += `<path d="${area}" fill="var(--chart-1)" fill-opacity=".22" clip-path="url(#${id}a)"/><path d="${area}" fill="var(--chart-2)" fill-opacity=".16" clip-path="url(#${id}b)"/>`;
    g += `<line x1="${L}" x2="${w - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--ink-muted)"/>`;
    g += `<path d="${curve}" fill="none" stroke="var(--ink)" stroke-width="2.2"/>`;
    if (life) g += `<line x1="${X(life)}" x2="${X(life)}" y1="${Tp}" y2="${h - B}" stroke="var(--ink-faint)" stroke-dasharray="4 4"/>` + T(X(life) - 6, h - B - 8, `기대수명 ${life}세`, { anchor: 'end', fs: 12 });
    const real = rows.map((r, i) => ({ ...r, i })).filter((r) => r.kind.startsWith('실측'));
    const minV = Math.min(...real.map((r) => r.v));
    real.forEach((r) => {
      const [x, y] = pts[r.i], prev = rows[r.i - 1], next = rows[r.i + 1];
      const label = r.kind.replace(/^실측:\s*/, '');
      const val = (r.v > 0 ? '+' : '') + r.v.toLocaleString('ko-KR') + '만원';
      let ax = 'start', dx = 9, dy = -11;
      if (r.v === minV) { dx = 11; dy = 5; }
      else if (prev && next && prev.v < r.v && next.v < r.v) { ax = 'middle'; dx = 0; dy = -12; }
      else if (prev && prev.v < r.v) { ax = 'end'; dx = -9; }
      g += `<circle cx="${x}" cy="${y}" r="5" fill="var(--ink-strong)" stroke="var(--paper)" stroke-width="2"><title>${r.age}세 ${label} ${val}</title></circle>`;
      const two = w < 460 && ax !== 'middle';
      if (two) g += T(x + dx, y + dy - 15, `${r.age}세 ${label}`, { anchor: ax, fs: 12.5, fill: 'var(--ink)' }) + T(x + dx, y + dy, val, { anchor: ax, fs: 12.5, fill: 'var(--ink-strong)', w: 600 });
      else g += `<text x="${(x + dx).toFixed(1)}" y="${(y + dy).toFixed(1)}" font-size="12.5" fill="var(--ink)" text-anchor="${ax}">${r.age}세 ${label} <tspan font-weight="600" fill="var(--ink-strong)">${val}</tspan></text>`;
    });
    const s = real.find((r) => /흑자 진입/.test(r.kind)), e = real.find((r) => /다시 적자/.test(r.kind));
    if (s && e) {
      const fs = narrow ? 13 : 15;
      g += T(X((s.age + e.age) / 2), Y(vmax * 0.22), `흑자 ${e.age - s.age}년`, { anchor: 'middle', fs, w: 600, fill: 'var(--ink-strong)' });
      const yrs = Math.round(life - e.age);
      if (life && narrow) g += T(X(life) - 6, Y(vmin * 0.07) + fs, '노후 적자', { anchor: 'end', fs, w: 600, fill: 'var(--ink-strong)' }) + T(X(life) - 6, Y(vmin * 0.07) + fs * 2 + 3, `약 ${yrs}년`, { anchor: 'end', fs, w: 600, fill: 'var(--ink-strong)' });
      else if (life) g += T(X((e.age + Math.min(life, 90)) / 2 + 3), Y(vmin * 0.07) + fs, `노후 적자 약 ${yrs}년`, { anchor: 'middle', fs, w: 600, fill: 'var(--ink-strong)' });
    }
    el.innerHTML = svg(w, h, g, '연령별 1인당 생애주기 흑자와 적자 개념도');
  };

  // 2-2 구매력
  charts.inflation = (el, ctx) => {
    const xs = ctx.rows.map((r) => num(r[0]));
    const names = ctx.header.slice(1);
    const colors = ['var(--chart-1)', 'var(--chart-2)'];
    lineChart(el, {
      x: xs, yMin: 0, yMax: 1, yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: (v, end) => (end ? v.toFixed(2) + '억' : v.toFixed(2).replace(/0$/, '') + '억'),
      xFmt: (v) => (v === 0 ? '지금' : v + '년'), xTicks: xs.filter((v) => v % 10 === 0 || v === xs[xs.length - 1]),
      refs: [{ y: 0.5, label: '구매력 절반' }],
      series: names.map((n, k) => ({ name: n, ys: ctx.rows.map((r) => num(r[k + 1])), color: colors[k] })),
      aria: '지금 1억원의 구매력이 물가 2%와 3%에서 줄어드는 곡선',
    });
  };

  // 2-3 어느 탱크에서 돈이 나오나
  charts['three-layers'] = (el, ctx) => {
    const tanks = ctx.rows.map((r) => ({ name: r[0], a: num(r[1]), b: num(r[2]), memo: r[3] || '' }));
    const bands = ctx.kvAll.filter(([k]) => k === '구간').map(([, v]) => { const p = v.split(',').map((x) => x.trim()); return { a: num(p[0]), b: num(p[1]), label: p.slice(2).join(',') }; });
    const w = W(el), rowH = 46, Tp = 60, B = 30, L = 10, R = 12;
    const h = Tp + tanks.length * rowH + B;
    const a0 = 50, a1 = 90, X = (a) => L + (w - L - R) * (a - a0) / (a1 - a0);
    let g = '';
    bands.forEach((b, i) => {
      const fill = i === 0 ? 'var(--chart-2)' : 'var(--ink-faint)';
      g += `<rect x="${X(b.a)}" y="${Tp - 14}" width="${X(b.b) - X(b.a)}" height="${h - Tp - B + 14}" fill="${fill}" fill-opacity="${i === 0 ? 0.13 : 0.1}"/>`;
      g += T(i === 0 ? X(b.a) + 2 : X(b.b) - 4, 16 + i * 18, b.label, { anchor: i === 0 ? 'start' : 'end', fs: 12, fill: 'var(--ink)' });
    });
    [55, 61, 65, 70, 75, 80, 90].forEach((a) => { g += T(X(a), h - 8, a, { anchor: 'middle', fs: 12 }) + `<line x1="${X(a)}" x2="${X(a)}" y1="${h - B}" y2="${h - B + 4}" stroke="var(--ink-faint)"/>`; });
    g += `<line x1="${L}" x2="${w - R}" y1="${h - B}" y2="${h - B}" stroke="var(--rule)"/>`;
    tanks.forEach((t, i) => {
      const y = Tp + i * rowH;
      const color = i === tanks.length - 1 ? 'var(--chart-neutral)' : 'var(--chart-1)';
      g += `<text x="${X(t.a).toFixed(1)}" y="${(y + 12).toFixed(1)}" font-size="13" fill="var(--ink-strong)" font-weight="600">${t.name}${t.memo ? `<tspan font-weight="400" fill="var(--ink-muted)" font-size="12"> · ${t.memo}</tspan>` : ''}</text>`;
      g += `<rect x="${X(t.a)}" y="${y + 18}" width="${Math.max(4, X(t.b) - X(t.a))}" height="14" rx="4" fill="${color}" fill-opacity="${i === tanks.length - 1 ? 1 : 0.55 + 0.15 * (tanks.length - 2 - i)}"><title>${t.name}: ${t.a}~${t.b}세 ${t.memo}</title></rect>`;
    });
    el.innerHTML = svg(w, h, g, '나이에 따라 국민연금·퇴직연금·개인연금·ISA에서 돈이 나오는 구간');
  };

  // 3-2 계좌별 세후 결과 (막대)
  charts['tax-deferral'] = (el, ctx) => {
    const lab = ['낸 돈 (원금)', '일반계좌 세후', '연금계좌 세후', '연금계좌 + 환급 재투자'];
    const rows = ctx.rows.slice(0, 4).map((r, i) => ({ label: lab[i] || r[0], v: num(r[1]), text: r[1] }));
    const w = W(el), narrow = w < 480;
    const h = narrow ? 300 : 290, Tp = 30, B = narrow ? 56 : 40, gap = narrow ? 14 : 26;
    const n = rows.length, bw = Math.min(110, (w - gap * (n + 1)) / n);
    const x0 = (w - (n * bw + (n - 1) * gap)) / 2;
    const max = Math.max(...rows.map((r) => r.v)) * 1.1;
    const Y = (v) => Tp + (h - Tp - B) * (1 - v / max);
    let g = '';
    rows.forEach((r, i) => {
      const x = x0 + i * (bw + gap), top = Y(r.v);
      const fill = i === 0 ? 'var(--chart-neutral)' : 'var(--chart-1)';
      g += `<rect x="${x}" y="${top}" width="${bw}" height="${h - B - top}" rx="4" fill="${fill}" fill-opacity="${i === 0 ? 1 : 0.5 + 0.25 * (i - 1)}"><title>${r.label}: ${r.text}</title></rect>`;
      g += T(x + bw / 2, top - 8, r.text, { anchor: 'middle', fs: 14, w: 600, fill: 'var(--ink-strong)' });
      const words = narrow ? r.label.split(' ') : [r.label.replace(' + ', ' + ')];
      const lines = narrow ? (words.length > 2 ? [words.slice(0, 1).join(' '), words.slice(1).join(' ')] : words) : [r.label];
      lines.forEach((ln, j) => { g += T(x + bw / 2, h - B + 18 + j * 16, ln, { anchor: 'middle', fs: narrow ? 11.5 : 12.5 }); });
    });
    g += `<line x1="${x0 - gap / 2}" x2="${x0 + n * bw + (n - 1) * gap + gap / 2}" y1="${h - B}" y2="${h - B}" stroke="var(--rule)"/>`;
    el.innerHTML = svg(w, h, g, '같은 돈을 30년 굴렸을 때 계좌별 세후 결과');
  };

  // 3-4 ISA 순환 (HTML로: 글이 자연스럽게 줄바꿈되도록)
  charts['isa-cycle'] = (el, ctx) => {
    const s = ctx.rows.map((r) => ({ t: r[0], d: r[1] }));
    if (s.length !== 4) { el.innerHTML = ''; return; }
    const box = (x, i) => `<div class="cy-box"><span class="cy-no">${i + 1}</span><strong>${x.t}</strong><span>${x.d}</span></div>`;
    el.innerHTML = `<div class="cycle" role="img" aria-label="ISA 개설, 3년 굴리기, 연금계좌로 이전, 새 ISA 개설을 되풀이하는 순환">
      ${box(s[0], 0)}<div class="cy-arr" aria-hidden="true">→</div>${box(s[1], 1)}
      <div class="cy-arr cy-v" aria-hidden="true">↑</div><div></div><div class="cy-arr cy-v" aria-hidden="true">↓</div>
      ${box(s[3], 3)}<div class="cy-arr" aria-hidden="true">←</div>${box(s[2], 2)}</div>`;
  };

  // 4-1 복리 (요점 모드: 조작 가능)
  charts.compound = (el, ctx, P, live) => {
    const lo = P.return_low, hi = P.return_high;
    const st = el._st || (el._st = { m: 50, y: P.sim_years || 30 });
    let ctrl = '';
    if (live) {
      const id = 'cp' + (++uid);
      ctrl = `<div class="fig-ctrl">
        <label for="${id}m">월 납입액 <output>${st.m}만원</output></label><input id="${id}m" data-k="m" type="range" min="10" max="200" step="10" value="${st.m}">
        <label for="${id}y">기간 <output>${st.y}년</output></label><input id="${id}y" data-k="y" type="range" min="5" max="40" step="1" value="${st.y}"></div>`;
    }
    el.innerHTML = ctrl + '<div class="chart-c"></div><p class="fig-read" aria-live="polite"></p>';
    const draw = () => {
      const xs = Array.from({ length: st.y + 1 }, (_, i) => i);
      const yHi = fv(st.m, hi, st.y), maxV = yHi * 1.05;
      const step = [1000, 2000, 5000, 10000, 20000, 50000].find((s) => maxV / s <= 5) || 100000;
      const ticks = []; for (let v = 0; v <= maxV; v += step) ticks.push(v);
      lineChart(el.querySelector('.chart-c'), {
        x: xs, yMin: 0, yMax: Math.max(maxV, ticks[ticks.length - 1]), yTicks: ticks, yFmt: (v) => (v === 0 ? '0' : won(v).replace('원', '')), left: 52, right: 96,
        xTicks: xs.filter((v) => v % (st.y > 20 ? 10 : 5) === 0 || v === st.y), xFmt: (v) => v + '년',
        band: { lo: xs.map((t) => fv(st.m, lo, t)), hi: xs.map((t) => fv(st.m, hi, t)), color: 'var(--chart-1)' },
        series: [
          { name: `연 ${Math.round(hi * 100)}%`, ys: xs.map((t) => fv(st.m, hi, t)), color: 'var(--chart-1)' },
          { name: `연 ${Math.round(lo * 100)}%`, ys: xs.map((t) => fv(st.m, lo, t)), color: 'var(--chart-1)', dash: true },
          { name: '낸 돈', ys: xs.map((t) => st.m * 12 * t), color: 'var(--chart-neutral)' },
        ],
        aria: `월 ${st.m}만원을 ${st.y}년 적립할 때 불어나는 곡선`,
      });
      const half = Math.max(1, Math.round(st.y / 2));
      el.querySelector('.fig-read').innerHTML = `${st.y}년 뒤 <b>${won(fv(st.m, lo, st.y))} ~ ${won(fv(st.m, hi, st.y))}</b> (낸 돈 ${won(st.m * 12 * st.y)}). `
        + `같은 돈을 ${half}년만 넣으면 ${won(fv(st.m, lo, half))} ~ ${won(fv(st.m, hi, half))}. 기간이 절반이면 결과는 약 ${(fv(st.m, hi, st.y) / fv(st.m, hi, half)).toFixed(1)}분의 1로 줄어든다.`;
      el.querySelectorAll('output')[0] && (el.querySelectorAll('output')[0].textContent = `${st.m}만원`);
      el.querySelectorAll('output')[1] && (el.querySelectorAll('output')[1].textContent = `${st.y}년`);
    };
    el.querySelectorAll('input[type=range]').forEach((inp) => inp.addEventListener('input', () => { st[inp.dataset.k] = +inp.value; draw(); }));
    draw();
  };

  // 4-3 레버리지가 녹는 모양
  charts['leverage-decay'] = (el, ctx) => {
    const xs = ctx.rows.map((_, i) => i);
    const names = ctx.header.slice(1);
    const series = names.map((n, k) => ({ name: n === '1배' ? '1배 (지수)' : n, ys: ctx.rows.map((r) => num(r[k + 1])), color: k ? 'var(--chart-2)' : 'var(--chart-1)' }));
    const all = series.flatMap((s) => s.ys), lo = Math.floor(Math.min(...all) / 10) * 10, hi = Math.ceil(Math.max(...all) / 10) * 10;
    const ticks = []; for (let v = lo; v <= hi; v += 10) ticks.push(v);
    lineChart(el, {
      x: xs, yMin: lo, yMax: hi, yTicks: ticks, yFmt: (v) => (Number.isInteger(v) ? v : v.toFixed(1)), smooth: false, dots: true,
      xTicks: xs, xFmt: (i) => (i === 0 ? '시작' : String(i)),
      refs: [{ y: 100, label: '' }],
      series, aria: '지수가 오르내림을 반복할 때 1배와 2배 레버리지 잔고',
    });
  };

  /* ---------- 납입 시뮬레이터 (설계 7-1) ---------- */
  function contribution(root, P) {
    const M = (k) => P[k] / 10000 / 12;
    const psCap = M('pension_saving_credit_limit');
    const creditCap = P.pension_credit_limit / 10000;
    const irpCap = (P.pension_credit_limit - P.pension_saving_credit_limit) / 10000 / 12;
    const isaCap = M('isa_annual_limit');
    const depositCap = M('pension_deposit_limit');
    const st = { m: 50, high: false, lump: false };
    const id = 'sim' + (++uid);
    root.innerHTML = `
      <h4>내 돈은 어디에 얼마씩?</h4>
      <div class="sim-row"><label for="${id}m">월 납입 가능액</label>
        <input id="${id}m" type="range" min="10" max="300" step="5" value="${st.m}">
        <output id="${id}mo"></output></div>
      <div class="sim-row"><span class="lbl">총급여</span>
        <span class="seg" data-k="high"><button aria-pressed="true" data-v="0">5,500만원 이하</button><button aria-pressed="false" data-v="1">초과</button></span></div>
      <div class="sim-row"><span class="lbl">5~10년 안에 목돈 쓸 일</span>
        <span class="seg" data-k="lump"><button aria-pressed="false" data-v="1">있음</button><button aria-pressed="true" data-v="0">없음</button></span></div>
      <div class="alloc" id="${id}a" aria-live="polite"></div>
      <div class="sim-out" id="${id}o" aria-live="polite"></div>
      <p class="sim-note">수익률 연 ${Math.round(P.return_low * 100)}~${Math.round(P.return_high * 100)}% 가정. 약속이 아니라 가정이다. 세법 기준일 ${P._asof || ''}.</p>`;
    const $ = (s) => root.querySelector(s);
    $('#' + id + 'm').addEventListener('input', (e) => { st.m = +e.target.value; draw(); });
    root.querySelectorAll('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      st[seg.dataset.k] = b.dataset.v === '1'; draw();
    }));
    function draw() {
      let r = st.m;
      const ps = Math.min(r, psCap); r -= ps;
      let isa = 0, irp = 0;
      if (st.lump) { isa = Math.min(r, isaCap); r -= isa; irp = Math.min(r, irpCap); r -= irp; }
      else { irp = Math.min(r, irpCap); r -= irp; isa = Math.min(r, isaCap); r -= isa; }
      const extra = Math.min(r, Math.max(0, depositCap - ps - irp)); r -= extra;
      const rows = [['연금저축', ps], ['IRP', irp], ['ISA', isa], ['연금저축 추가', extra], ['한도 밖', r]].filter((x) => x[1] > 0.0001);
      const max = Math.max(...rows.map((x) => x[1]));
      $('#' + id + 'mo').textContent = `월 ${st.m}만원`;
      $('#' + id + 'a').innerHTML = rows.map(([k, v]) =>
        `<div class="alloc-row"><span>${k}</span><span class="alloc-bar"><i style="width:${(v / max * 100).toFixed(1)}%"></i></span><span class="v">월 ${Math.round(v)}만원</span></div>`).join('');
      const credited = Math.min(ps * 12 + irp * 12, creditCap);
      const rate = st.high ? P.credit_rate_high : P.credit_rate_low;
      const invested = st.m - r;
      const lo = fv(invested, P.return_low, P.sim_years), hi = fv(invested, P.return_high, P.sim_years);
      $('#' + id + 'o').innerHTML =
        `<div>연말정산 환급 <b>연 ${(credited * rate).toFixed(1)}만원</b> <span class="muted">(공제 대상 ${Math.round(credited)}만원 × ${(rate * 100).toFixed(1)}%)</span></div>
         <div>${P.sim_years}년 뒤 <b>${won(lo)} ~ ${won(hi)}</b> <span class="muted">(낸 돈 ${won(invested * 12 * P.sim_years)}, 세전)</span></div>`;
    }
    draw();
  }

  window.GuideSim = { contribution, charts, live: { compound: true } };
})();
