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
/* links between the pages: a person -> everything of theirs in the archive; a film -> its posters */
const personHref = (n) => `index.html?q=${encodeURIComponent(n)}#archive`;
const whoLink = (n) => `<a class="who" href="${personHref(n)}" data-who="${esc(n)}">${esc(n)}</a>`;
const hasPosters = () => !!(PROFILE.posters || document.querySelector('a[href="posters.html"]'));

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
    <div class="links"><a class="link" href="${doubanUrl(m)}" target="_blank" rel="noopener">在豆瓣查看 →</a>${hasPosters() ? `<a class="link" href="posters.html#${m.id}/1">看它的海报 →</a>` : ''}${m.d.filter((d) => M.filter((x) => x.d.includes(d)).length > 1).slice(0, 2).map((d) => `<a class="link who" href="${personHref(d)}" data-who="${esc(d)}">${esc(d)} 的其他作品 →</a>`).join('')}</div>
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
  return rows.map(([k, n, ms]) => `<li><span class="nm">${whoLink(k)}</span><span class="c">${n}</span><span class="films">${esc(ms.map((x) => x.t).join(' · '))}</span></li>`).join('');
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
/* poster archive link, only when this journal was generated with posters */
if (PROFILE.posters && !/posters\.html/.test(location.pathname)) {
  const nav = document.querySelector('.bar nav'), first = nav && nav.querySelector('.pill');
  if (first) first.insertAdjacentHTML('beforebegin', '<a href="posters.html">海报馆</a>');
}
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

/* ---------- a person's name: on the main page filter the archive in place, elsewhere go there ---------- */
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-who]'), q = document.getElementById('q');
  if (!a || !q) return;
  e.preventDefault();
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  q.value = a.dataset.who; q.dispatchEvent(new Event('input'));
  document.getElementById('archive').scrollIntoView({ behavior: 'smooth' });
});

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

/* ---------- small-format share images: 3:4 cards (小红书 / 朋友圈 sets) and a poster wall ---------- */
const SH = { blue: '#1633e6', lime: '#dfff4f', black: '#0b0b0c', white: '#ffffff', gray: '#6a6a72',
  CN: "'Songti SC','Noto Serif SC','STSong','SimSun',serif", DP: "Didot,'Bodoni 72','Playfair Display','Songti SC',serif",
  SANS: "'Helvetica Neue','PingFang SC','Microsoft YaHei',sans-serif", MONO: "'SF Mono',Menlo,Consolas,'PingFang SC',monospace" };
const loadImg = (src) => new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
function pen(x) {
  const text = (s, px, py, font, color, align = 'left', spacing = 0) => { x.font = font; x.fillStyle = color; x.textAlign = align; if ('letterSpacing' in x) x.letterSpacing = spacing + 'px'; x.fillText(s, px, py); if ('letterSpacing' in x) x.letterSpacing = '0px'; return x.measureText(s).width; };
  const fit = (s, font, size, max) => { x.font = font.replace('{s}', size); const w = x.measureText(s).width; return w > max ? Math.floor(size * max / w) : size; };
  const wrap = (s, font, max, maxLines) => {
    x.font = font; const lines = []; let cur = '';
    for (const ch of [...String(s).replace(/\n+/g, '\n')]) {
      if (ch === '\n') { lines.push(cur); cur = ''; continue; }
      if (x.measureText(cur + ch).width > max) { lines.push(cur); cur = ch; } else cur += ch;
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].slice(0, -2) + '……'; }
    return lines;
  };
  const cover = (im, px, py, pw, ph, title) => {
    if (im) { const s = Math.max(pw / im.width, ph / im.height), sw = pw / s, sh = ph / s; x.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, px, py, pw, ph); return; }
    x.fillStyle = SH.blue; x.fillRect(px, py, pw, ph);
    const fs = Math.max(12, Math.round(pw / 7));
    wrap(title || '', `900 ${fs}px ${SH.CN}`, pw - fs, 4).forEach((l, j) => text(l, px + fs / 2, py + fs * 1.6 + j * fs * 1.3, `900 ${fs}px ${SH.CN}`, SH.white));
  };
  return { text, fit, wrap, cover };
}

/**
 * A set of 1080×1440 (3:4) cards. spec: { title, script, line, figures:[[v,u,k]x4], months:[[label,n]], monthsNote,
 *   charts:[{title, en, rows:[[k,n]]}], facts:[[v,u,caption]], posters:{title, en, list:[movie]}, quote:{text, by} }
 */
async function renderCards(spec) {
  const W = 1080, H = 1440, P = 84, out = [];
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const make = (bg, fg, draw) => out.push({ bg, fg, draw });
  const frame = (x, t, bg, fg, n, total) => {
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    const line = fg === SH.white ? 'rgba(255,255,255,.3)' : 'rgba(11,11,12,.2)';
    t.text(`${ME} 的观影志`, P, 104, `900 30px ${SH.CN}`, fg);
    t.text(`${String(n).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, W - P, 102, `22px ${SH.MONO}`, fg, 'right', 3);
    x.fillStyle = line; x.fillRect(P, 134, W - 2 * P, 1); x.fillRect(P, H - 120, W - 2 * P, 1);
    t.text(spec.footer || 'The Film Journal', P, H - 66, `italic 30px ${SH.DP}`, bg === SH.blue || bg === SH.black ? SH.lime : SH.blue);
    t.text(spec.stamp || '', W - P, H - 68, `20px ${SH.MONO}`, fg, 'right', 2);
  };
  const heading = (x, t, cn, en, fg, hl) => { const w = t.text(cn, P, 290, `900 84px ${SH.CN}`, fg); t.text(en, P + w + 24, 290, `italic 44px ${SH.DP}`, hl); };

  /* 1. cover */
  make(SH.blue, SH.white, (x, t) => {
    const size = t.fit(spec.title, spec.latin ? `{s}px ${SH.DP}` : `900 {s}px ${SH.CN}`, spec.latin ? 470 : 300, W - 2 * P);
    t.text(spec.title, P - 10, 330 + size * 0.8, (spec.latin ? `${size}px ${SH.DP}` : `900 ${size}px ${SH.CN}`), SH.white);
    t.text(spec.script, W - P, 330 + size * 0.8 + 130, `italic ${t.fit(spec.script, `italic {s}px ${SH.DP}`, 110, W - 2 * P)}px ${SH.DP}`, SH.lime, 'right');
    t.wrap(spec.line, `40px ${SH.SANS}`, W - 2 * P, 3).forEach((l, i, a) => t.text(l, P, H - 200 - (a.length - 1 - i) * 62, `40px ${SH.SANS}`, SH.white));
  });
  /* 2. figures */
  if (spec.figures) make(SH.white, SH.black, (x, t) => {
    heading(x, t, '数字', 'in figures', SH.black, SH.blue);
    const cw = (W - 2 * P) / 2;
    spec.figures.forEach(([v, u, k], i) => {
      const fx = P + (i % 2) * cw + (i % 2 ? 40 : 0), fy = 380 + Math.floor(i / 2) * 430;
      t.text(String(v), fx - 6, fy + 200, `${t.fit(String(v), `{s}px ${SH.DP}`, 230, cw - 60)}px ${SH.DP}`, SH.black);
      t.text(u, fx, fy + 266, `900 40px ${SH.CN}`, SH.black);
      t.text(String(k).toUpperCase(), fx, fy + 312, `22px ${SH.MONO}`, SH.gray, 'left', 3);
    });
    x.fillStyle = 'rgba(11,11,12,.16)'; x.fillRect(W / 2, 400, 1, 780); x.fillRect(P, 800, W - 2 * P, 1);
  });
  /* 3. months */
  if (spec.months && spec.months.some((r) => r[1])) make(SH.black, SH.white, (x, t) => {
    heading(x, t, '月历', 'month by month', SH.white, SH.lime);
    const max = Math.max(1, ...spec.months.map((r) => r[1])), n = spec.months.length, gw = (W - 2 * P) / n, base = 1060, hmax = 560;
    const top = spec.months.reduce((a, r, i) => (r[1] > spec.months[a][1] ? i : a), 0);
    spec.months.forEach(([k, v], i) => {
      const h = v ? Math.max(6, hmax * v / max) : 2, bx = P + i * gw + gw * 0.18, bw = gw * 0.64;
      x.fillStyle = i === top ? SH.lime : v ? SH.white : 'rgba(255,255,255,.25)'; x.fillRect(bx, base - h, bw, h);
      if (v) t.text(String(v), bx + bw / 2, base - h - 16, `34px ${SH.DP}`, SH.white, 'center');
      t.text(k.replace('月', ''), bx + bw / 2, base + 44, `22px ${SH.MONO}`, 'rgba(255,255,255,.7)', 'center');
    });
    t.wrap(spec.monthsNote || '', `34px ${SH.SANS}`, W - 2 * P, 2).forEach((l, i) => t.text(l, P, 1180 + i * 52, `34px ${SH.SANS}`, SH.white));
  });
  /* 4. charts */
  (spec.charts || []).filter((c) => c.rows.length >= 3).forEach((c, ci) => {
    const bg = ci % 2 ? SH.white : SH.lime, fg = SH.black;
    make(bg, fg, (x, t) => {
      heading(x, t, c.title, c.en || '', fg, SH.blue);
      const rows = c.rows.slice(0, 7), max = Math.max(1, ...rows.map((r) => r[1])), lw = 250, bw = W - 2 * P - lw - 100;
      rows.forEach(([k, n], i) => {
        const cy = 440 + i * 112;
        t.text(t.wrap(k, `34px ${SH.SANS}`, lw - 20, 1)[0], P, cy + 14, `34px ${SH.SANS}`, fg);
        x.fillStyle = i === 0 ? SH.blue : SH.black; x.beginPath(); x.roundRect(P + lw, cy - 12, Math.max(6, bw * n / max), 28, [0, 8, 8, 0]); x.fill();
        t.text(String(n), W - P, cy + 18, `48px ${SH.DP}`, fg, 'right');
      });
    });
  });
  /* 5. facts */
  if (spec.facts && spec.facts.length) make(SH.blue, SH.white, (x, t) => {
    heading(x, t, '之最', 'the most', SH.white, SH.lime);
    spec.facts.slice(0, 3).forEach(([v, u, cap], i) => {
      const fy = 400 + i * 280;
      const w = t.text(String(v), P - 4, fy + 140, `${t.fit(String(v), `{s}px ${SH.DP}`, 170, 560)}px ${SH.DP}`, SH.white);
      t.text(u, P + w + 16, fy + 140, `900 44px ${SH.CN}`, SH.lime);
      t.wrap(cap, `32px ${SH.SANS}`, W - 2 * P, 2).forEach((l, j) => t.text(l, P, fy + 200 + j * 46, `32px ${SH.SANS}`, 'rgba(255,255,255,.86)'));
      if (i) { x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(P, fy + 6, W - 2 * P, 1); }
    });
  });
  /* 6. posters */
  let imgs = [];
  if (spec.posters && spec.posters.list.length) {
    const all = spec.posters.list, list = all.slice(0, all.length >= 6 ? 6 : 4);
    imgs = await Promise.all(list.map((m) => loadImg(m.p)));
    make(SH.black, SH.white, (x, t) => {
      heading(x, t, spec.posters.title, spec.posters.en || '', SH.white, SH.lime);
      const cols = list.length <= 4 ? 2 : 3, gap = 20, pw = (W - 2 * P - gap * (cols - 1)) / cols, ph = Math.min(pw * 1.48, (H - 380 - 170 - gap * (Math.ceil(list.length / cols) - 1)) / Math.ceil(list.length / cols));
      const pw2 = ph / 1.48, off = (W - 2 * P - (pw2 * cols + gap * (cols - 1))) / 2;
      list.forEach((m, i) => t.cover(imgs[i], P + off + (i % cols) * (pw2 + gap), 360 + Math.floor(i / cols) * (ph + gap), pw2, ph, m.t));
    });
  }
  /* 7. quote */
  if (spec.quote) make(SH.white, SH.black, (x, t) => {
    t.text('“', P - 10, 470, `300px ${SH.DP}`, SH.blue);
    const ql = t.wrap(spec.quote.text, `42px ${SH.CN}`, W - 2 * P, 12);
    ql.forEach((l, i) => t.text(l, P, 520 + i * 70, `42px ${SH.CN}`, SH.black));
    x.fillStyle = 'rgba(11,11,12,.2)'; x.fillRect(P, 520 + ql.length * 70, W - 2 * P, 1);
    t.wrap(spec.quote.by, `24px ${SH.MONO}`, W - 2 * P, 2).forEach((l, i) => t.text(l, P, 580 + ql.length * 70 + i * 36, `24px ${SH.MONO}`, SH.gray, 'left', 1));
  });
  /* 8. fin */
  make(SH.blue, SH.white, (x, t) => {
    t.text('Fin.', P, 330, `italic 64px ${SH.DP}`, SH.lime);
    (spec.fin || ['下一部见。']).forEach((l, i) => t.text(l, P, 560 + i * 150, `900 ${t.fit(l, `900 {s}px ${SH.CN}`, 120, W - 2 * P)}px ${SH.CN}`, SH.white));
    t.text(isLocal() ? '数据来自我的豆瓣“看过”列表' : shareUrl().replace(/^https?:\/\//, ''), P, H - 190, `24px ${SH.MONO}`, SH.white, 'left', 1);
  });

  return out.map((c, i) => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d'), t = pen(x);
    frame(x, t, c.bg, c.fg, i + 1, out.length);
    c.draw(x, t);
    return cv;
  });
}

/** A poster wall: every film in `list` (one cover each), as one tall 1080px image. */
async function renderWall(list, title, sub) {
  const W = 1080, P = 60, n = list.length;
  const cols = n <= 12 ? 3 : n <= 30 ? 5 : n <= 70 ? 7 : n <= 140 ? 9 : 12, gap = n <= 30 ? 14 : 8;
  const pw = (W - 2 * P - gap * (cols - 1)) / cols, ph = pw * 1.48, rows = Math.ceil(n / cols);
  const imgs = await Promise.all(list.map((m) => loadImg(m.p)));
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const head = 430, foot = 200, Ht = head + rows * (ph + gap) - gap + foot + 40;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Ht;
  const x = cv.getContext('2d'), t = pen(x);
  x.fillStyle = SH.black; x.fillRect(0, 0, W, Ht);
  x.fillStyle = SH.blue; x.fillRect(0, 0, W, head - 40);
  t.text(`${ME} 的海报墙`, P, 96, `900 30px ${SH.CN}`, SH.white);
  t.text('POSTER WALL', W - P, 94, `22px ${SH.MONO}`, SH.lime, 'right', 4);
  x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(P, 128, W - 2 * P, 1);
  t.text(title, P - 6, 280, `900 ${t.fit(title, `900 {s}px ${SH.CN}`, 140, W - 2 * P)}px ${SH.CN}`, SH.white);
  t.text(sub, P, 340, `30px ${SH.SANS}`, 'rgba(255,255,255,.86)');
  list.forEach((m, i) => t.cover(imgs[i], P + (i % cols) * (pw + gap), head + Math.floor(i / cols) * (ph + gap), pw, ph, m.t));
  const fy = Ht - foot + 60;
  x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(P, fy - 40, W - 2 * P, 1);
  t.text(`${ME} 的观影志`, P, fy + 40, `900 40px ${SH.CN}`, SH.white);
  t.text('The Film Journal', W - P, fy + 40, `italic 38px ${SH.DP}`, SH.lime, 'right');
  t.text(isLocal() ? '数据来自我的豆瓣“看过”列表' : shareUrl().replace(/^https?:\/\//, ''), P, fy + 96, `22px ${SH.MONO}`, 'rgba(255,255,255,.7)', 'left', 1);
  return cv;
}

/**
 * Wires every [data-share] button to a share dialog.
 * buildSpec → spec for the long image (or null); more: { cards: () => spec for renderCards, wall: () => [list, title, sub] }.
 */
function initShare(buildSpec, filename, more = {}) {
  const base = filename.replace(/\.png$/, '');
  const kinds = [
    buildSpec && ['long', '长图', '一张 1080px 宽的长图，适合朋友圈或保存到相册。', '生成长图'],
    more.cards && ['cards', '小红书卡片', '一组 3:4 的卡片（1080 × 1440），正好发一篇小红书图文或朋友圈九宫格。', '生成卡片组'],
    more.wall && ['wall', '海报墙', '把看过的影片海报拼成一整面墙，一张图。', '生成海报墙'],
  ].filter(Boolean);
  const dlg = document.createElement('dialog');
  dlg.className = 't-black share-dlg';
  dlg.innerHTML = `<div class="inner"><button class="close" aria-label="关闭">×</button>
    <div class="mono hl">Share</div><h3 class="sh">分享 ${esc(ME)} 的观影志</h3>
    <div class="share-grid">
      <div>
        <div class="label">01 — 链接</div>
        <div class="linkrow"><input readonly value="${esc(shareUrl())}" aria-label="分享链接"><button class="btn" data-act="copy">复制链接</button></div>
        <p class="hint">${location.protocol === 'file:' ? '这一份保存在你自己的电脑里，链接别人打不开。想给朋友看，直接生成下面的图片；想要公开链接，可以把整个文件夹上传到任意静态网站托管（如 GitHub Pages）。' : isLocal() ? '现在是本机预览地址，别人打不开。网站部署上线后，这里会自动变成可以发给别人的公开链接。' : '把这个链接发给朋友，对方打开就能看到这一页。'}</p>
        <div class="label" style="margin-top:28px">02 — 图片</div>
        ${kinds.length > 1 ? `<div class="kinds">${kinds.map(([k, l], i) => `<button class="chip" data-kind="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>` : ''}
        <p class="hint kind-hint">${kinds[0][2]}</p>
        <div class="linkrow"><button class="btn solid" data-act="make">${kinds[0][3]}</button><button class="btn" data-act="save" hidden>下载</button><button class="btn" data-act="native" hidden>发送…</button></div>
        <p class="hint status" aria-live="polite"></p>
      </div>
      <div class="preview"><div class="ph mono">图片预览</div></div>
    </div></div>`;
  document.body.appendChild(dlg);
  let kind = kinds[0][0], files = [];
  const status = (s) => { $('.status', dlg).textContent = s; };
  const reset = () => { files = []; $('[data-act=save]', dlg).hidden = true; $('[data-act=native]', dlg).hidden = true; $('.preview', dlg).innerHTML = '<div class="ph mono">图片预览</div>'; status(''); };
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-share]'); if (b) { e.preventDefault(); if (b.dataset.share && b.dataset.share !== kind) { const c = $(`[data-kind=${b.dataset.share}]`, dlg); if (c) c.click(); } dlg.showModal(); } });
  dlg.addEventListener('click', async (e) => {
    if (e.target === dlg || e.target.closest('.close')) return dlg.close();
    const kb = e.target.closest('[data-kind]');
    if (kb) {
      kind = kb.dataset.kind; const k = kinds.find((x) => x[0] === kind);
      dlg.querySelectorAll('[data-kind]').forEach((c) => c.setAttribute('aria-pressed', c === kb));
      $('.kind-hint', dlg).textContent = k[2]; $('[data-act=make]', dlg).textContent = k[3]; reset(); return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'copy') {
      try { await navigator.clipboard.writeText(shareUrl()); } catch { const i = $('input', dlg); i.select(); document.execCommand('copy'); }
      e.target.textContent = '已复制 ✓'; setTimeout(() => { e.target.textContent = '复制链接'; }, 1600);
    }
    if (act === 'make') {
      status('正在生成…'); reset(); status('正在生成…');
      try {
        const canvases = kind === 'long' ? [await renderShare(buildSpec())] : kind === 'cards' ? await renderCards(more.cards()) : [await renderWall(...more.wall())];
        const names = canvases.length > 1 ? canvases.map((_, i) => `${base}-${String(i + 1).padStart(2, '0')}.png`) : [kind === 'wall' ? `${base}-wall.png` : filename];
        files = await Promise.all(canvases.map(async (c, i) => { const b = await new Promise((res) => c.toBlob(res, 'image/png')); return { name: names[i], url: URL.createObjectURL(b), file: new File([b], names[i], { type: 'image/png' }) }; }));
        $('.preview', dlg).innerHTML = `<div class="pv ${kind}">${files.map((f) => `<a href="${f.url}" download="${f.name}" title="点击单独下载"><img src="${f.url}" alt=""></a>`).join('')}</div>`;
        const save = $('[data-act=save]', dlg); save.hidden = false; save.textContent = files.length > 1 ? `全部下载（${files.length} 张）` : '下载 PNG';
        if (navigator.canShare && navigator.canShare({ files: files.map((f) => f.file) })) $('[data-act=native]', dlg).hidden = false;
        status(files.length > 1 ? `已生成 ${files.length} 张 1080 × 1440 卡片。点预览里的某一张可以单独下载；手机上也可以长按保存。` : `已生成 ${canvases[0].width} × ${canvases[0].height} 像素。手机上也可以长按预览图保存。`);
      } catch (err) { status('生成失败：' + err.message + (location.protocol === 'file:' && !/^data:/.test((M.find((m) => m.p) || {}).p || 'data:') ? '（请通过 http 地址打开页面，而不是直接双击文件）' : '')); }
    }
    if (act === 'save' && files.length) {
      for (const f of files) { const a = document.createElement('a'); a.href = f.url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); await new Promise((r) => setTimeout(r, 350)); }
    }
    if (act === 'native' && files.length) { try { await navigator.share({ files: files.map((f) => f.file), title: `${ME} 的观影志` }); } catch { /* cancelled */ } }
  });
}
