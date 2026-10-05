/* ============================================================
   시뮬레이터와 그림. 세법 숫자는 원본 md 부록 C에서 받는다(설계 7장).
   ============================================================ */
(function () {
  'use strict';
  const won = (manwon) => {
    if (manwon >= 10000) return (manwon / 10000).toFixed(1).replace(/\.0$/, '') + '억원';
    return Math.round(manwon).toLocaleString('ko-KR') + '만원';
  };
  const fv = (monthly, rate, years) => { const i = rate / 12, n = years * 12; return monthly * ((Math.pow(1 + i, n) - 1) / i); };

  /* 납입 시뮬레이터 (설계 7-1) */
  function contribution(root, P) {
    const M = (k) => P[k] / 10000 / 12;            // 원/년 → 만원/월
    const psCap = M('pension_saving_credit_limit'); // 50
    const creditCap = P.pension_credit_limit / 10000; // 900 (만원/년)
    const irpCap = (P.pension_credit_limit - P.pension_saving_credit_limit) / 10000 / 12; // 25
    const isaCap = M('isa_annual_limit');           // 약 166.7
    const depositCap = M('pension_deposit_limit');  // 150
    const st = { m: 50, high: false, lump: false };
    const id = 'sim' + Math.random().toString(36).slice(2, 7);

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
        `<div>연말정산 환급 <b>연 ${(credited * rate).toFixed(1)}만원</b> <span style="color:var(--ink-muted)">(공제 대상 ${Math.round(credited)}만원 × ${(rate * 100).toFixed(1)}%)</span></div>
         <div>${P.sim_years}년 뒤 <b>${won(lo)} ~ ${won(hi)}</b> <span style="color:var(--ink-muted)">(낸 돈 ${won(invested * 12 * P.sim_years)}, 세전)</span></div>`;
    }
    draw();
  }

  /* 그림: 막대 (설계: 단일 계열, 직접 라벨) */
  function bars(rows, opts) {
    const W = 600, H = 300, padT = 34, padB = 58, gap = 28;
    const n = rows.length, bw = (W - gap * (n + 1)) / n;
    const max = Math.max(...rows.map((r) => r.v)) * 1.08;
    const y = (v) => padT + (H - padT - padB) * (1 - v / max);
    const fills = opts.fills || rows.map((_, i) => (i === 0 ? 'var(--chart-neutral)' : 'var(--chart-1)'));
    const op = opts.opacity || rows.map((_, i) => (i === 0 ? 1 : 0.55 + 0.45 * (i / (n - 1))));
    let g = '';
    rows.forEach((r, i) => {
      const x = gap + i * (bw + gap), top = y(r.v), h = H - padB - top;
      g += `<rect x="${x}" y="${top}" width="${bw}" height="${h}" rx="4" fill="${fills[i]}" fill-opacity="${op[i]}"><title>${r.label}: ${r.text}</title></rect>`;
      g += `<text x="${x + bw / 2}" y="${top - 9}" text-anchor="middle" font-size="17" font-weight="600" fill="var(--ink-strong)">${r.text}</text>`;
      const lines = r.label.split('\n');
      lines.forEach((ln, j) => { g += `<text x="${x + bw / 2}" y="${H - padB + 22 + j * 19}" text-anchor="middle" font-size="14.5" fill="var(--ink-muted)">${ln}</text>`; });
    });
    g += `<line x1="${gap / 2}" x2="${W - gap / 2}" y1="${H - padB}" y2="${H - padB}" stroke="var(--rule)"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.aria}" font-family="inherit">${g}</svg>`;
  }

  const charts = {
    'tax-deferral'(rows) {
      const lab = ['낸 돈\n(원금)', '일반계좌\n세후', '연금계좌\n세후', '연금계좌\n+ 환급 재투자'];
      const data = rows.slice(0, 4).map((r, i) => ({ label: lab[i] || r[0], v: parseFloat(r[1]), text: r[1] }));
      return bars(data, { aria: '같은 돈을 30년 굴렸을 때 계좌별 세후 결과 막대그림' });
    },
  };

  window.GuideSim = { contribution, charts };
})();
