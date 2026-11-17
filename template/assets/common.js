/* Shared helpers for the film journal pages. Data comes from data/movies.js (window.MOVIES, window.PROFILE). */
const M = window.MOVIES || [];
const PROFILE = window.PROFILE || {};
const ME = PROFILE.name || '我';
const ME_MARK = [...ME][0];
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Count occurrences; `get` returns a value or an array of values per movie. Returns [[key, n, movies]] sorted desc. */
function tally(list, get) {
  const m = new Map();
  for (const x of list) for (const k of [].concat(get(x) ?? [])) {
    if (k === null || k === undefined || k === '') continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return [...m.entries()].map(([k, v]) => [k, v.length, v]).sort((a, b) => b[1] - a[1]);
}
const sum = (list, get) => list.reduce((s, x) => s + (get(x) || 0), 0);
const stars = (r) => (r ? '★'.repeat(r) + '☆'.repeat(5 - r) : '');
const doubanUrl = (m) => `https://movie.douban.com/subject/${m.id}/`;
const film = (m) => `《${m.t}》`;
const byDateDesc = (a, b) => b.date.localeCompare(a.date);

function posterHTML(m, extra = '') {
  return `<div class="poster${m.p ? '' : ' broken'}">${extra}${m.p ? `<img loading="lazy" src="${esc(m.p)}" alt="${esc(m.t)}" onerror="this.parentNode.classList.add('broken')">` : ''}<span class="fallback">${esc(m.t)}</span></div>`;
}
function runtimeText(m) {
  if (m.tv) return [m.ep ? `${m.ep} 集` : '剧集', m.rt1 ? `单集 ${m.rt1} 分钟` : ''].filter(Boolean).join(' · ');
  return m.rt ? `${m.rt} 分钟` : '';
}
function metaLine(m) {
  return [m.y, m.c.slice(0, 2).join(' / '), m.d.slice(0, 2).join(' / '), runtimeText(m), m.g.slice(0, 3).join(' · ')].filter(Boolean).map(esc).join('  /  ');
}
function featureHTML(m, kicker) {
  return `<div class="feature">${posterHTML(m)}<div>
    <div class="mono hl">${esc(kicker)}</div>
    <h3>${esc(m.t)}</h3>${m.o && m.o !== m.t ? `<div class="orig">${esc(m.o)}</div>` : ''}
    <div class="meta">${metaLine(m)}<br>${esc(ME)} 标记于 ${esc(m.date)}${m.r ? `  <span class="stars">${stars(m.r)}</span>` : ''}</div>
    ${m.cm ? `<blockquote>${esc(m.cm)}</blockquote>` : ''}
    <a class="link" href="${doubanUrl(m)}" target="_blank" rel="noopener">在豆瓣查看 →</a>
  </div></div>`;
}

/** Horizontal bars. rows: [[label, n, movies?]] */
function hbars(el, rows, unit = '部') {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  el.innerHTML = rows.map(([k, n, ms], i) => `<div class="hbar${i === 0 ? ' top' : ''}" data-tip="${esc(k)}：${n} ${unit}${ms ? '&#10;' + esc(ms.slice(0, 4).map((x) => x.t).join('、')) + (ms.length > 4 ? ' 等' : '') : ''}">
    <span class="n">${esc(k)}</span><span class="track"><div class="fill" style="width:${(n / max) * 100}%"></div></span><span class="c">${n}</span></div>`).join('');
}
/** Vertical columns. rows: [[label, n, tipExtra?]] */
function columns(el, rows, unit = '部') {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const top = rows.reduce((a, r, i) => (r[1] > rows[a][1] ? i : a), 0);
  el.innerHTML = `<div class="cols">${rows.map(([k, n, tip], i) => `<div class="col${i === top && n ? ' top' : ''}${n ? '' : ' zero'}" data-tip="${esc(k)}：${n} ${unit}${tip ? '&#10;' + esc(tip) : ''}">
    <span class="c">${n || '·'}</span><div class="colbar" style="height:${(n / max) * 82}%"></div></div>`).join('')}</div>
    <div class="col-labels">${rows.map(([k]) => `<span>${esc(k)}</span>`).join('')}</div>`;
}
function decadeRows(list) {
  if (!list.some((m) => m.y)) return [];
  const decs = tally(list.filter((m) => m.y), (m) => Math.floor(m.y / 10) * 10).sort((a, b) => a[0] - b[0]);
  const rows = [];
  for (let d = decs[0][0]; d <= decs[decs.length - 1][0]; d += 10) { const hit = decs.find((x) => x[0] === d); rows.push([String(d).slice(2) + 's', hit ? hit[1] : 0, hit ? hit[2].slice(0, 3).map((x) => x.t).join('、') : '']); }
  return rows;
}
/** Ranked list rows: [[name, n, movies]] */
function rankHTML(rows) {
  return rows.map(([k, n, ms]) => `<li><span class="nm">${esc(k)}</span><span class="c">${n}</span><span class="films">${esc(ms.map((x) => x.t).join(' · '))}</span></li>`).join('');
}
/** Big numeral tiles: [[value, unit, label]] */
function figuresHTML(rows) {
  return rows.map(([v, u, k]) => `<div class="figure"><div class="v">${v}</div><div class="u">${u}</div><div class="k label">${k}</div></div>`).join('');
}
/** Month-by-month diary of everything in `list` (newest month first). */
function diaryHTML(list) {
  const months = tally(list.filter((m) => m.date), (m) => m.date.slice(0, 7)).sort((a, b) => b[0].localeCompare(a[0]));
  if (!months.length) return '<div class="empty">这一年没有标记。</div>';
  return months.map(([ym, n, ms]) => `<div class="month">
    <div class="mh"><span class="mn">${+ym.slice(5)}</span><span class="mu">月</span><div class="label">${ym.slice(0, 4)} · ${n} 部${ms.some((m) => m.r === 5) ? ` · ${ms.filter((m) => m.r === 5).length} 部五星` : ''}</div></div>
    <div class="mfilms">${ms.slice().sort(byDateDesc).map((m) => `<button class="mini" data-film="${m.id}">${posterHTML(m)}
      <span class="d mono"><span>${m.date.slice(5).replace('-', '.')}</span><span class="stars">${m.r ? '★'.repeat(m.r) : ''}</span></span><span class="t">${esc(m.t)}</span></button>`).join('')}</div>
  </div>`).join('');
}
/** One note: poster + title header, full comment below. */
function noteHTML(m) {
  return `<figure class="note"><button class="nh" data-film="${m.id}">${posterHTML(m)}<span class="ni"><b>${esc(m.t)}</b><span class="mono">${[m.y, m.d[0]].filter(Boolean).map(esc).join(' · ')}</span><span class="mono">${esc(m.date)}　<span class="stars">${stars(m.r)}</span></span></span></button><blockquote>${esc(m.cm)}</blockquote></figure>`;
}

/* ---------- identity ---------- */
function sealHTML() {
  const ring = `${ME} 的观影志 ✦ PRIVATE FILM COLLECTION ✦ SINCE ${(M.filter((m) => m.date).map((m) => m.date).sort()[0] || '').slice(0, 4)} ✦ `;
  return `<svg viewBox="0 0 200 200" role="img" aria-label="${esc(ME)} 的观影志"><defs><path id="seal-ring" d="M100,100 m-76,0 a76,76 0 1,1 152,0 a76,76 0 1,1 -152,0"/></defs>
    <circle cx="100" cy="100" r="99" fill="var(--hl)"/><circle cx="100" cy="100" r="58" fill="none" stroke="var(--on-hl)" stroke-width="1"/>
    <g class="spin"><text font-family="SF Mono, Menlo, monospace" font-size="12.5" fill="var(--on-hl)" letter-spacing="2"><textPath href="#seal-ring" textLength="470">${esc(ring)}</textPath></text></g>
    <text x="100" y="104" text-anchor="middle" dominant-baseline="central" font-size="62" font-family="Songti SC, serif" font-weight="900" fill="var(--on-hl)">${esc(ME_MARK)}</text></svg>`;
}
document.querySelectorAll('[data-me]').forEach((el) => { el.textContent = ME; });
document.querySelectorAll('.seal').forEach((el) => { el.innerHTML = sealHTML(); });
document.title = document.title.replace('{me}', ME);
(() => {
  const l = document.createElement('link'); l.rel = 'icon';
  l.href = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="88">${ME_MARK}</text></svg>`);
  document.head.appendChild(l);
})();

/* ---------- tooltip ---------- */
(() => {
  const tip = document.createElement('div');
  tip.id = 'tip';
  document.body.appendChild(tip);
  document.addEventListener('mousemove', (e) => {
    const t = e.target.closest ? e.target.closest('[data-tip]') : null;
    if (!t) { tip.style.opacity = 0; return; }
    tip.textContent = t.dataset.tip;
    tip.style.opacity = 1;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - w - 8, e.clientX + 14) + 'px';
    tip.style.top = Math.max(8, e.clientY - h - 12) + 'px';
  });
})();

/* ---------- film dialog: any [data-film] element opens it ---------- */
(() => {
  const dlg = document.createElement('dialog');
  dlg.className = 't-white film-dlg';
  dlg.innerHTML = '<div class="inner"><button class="close" aria-label="关闭">×</button><div class="body"></div></div>';
  document.body.appendChild(dlg);
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-film]');
    if (!t) return;
    const m = M.find((x) => x.id === t.dataset.film);
    if (!m) return;
    $('.body', dlg).innerHTML = featureHTML(m, m.g.join(' / ') || (m.tv ? 'Series' : 'Film'));
    dlg.showModal();
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('.close')) dlg.close(); });
})();

/* ---------- scroll reveal ---------- */
function initReveal() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.06 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

/* ---------- share: link + long image ---------- */
const isLocal = () => location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const shareUrl = () => location.href.split('#')[0];

/**
 * Draws the long share image. spec: { title, latin, script, para, figures:[[v,unit,label]x4],
 *   charts:[{title, rows:[[label,n]]}x2], facts:[[v,unit,caption]x3], postersTitle, posters:[movie], quote:{text, by} }
 */
async function renderShare(spec) {
  const W = 1080, P = 72, C = { blue: '#1633e6', lime: '#dfff4f', black: '#0b0b0c', white: '#ffffff', gray: '#6a6a72' };
  const CN = "'Songti SC','Noto Serif SC','STSong','SimSun',serif", DP = "Didot,'Bodoni 72','Playfair Display','Songti SC',serif";
  const SANS = "'Helvetica Neue','PingFang SC','Microsoft YaHei',sans-serif", MONO = "'SF Mono',Menlo,Consolas,'PingFang SC',monospace";
  const load = (m) => new Promise((res) => { if (!m.p) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = m.p; });
  const imgs = await Promise.all(spec.posters.map(load));
  if (document.fonts && document.fonts.ready) await document.fonts.ready;

  const cv = document.createElement('canvas'); cv.width = W; cv.height = 7000;
  const x = cv.getContext('2d'); x.textBaseline = 'alphabetic';
  let y = 0;
  const band = (h, color) => { x.fillStyle = color; x.fillRect(0, y, W, h); };
  const text = (s, px, py, font, color, align = 'left', spacing = 0) => { x.font = font; x.fillStyle = color; x.textAlign = align; if ('letterSpacing' in x) x.letterSpacing = spacing + 'px'; x.fillText(s, px, py); if ('letterSpacing' in x) x.letterSpacing = '0px'; };
  const fit = (s, font, size, max) => { x.font = font.replace('{s}', size); const w = x.measureText(s).width; return w > max ? Math.floor(size * max / w) : size; };
  const wrap = (s, font, max, maxLines) => {
    x.font = font; const lines = []; let cur = '';
    for (const ch of [...s.replace(/\n+/g, '\n')]) {
      if (ch === '\n') { lines.push(cur); cur = ''; continue; }
      if (x.measureText(cur + ch).width > max) { lines.push(cur); cur = ch; } else cur += ch;
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].slice(0, -2) + '……'; }
    return lines;
  };
  const rule = (py, color) => { x.fillStyle = color; x.fillRect(P, py, W - 2 * P, 1); };
  const head = (cn, en, fg, hl) => { text(cn, P, y + 118, `900 64px ${CN}`, fg); const w = x.measureText(cn).width; text(en, P + w + 22, y + 118, `italic 40px ${DP}`, hl); rule(y + 150, fg === C.white ? 'rgba(255,255,255,.3)' : 'rgba(11,11,12,.2)'); };

  /* A. cover */
  const paraLines = wrap(spec.para, `34px ${SANS}`, W - 2 * P, 4);
  const coverH = 800 + paraLines.length * 56;
  band(coverH, C.blue);
  text(`${ME} 的观影志`, P, 108, `900 34px ${CN}`, C.white);
  text((PROFILE.updated || '').replace(/-/g, '.'), W - P, 104, `24px ${MONO}`, C.white, 'right', 3);
  rule(140, 'rgba(255,255,255,.35)');
  const tFont = spec.latin ? `{s}px ${DP}` : `900 {s}px ${CN}`;
  const tSize = fit(spec.title, tFont, spec.latin ? 460 : 330, W - 2 * P + 10);
  text(spec.title, P - 8, 180 + tSize * (spec.latin ? 0.78 : 0.9), tFont.replace('{s}', tSize), C.white);
  const sy = 180 + tSize * (spec.latin ? 0.78 : 0.9) + 120;
  text(spec.script, W - P, sy, `italic ${fit(spec.script, `italic {s}px ${DP}`, 104, W - 2 * P)}px ${DP}`, C.lime, 'right');
  paraLines.forEach((l, i) => text(l, P, coverH - 90 - (paraLines.length - 1 - i) * 56, `34px ${SANS}`, C.white));
  y += coverH;

  /* B. figures */
  band(640, C.white);
  const cw = (W - 2 * P) / 2;
  spec.figures.forEach(([v, u, k], i) => {
    const fx = P + (i % 2) * cw + (i % 2 ? 36 : 0), fy = y + 70 + Math.floor(i / 2) * 290;
    text(String(v), fx - 6, fy + 150, `${fit(String(v), `{s}px ${DP}`, 180, cw - 60)}px ${DP}`, C.black);
    text(u, fx, fy + 204, `900 32px ${CN}`, C.black);
    text(k.toUpperCase(), fx, fy + 242, `20px ${MONO}`, C.gray, 'left', 3);
  });
  x.fillStyle = 'rgba(11,11,12,.16)'; x.fillRect(W / 2, y + 70, 1, 500); x.fillRect(P, y + 345, W - 2 * P, 1);
  y += 640;

  /* C. charts */
  const chartH = 200 + spec.charts.reduce((s, c) => s + 90 + c.rows.length * 62 + 40, 0);
  band(chartH, C.black);
  head('口味', 'taste', C.white, C.lime);
  let cy = y + 220;
  for (const c of spec.charts) {
    text(c.title, P, cy, `900 34px ${CN}`, C.white); cy += 56;
    const max = Math.max(1, ...c.rows.map((r) => r[1])), lw = 230, bw = W - 2 * P - lw - 90;
    c.rows.forEach(([k, n], i) => {
      text(k, P, cy + 12, `28px ${SANS}`, C.white);
      x.fillStyle = i === 0 ? C.lime : C.white; x.beginPath(); x.roundRect(P + lw, cy - 8, Math.max(4, bw * n / max), 20, [0, 6, 6, 0]); x.fill();
      text(String(n), W - P, cy + 14, `36px ${DP}`, C.white, 'right');
      cy += 62;
    });
    cy += 74;
  }
  y += chartH;

  /* D. facts */
  band(120 + spec.facts.length * 190, C.lime);
  spec.facts.forEach(([v, u, cap], i) => {
    const fy = y + 90 + i * 190;
    text(String(v), P - 4, fy + 110, `130px ${DP}`, C.black); const w = x.measureText(String(v)).width;
    text(u, P + w + 14, fy + 110, `900 38px ${CN}`, C.black);
    wrap(cap, `28px ${SANS}`, W - 2 * P, 1).forEach((l) => text(l, P, fy + 160, `28px ${SANS}`, 'rgba(11,11,12,.72)'));
    if (i) { x.fillStyle = 'rgba(11,11,12,.25)'; x.fillRect(P, fy - 14, W - 2 * P, 1); }
  });
  y += 120 + spec.facts.length * 190;

  /* E. posters */
  const cols = 4, gap = 18, pw = (W - 2 * P - gap * (cols - 1)) / cols, ph = pw * 40 / 27, prow = Math.ceil(imgs.length / cols);
  const postH = 230 + prow * (ph + gap) + 70;
  band(postH, C.black);
  head(spec.postersTitle, spec.postersEn || '★★★★★', C.white, C.lime);
  imgs.forEach((im, i) => {
    const px = P + (i % cols) * (pw + gap), py = y + 210 + Math.floor(i / cols) * (ph + gap);
    if (im) { const s = Math.max(pw / im.width, ph / im.height), sw = pw / s, sh = ph / s; x.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, px, py, pw, ph); }
    else { x.fillStyle = C.blue; x.fillRect(px, py, pw, ph); wrap(spec.posters[i].t, `900 26px ${CN}`, pw - 28, 4).forEach((l, j) => text(l, px + 14, py + 44 + j * 34, `900 26px ${CN}`, C.white)); }
  });
  y += postH;

  /* F. quote */
  if (spec.quote) {
    const ql = wrap(spec.quote.text, `34px ${CN}`, W - 2 * P, 9);
    const qh = 300 + ql.length * 62 + 110;
    band(qh, C.white);
    text('“', P - 10, y + 250, `240px ${DP}`, C.blue);
    ql.forEach((l, i) => text(l, P, y + 300 + i * 62, `34px ${CN}`, C.black));
    rule(y + 300 + ql.length * 62 - 10, 'rgba(11,11,12,.2)');
    text(spec.quote.by, P, y + 300 + ql.length * 62 + 40, `24px ${MONO}`, C.gray, 'left', 1);
    y += qh;
  }

  /* G. footer */
  band(250, C.blue);
  text(`${ME} 的观影志`, P, y + 104, `900 52px ${CN}`, C.white);
  text('The Film Journal', W - P, y + 104, `italic 46px ${DP}`, C.lime, 'right');
  rule(y + 138, 'rgba(255,255,255,.35)');
  text(isLocal() ? '数据来自我的豆瓣“看过”列表' : shareUrl().replace(/^https?:\/\//, ''), P, y + 190, `24px ${MONO}`, C.white, 'left', 1);
  y += 250;

  const out = document.createElement('canvas'); out.width = W; out.height = y;
  out.getContext('2d').drawImage(cv, 0, 0);
  return out;
}

/** Wires every [data-share] button to a share dialog. `buildSpec` returns the spec for renderShare. */
function initShare(buildSpec, filename) {
  const dlg = document.createElement('dialog');
  dlg.className = 't-black share-dlg';
  dlg.innerHTML = `<div class="inner"><button class="close" aria-label="关闭">×</button>
    <div class="mono hl">Share</div><h3 class="sh">分享 ${esc(ME)} 的观影志</h3>
    <div class="share-grid">
      <div>
        <div class="label">01 — 链接</div>
        <div class="linkrow"><input readonly value="${esc(shareUrl())}" aria-label="分享链接"><button class="btn" data-act="copy">复制链接</button></div>
        <p class="hint">${location.protocol === 'file:' ? '这一份保存在你自己的电脑里，链接别人打不开。想给朋友看，直接生成下面的长图；想要公开链接，可以把整个文件夹上传到任意静态网站托管（如 GitHub Pages）。' : isLocal() ? '现在是本机预览地址，别人打不开。网站部署上线后，这里会自动变成可以发给别人的公开链接。' : '把这个链接发给朋友，对方打开就能看到这一页。'}</p>
        <div class="label" style="margin-top:28px">02 — 长图</div>
        <p class="hint">生成一张 1080px 宽的长图，适合发朋友圈、小红书或保存到相册。</p>
        <div class="linkrow"><button class="btn solid" data-act="make">生成分享长图</button><a class="btn" data-act="save" hidden>下载 PNG</a><button class="btn" data-act="native" hidden>发送…</button></div>
        <p class="hint status" aria-live="polite"></p>
      </div>
      <div class="preview"><div class="ph mono">长图预览</div></div>
    </div></div>`;
  document.body.appendChild(dlg);
  let blob = null;
  const status = (s) => { $('.status', dlg).textContent = s; };
  document.addEventListener('click', (e) => { if (e.target.closest('[data-share]')) { e.preventDefault(); dlg.showModal(); } });
  dlg.addEventListener('click', async (e) => {
    if (e.target === dlg || e.target.closest('.close')) return dlg.close();
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'copy') {
      try { await navigator.clipboard.writeText(shareUrl()); } catch { const i = $('input', dlg); i.select(); document.execCommand('copy'); }
      e.target.textContent = '已复制 ✓'; setTimeout(() => { e.target.textContent = '复制链接'; }, 1600);
    }
    if (act === 'make') {
      status('正在生成…');
      try {
        const canvas = await renderShare(buildSpec());
        blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        const url = URL.createObjectURL(blob);
        $('.preview', dlg).innerHTML = `<img src="${url}" alt="分享长图预览">`;
        const a = $('[data-act=save]', dlg); a.href = url; a.download = filename; a.hidden = false;
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) $('[data-act=native]', dlg).hidden = false;
        status(`已生成 ${canvas.width} × ${canvas.height} 像素。手机上也可以长按预览图保存。`);
      } catch (err) { status('生成失败：' + err.message + (location.protocol === 'file:' && !/^data:/.test((M.find((m) => m.p) || {}).p || 'data:') ? '（请通过 http 地址打开页面，而不是直接双击文件）' : '')); }
    }
    if (act === 'native' && blob) { try { await navigator.share({ files: [new File([blob], filename, { type: 'image/png' })], title: `${ME} 的观影志` }); } catch { /* cancelled */ } }
  });
}
