/*
 * 观影志 · 一键生成
 * Runs on movie.douban.com (loaded by the bookmarklet on the kit page). Reads the signed-in user's 看过 list,
 * film details and posters, then downloads a ready-to-open site as a zip. Everything happens in the user's own
 * browser: no server, no login handed to anyone.
 */
(async () => {
  if (window.__FJ_RUNNING) return;
  window.__FJ_RUNNING = true;
  const BASE = window.__FJ_BASE || ((document.currentScript && document.currentScript.src) || '').replace(/[^/]*$/, '');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------------------------------------------------------------- panel */
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{all:initial}
    .bg{position:fixed;inset:0;background:rgba(11,11,12,.72);display:flex;align-items:center;justify-content:center;font-family:'Helvetica Neue','PingFang SC','Microsoft YaHei',sans-serif}
    .card{width:min(560px,92vw);background:#1633e6;color:#fff;padding:40px 40px 32px;box-shadow:0 30px 80px rgba(0,0,0,.4)}
    .k{font:12px/1 'SF Mono',Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:#dfff4f}
    h1{font:900 40px/1.1 'Songti SC','Noto Serif SC','STSong',serif;margin:14px 0 6px;letter-spacing:.02em}
    .msg{font-size:15px;line-height:1.7;min-height:52px;margin:0 0 22px;color:rgba(255,255,255,.88)}
    .track{height:6px;background:rgba(255,255,255,.22)}.fill{height:100%;width:0;background:#dfff4f;transition:width .3s}
    .steps{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:14px;font:12px/1.4 'SF Mono',Menlo,monospace;color:rgba(255,255,255,.5)}
    .steps .on{color:#dfff4f}.steps .ok{color:#fff}
    .row{display:flex;gap:10px;margin-top:28px;flex-wrap:wrap}
    details.adv{flex-basis:100%;margin-top:6px;font-size:13px;color:rgba(255,255,255,.8)}
    details.adv summary{cursor:pointer;font:12px/1.6 'SF Mono',Menlo,monospace;color:#dfff4f}
    details.adv p{margin:8px 0;line-height:1.6;font-size:12px;color:rgba(255,255,255,.7)}
    details.adv input{width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid rgba(255,255,255,.6);background:transparent;color:#fff;font:13px 'SF Mono',Menlo,monospace}
    .row button small{display:block;font:400 11px/1.2 'SF Mono',Menlo,monospace;margin-top:6px;opacity:.75;letter-spacing:.04em}
    button,a.b{font:600 14px/1 'Helvetica Neue','PingFang SC',sans-serif;padding:13px 20px;border:1.5px solid #fff;background:none;color:#fff;cursor:pointer;text-decoration:none}
    .solid{background:#dfff4f;border-color:#dfff4f;color:#0b0b0c}
    .note{font-size:12px;color:rgba(255,255,255,.6);margin-top:18px;line-height:1.6}
  </style>
  <div class="bg"><div class="card">
    <div class="k">Film Journal · 观影志</div>
    <h1>正在整理你的观影志</h1>
    <p class="msg">准备中…</p>
    <div class="track"><div class="fill"></div></div>
    <div class="steps"><span>01 片单</span><span>02 详情</span><span>03 封面</span><span>04 海报馆</span><span>05 打包</span></div>
    <div class="row"><button class="stop">取消</button></div>
    <p class="note">全部在你自己的浏览器里完成，不上传任何数据。过程中请不要关闭或刷新这个页面。</p>
  </div></div>`;
  document.documentElement.appendChild(host);
  const $ = (s) => root.querySelector(s);
  let cancelled = false;
  const close = () => { host.remove(); window.__FJ_RUNNING = false; };
  $('.stop').onclick = () => { cancelled = true; close(); };
  const say = (t) => { $('.msg').textContent = t; };
  const bar = (f) => { $('.fill').style.width = Math.round(Math.min(1, f) * 100) + '%'; };
  const step = (n) => root.querySelectorAll('.steps span').forEach((s, i) => { s.className = i < n ? 'ok' : i === n ? 'on' : ''; });
  const finish = (title, text, buttons) => {
    $('h1').textContent = title; say(text); bar(1);
    $('.row').innerHTML = buttons || '<button class="solid ok-btn">好的</button>';
    root.querySelectorAll('.ok-btn').forEach((b) => { b.onclick = close; });
  };
  const fail = (text, buttons) => { finish('没能完成', text, buttons); $('.card').style.background = '#0b0b0c'; };
  const check = () => { if (cancelled) throw new Error('cancelled'); };

  try {
    /* ---------------------------------------------------------------- 0. where are we, who is this */
    if (location.hostname !== 'movie.douban.com') {
      fail('请在“豆瓣电影”的网页上点击这个按钮。点下面的按钮会打开你的“看过”页面，打开后再点一次收藏栏里的按钮。',
        '<a class="b solid" href="https://movie.douban.com/mine?status=collect">打开我的“看过”页面</a><button class="ok-btn">取消</button>');
      return;
    }
    // Douban sometimes asks a browser that reads many pages to prove it is human. When that happens we pause,
    // let the user pass the check in another tab (same cookies), then carry on from where we were.
    const SKIP = new Error('skip');
    let pending = null;
    const verify = () => pending || (pending = new Promise((resolve) => {
      const keep = { msg: $('.msg').textContent, row: $('.row').innerHTML };
      say('豆瓣想确认一下你是真人（读取得比较快时会这样）。请点“去验证”，在新打开的页面里完成验证，然后回到这里点“继续”。已经读到的不会丢。');
      $('.row').innerHTML = '<a class="b solid" href="https://movie.douban.com/" target="_blank" rel="noopener">去验证 ↗</a><button class="go">我已完成，继续</button><button class="skip">跳过，直接生成</button>';
      const done = (v) => { pending = null; say(keep.msg); $('.row').innerHTML = keep.row; $('.stop').onclick = () => { cancelled = true; close(); }; resolve(v); };
      $('.go').onclick = () => done('go');
      $('.skip').onclick = () => done('skip');
    }));
    const blockedRes = (res, html) => /misc\/sorry|sec\.douban\.com/.test(res.url) || res.status === 403 || /<title>\s*禁止访问/.test(html);
    const fetchDoc = async (url) => {
      while (true) {
        check();
        let res, html;
        try {
          res = await fetch(url, { credentials: 'include' });
          html = await res.text();
        } catch (e) {
          // Douban's human check usually lives on another domain, so the redirect to it surfaces as a network error.
          // Tell that apart from a real network problem by looking at the redirect without following it.
          let toCheck = false;
          try { toCheck = (await fetch(url, { credentials: 'include', redirect: 'manual' })).type === 'opaqueredirect'; } catch { /* offline */ }
          if (!toCheck) throw e;
          if ((await verify()) === 'skip') throw SKIP;
          continue;
        }
        if (!blockedRes(res, html)) return { res, doc: new DOMParser().parseFromString(html, 'text/html'), html };
        if ((await verify()) === 'skip') throw SKIP;
      }
    };
    say('正在确认登录状态…');
    let uid = (location.pathname.match(/^\/people\/([^/]+)\/collect/) || [])[1];
    if (!uid) {
      const { res: r } = await fetchDoc('/mine?status=collect');
      uid = (r.url.match(/\/people\/([^/]+)\//) || [])[1];
      if (!uid) {
        const nav = document.querySelector('.nav-user-account a[href*="/people/"], a[href*="douban.com/people/"]');
        uid = nav && (nav.href.match(/\/people\/([^/]+)\//) || [])[1];
      }
    }
    if (!uid) {
      fail('看起来还没有登录豆瓣。请先在这个页面右上角登录，然后再点一次收藏栏里的按钮。');
      return;
    }

    /* ---------------------------------------------------------------- optional kit config (e.g. a licensed TMDB key set by the seller) */
    let CONFIG = {};
    try { const r = await fetch(BASE + 'config.json', { cache: 'no-store' }); if (r.ok) CONFIG = await r.json(); } catch { /* none */ }
    let TMDB = (CONFIG.tmdbKey || '').trim();

    /* ---------------------------------------------------------------- choose: journal only, or journal + poster archive */
    const withPosters = await new Promise((resolve) => {
      $('h1').textContent = '生成你的观影志';
      say('选一种。两种都会读取你的“看过”列表和每部影片的详情；海报馆会再为每部影片收集各个国家、各个版本的海报，并附上经典海报的赏析。');
      $('.row').innerHTML = '<button class="solid m1">观影志 + 海报馆<small>300 部约 30 分钟</small></button><button class="m0">只要观影志<small>300 部约 7 分钟</small></button><button class="x">取消</button>'
        + '<details class="adv"><summary>高级：加入 TMDB 海报（可选）</summary><p>TMDB 是全球最大的电影资料库，能多收集各语言版本和无字版海报。填入你自己在 themoviedb.org 免费申请的 API 密钥即可；不填就只用豆瓣。密钥只在这次生成中使用，不会保存或上传。</p><input class="tmdb" type="password" autocomplete="off" spellcheck="false" placeholder="TMDB API Key 或 Read Access Token"></details>';
      $('.m1').onclick = () => { TMDB = ($('.tmdb').value || '').trim() || TMDB; resolve(true); };
      $('.m0').onclick = () => resolve(false);
      $('.x').onclick = () => { cancelled = true; close(); resolve(false); };
    });
    check();
    $('h1').textContent = withPosters ? '正在整理你的观影志和海报馆' : '正在整理你的观影志';
    $('.row').innerHTML = '<button class="stop">取消</button>';
    $('.stop').onclick = () => { cancelled = true; close(); };
    if (!withPosters) root.querySelectorAll('.steps span')[3].style.visibility = 'hidden';
    // progress bar ranges per phase
    const R = withPosters ? { list: 0.06, d: [0.06, 0.4], c: [0.4, 0.48], g: [0.48, 0.96] } : { list: 0.1, d: [0.1, 0.65], c: [0.65, 0.92] };
    const span = (r, f) => r[0] + (r[1] - r[0]) * f;

    /* ---------------------------------------------------------------- 1. the 看过 list */
    step(0);
    const listUrl = (st) => `/people/${uid}/collect?start=${st}&sort=time&rating=all&filter=all&mode=grid`;
    const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
    const parseList = (doc) => [...doc.querySelectorAll('.grid-view .item')].map((it) => {
      const a = it.querySelector('a[href*="/subject/"]');
      const id = a && (a.href.match(/subject\/(\d+)/) || [])[1];
      if (!id) return null;
      const names = txt(it.querySelector('.title em')).split(' / ').map((s) => s.trim());
      const rc = it.querySelector('[class^="rating"][class$="-t"]');
      const cm = it.querySelector('.comment');
      return {
        id, title: names[0], orig: names.slice(1).join(' / '),
        rating: rc ? +rc.className.match(/rating(\d)/)[1] : null,
        date: txt(it.querySelector('.date')), comment: cm ? cm.textContent.trim() : '',
        intro: txt(it.querySelector('.intro')), poster: (it.querySelector('img') || {}).src || '',
      };
    }).filter(Boolean);

    const films = new Map();
    let total = null, start = 0, name = '';
    while (true) {
      check();
      let items = [], doc = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        ({ doc } = await fetchDoc(listUrl(start)));
        items = parseList(doc);
        if (items.length) break;
        await sleep(2500 * (attempt + 1));
      }
      if (total === null) {
        const t = (doc.title || '').match(/\((\d+)\)/);
        total = t ? +t[1] : items.length;
        if (!total) { fail('你的“看过”列表还是空的，先去豆瓣标记几部再来吧。'); return; }
      }
      if (!items.length) break;
      items.forEach((it) => films.set(it.id, it));
      start += 15;
      say(`正在读取你的“看过”列表：${Math.min(films.size, total)} / ${total}`);
      bar(R.list * Math.min(1, films.size / total));
      if (start >= total) break;
      await sleep(700);
    }
    if (films.size < Math.min(total, 15)) throw new Error('豆瓣暂时没有返回完整的列表，请过几分钟再试。');
    try {
      const { doc } = await fetchDoc(`/people/${uid}/`);
      name = ((doc.title || '').match(/^\s*(.+?)的(电影主页|影视主页)/) || [])[1] || '';
    } catch { /* fall through */ }
    if (!name) name = ((txt(document.querySelector('.nav-user-account .bn-more span')) || '').match(/(.+?)的帐号/) || [])[1] || '我';
    name = name.trim();

    /* ---------------------------------------------------------------- 2. details from each film page */
    step(1);
    const list = [...films.values()].slice(0, window.__FJ_LIMIT || Infinity);  // __FJ_LIMIT: testing only
    const infoField = (info, label) => {
      const m = info.match(new RegExp(label + '\\s*[:：]\\s*([^\\n]+)'));
      return m ? m[1].trim() : '';
    };
    const splitList = (s) => s.split('/').map((x) => x.trim()).filter(Boolean);
    const parseDetail = (doc, f) => {
      const infoEl = doc.querySelector('#info');
      if (!infoEl) return null;
      const info = infoEl.innerText || infoEl.textContent.replace(/(\S)\s{2,}(\S)/g, '$1\n$2');
      const full = txt(doc.querySelector('[property="v:itemreviewed"]'));
      const orig = full.startsWith(f.title) ? full.slice(f.title.length).trim() : '';
      const eps = parseInt(infoField(info, '集数'), 10) || 0;
      const single = infoField(info, '单集片长');
      const runtime = txt(doc.querySelector('[property="v:runtime"]')) || infoField(info, '片长');
      return {
        title: f.title, original_title: orig,
        year: (txt(doc.querySelector('.year')).match(/\d{4}/) || [])[0] || null,
        is_tv: !!(eps || single || /集数|单集片长|首播/.test(info)), episodes: eps,
        durations: [single || runtime].filter(Boolean),
        genres: [...doc.querySelectorAll('[property="v:genre"]')].map(txt),
        countries: splitList(infoField(info, '制片国家/地区')),
        languages: splitList(infoField(info, '语言')),
        directors: [...doc.querySelectorAll('a[rel="v:directedBy"]')].map(txt).slice(0, 4),
        actors: [...doc.querySelectorAll('a[rel="v:starring"]')].map(txt).slice(0, 6),
        imdb: (info.match(/IMDb\s*[:：]\s*(tt\d+)/) || [])[1] || '',
      };
    };
    let done = 0, blocked = false;
    const fetchDetail = async (f) => {
      for (let attempt = 0; attempt < 2 && !blocked; attempt++) {
        try {
          const { res, doc } = await fetchDoc(`/subject/${f.id}/`);
          if (/accounts\.douban/.test(res.url)) { blocked = true; return; }
          const d = parseDetail(doc, f);
          if (d) { f.detail = d; return; }
        } catch (e) {
          if (e === SKIP) { blocked = true; return; }
          if (cancelled) throw e;
        }
        await sleep(1500);
      }
    };
    // two at a time, gently: this is the user's own session and we do not want Douban to throw a captcha at them
    let cursor = 0;
    await Promise.all([0, 1].map(async () => {
      while (cursor < list.length && !blocked) {
        check();
        const f = list[cursor++];
        await fetchDetail(f);
        done++;
        say(`正在读取每部影片的详情：${done} / ${list.length}`);
        bar(span(R.d, done / list.length));
        await sleep(350);
      }
    }));

    /* ---------------------------------------------------------------- 3. covers, embedded so the site works offline */
    step(2);
    const toDataUrl = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(''); r.readAsDataURL(blob); });
    let pdone = 0;
    cursor = 0;
    await Promise.all([0, 1, 2, 3].map(async () => {
      while (cursor < list.length) {
        check();
        const f = list[cursor++];
        if (/doubanio\.com\/view\//.test(f.poster)) {
          try {
            const r = await fetch(f.poster, { mode: 'cors', credentials: 'omit' });
            if (r.ok) { const b = await r.blob(); if (b.size > 1000) f.p = await toDataUrl(b); }
          } catch { /* poster stays empty: the page shows a title card instead */ }
        }
        pdone++;
        if (pdone % 5 === 0 || pdone === list.length) { say(`正在下载封面：${pdone} / ${list.length}`); bar(span(R.c, pdone / list.length)); }
      }
    }));

    /* ---------------------------------------------------------------- 4. poster archive
     * Per film, in this order (near-duplicates dropped by an image fingerprint):
     *   Douban "海报" page, most liked first (official / teaser, labelled by country)  — up to 6
     *   TMDB posters, most voted first (labelled by language; "无字版" = textless)      — up to 6, only with a key
     *   Douban "其他海报" (fan-made and artistic designs), for films rated 4★ and above  — up to 3
     * Plus curated notes on famous posters (curation.json on the kit site), for films the user has seen. */
    const gallery = {}, galleryFiles = {}, curation = {};
    let gcount = 0, tmdbUsed = false, tmdbNote = '';
    if (withPosters) {
      step(3);
      const parsePhotos = (doc) => [...doc.querySelectorAll('ul.poster-col3 > li[data-id]')].map((li) => {
        const img = li.querySelector('.cover img');
        const nameEl = li.querySelector('.name');
        const label = nameEl ? [...nameEl.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim() : '';
        const [k, ...rest] = label.split(' ');
        let g = rest.join(' ').replace(/^(台湾|香港|澳门)$/, '中国$1').replace(/^大陆$/, '中国大陆');
        const note = g && !isCountry(g) ? g : '';
        if (note) g = '';
        const dim = (txt(li.querySelector('.prop')).match(/(\d+)\s*x\s*(\d+)/) || []).slice(1).map(Number);
        const c = parseInt((txt(nameEl && nameEl.querySelector('a')).match(/\d+/) || ['0'])[0], 10) || 0;
        // only the *_ratio_poster sizes on Douban's image server allow cross-origin reads; m_ratio_poster is 540px wide
        const src = img && img.src.replace(/\/view\/photo\/[a-z_]+\//, '/view/photo/m_ratio_poster/').replace(/\.webp$/, '.jpg');
        return { id: li.dataset.id, s: 'd', src, k: k || '海报', g, note, ow: dim[0] || 0, oh: dim[1] || 0, c };
      }).filter((p) => p.id && p.src);
      // shrink to ~480px wide JPEG (big enough for the full-screen poster room, still a manageable zip) and take an 8×8 average-hash fingerprint for de-duplication
      const shrink = async (blob) => {
        const bmp = await createImageBitmap(blob);
        const W = Math.min(480, bmp.width), H = Math.round(bmp.height * W / bmp.width);
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const cx = cv.getContext('2d'); cx.drawImage(bmp, 0, 0, W, H);
        const t = document.createElement('canvas'); t.width = t.height = 8;
        const tx = t.getContext('2d'); tx.drawImage(bmp, 0, 0, 8, 8);
        const px = tx.getImageData(0, 0, 8, 8).data, gray = [];
        for (let i = 0; i < 64; i++) gray.push(px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11);
        const avg = gray.reduce((x, y) => x + y, 0) / 64;
        if (bmp.close) bmp.close();
        return { blob: await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.8)), w: W, h: H, hash: gray.map((v) => (v > avg ? 1 : 0)) };
      };
      const same = (a, b) => { let d = 0; for (let i = 0; i < 64; i++) d += a[i] !== b[i]; return d <= 6; };
      // download + shrink in parallel; keeping (with de-duplication) happens afterwards, in priority order
      const prep = (list) => Promise.all(list.map(async (p) => {
        try {
          const r = await fetch(p.src, { mode: 'cors', credentials: 'omit' });
          if (!r.ok) return null;
          const { blob, w, h, hash } = await shrink(await r.blob());
          return blob && blob.size >= 1500 ? Object.assign(p, { blob, w, h, hash }) : null;
        } catch { return null; }
      })).then((x) => x.filter(Boolean));
      const keep = async (p, kept, force) => {
        if (!force && kept.some((q) => same(q.hash, p.hash))) return false;
        p.f = `posters/${p.s}${p.id}.jpg`;
        galleryFiles[p.f] = new Uint8Array(await p.blob.arrayBuffer());
        delete p.blob;
        kept.push(p);
        return true;
      };

      // TMDB (optional): check the key once, so a bad key or blocked network costs nothing later
      const tm = async (path) => {
        const bearer = TMDB.length > 60;
        const url = 'https://api.themoviedb.org/3' + path + (bearer ? '' : (path.includes('?') ? '&' : '?') + 'api_key=' + encodeURIComponent(TMDB));
        const r = await fetch(url, { credentials: 'omit', headers: bearer ? { Authorization: 'Bearer ' + TMDB } : {} });
        if (r.status === 401) throw new Error('TMDB_KEY');
        return r.ok ? r.json() : null;
      };
      if (TMDB) {
        say('正在连接 TMDB…');
        try {
          await Promise.race([tm('/configuration'), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 10000))]);
          tmdbUsed = true;
        } catch (e) { tmdbNote = e.message === 'TMDB_KEY' ? 'TMDB 密钥无效，这次只用了豆瓣的海报。' : '连不上 TMDB（可能是网络原因），这次只用了豆瓣的海报。'; }
      }
      const LANG = { en: '英文版', zh: '中文版', ja: '日文版', ko: '韩文版', fr: '法文版', de: '德文版', es: '西班牙文版', it: '意大利文版', ru: '俄文版', pt: '葡萄牙文版', pl: '波兰文版', cs: '捷克文版', sv: '瑞典文版', da: '丹麦文版', nl: '荷兰文版', tr: '土耳其文版', th: '泰文版', hu: '匈牙利文版' };
      const tmdbPosters = async (f) => {
        const imdb = f.detail && f.detail.imdb;
        if (!tmdbUsed || !imdb) return [];
        try {
          const found = await tm(`/find/${imdb}?external_source=imdb_id`);
          const hit = found && ((found.movie_results || [])[0] ? ['movie', found.movie_results[0]] : (found.tv_results || [])[0] ? ['tv', found.tv_results[0]] : null);
          if (!hit) return [];
          const imgs = await tm(`/${hit[0]}/${hit[1].id}/images`);
          return ((imgs && imgs.posters) || []).sort((a, b) => (b.vote_count - a.vote_count) || (b.vote_average - a.vote_average)).slice(0, 8).map((x) => ({
            id: x.file_path.replace(/^\/|\.\w+$/g, ''), s: 't', src: 'https://image.tmdb.org/t/p/w342' + x.file_path,
            k: 'TMDB', lang: x.iso_639_1 ? (LANG[x.iso_639_1] || x.iso_639_1.toUpperCase() + ' 版') : '无字版',
            v: x.vote_count ? +x.vote_average.toFixed(1) : 0, ow: x.width, oh: x.height, tm: `${hit[0]}/${hit[1].id}`,
          }));
        } catch (e) { if (e.message === 'TMDB_KEY') tmdbUsed = false; return []; }
      };

      // curated notes (kit site); keep only films this user has seen, and make sure their posters are in the zip
      let CUR = {};
      try { const r = await fetch(BASE + 'curation.json', { cache: 'no-store' }); if (r.ok) CUR = await r.json(); } catch { /* none */ }

      let gdone = 0, gstop = false;
      cursor = 0;
      await Promise.all([0, 1].map(async () => {
        while (cursor < list.length && !gstop) {
          check();
          const f = list[cursor++];
          const kept = [];
          try {
            const { doc } = await fetchDoc(`/subject/${f.id}/photos?type=R&start=0&sortby=like&size=a&subtype=a`);
            const main = parsePhotos(doc).filter((p) => p.k !== '其他海报').slice(0, 6);
            const others = f.rating >= 4
              ? sleep(300).then(() => fetchDoc(`/subject/${f.id}/photos?type=R&start=0&sortby=like&size=a&subtype=t`)).then(({ doc: od }) => prep(parsePhotos(od).slice(0, 4)))
              : Promise.resolve([]);
            const [a, t, o] = await Promise.all([prep(main), tmdbPosters(f).then(prep), others]);
            for (const p of a) await keep(p, kept);
            let nt = 0; for (const p of t) { if (nt >= 6) break; if (await keep(p, kept)) nt++; }
            let no = 0; for (const p of o) { if (no >= 3) break; if (await keep(p, kept)) no++; }
            const cur = CUR[f.id];
            if (cur && cur.items) {
              curation[f.id] = cur;
              // the poster a note is about: an exact TMDB image (its image server needs no key), else a Douban photo
              const pins = [];
              for (const it of cur.items) {
                const tid = it.tmdb ? it.tmdb.replace(/^\/|\.\w+$/g, '') : '';
                let p = kept.find((q) => (tid && q.s === 't' && q.id === tid) || (it.photo && q.s === 'd' && q.id === it.photo));
                if (!p && tid) [p] = await prep([{ id: tid, s: 't', src: 'https://image.tmdb.org/t/p/w500' + it.tmdb, k: it.kind || '正式海报', g: it.region || '' }]);
                if (!p && it.photo) [p] = await prep([{ id: it.photo, s: 'd', src: `https://img1.doubanio.com/view/photo/m_ratio_poster/public/p${it.photo}.jpg`, k: it.kind || '正式海报', g: it.region || '' }]);
                if (!p) continue;
                if (!kept.includes(p)) {
                  for (let i = kept.length - 1; i >= 0; i--) if (same(kept[i].hash, p.hash)) { delete galleryFiles[kept[i].f]; kept.splice(i, 1); }   // drop its look-alikes
                  await keep(p, kept, true);
                }
                pins.push(p);
              }
              kept.sort((x, y) => pins.includes(y) - pins.includes(x));   // noted posters first
            }
          } catch (e) {
            if (e === SKIP) gstop = true; else if (cancelled) throw e;
          }
          const out = kept.map(({ id, s: src, k, g, note, lang, v, w, h, ow, oh, c, f: file, tm: t }) => Object.fromEntries(Object.entries({ id, s: src, k, g, note, lang, v, w, h, ow, oh, c, f: file, tm: t }).filter(([, x]) => x !== undefined && x !== '' && x !== 0)));
          if (out.length) { gallery[f.id] = out; gcount += out.length; }
          gdone++;
          say(`正在收集海报馆：${gdone} / ${list.length} 部，已收集 ${gcount} 张` + (tmdbUsed ? '（豆瓣 + TMDB）' : ''));
          bar(span(R.g, gdone / list.length));
          await sleep(350);
        }
      }));
    }

    /* ---------------------------------------------------------------- 5. build data + zip */
    step(4);
    say('正在打包你的观影志…');
    const rows = list.map((f) => {
      const d = f.detail || parseIntro(f);
      const mins = (d.durations || []).map((s) => parseInt((String(s).match(/\d+/) || [])[0], 10)).find((n) => n) || null;
      const tv = !!d.is_tv, ep = d.episodes || 0;
      return {
        id: f.id, t: d.title || f.title, o: d.original_title || '', y: /^\d{4}$/.test(String(d.year || '')) ? +d.year : null,
        tv, ep, rt1: mins, rt: tv && ep && mins ? mins * ep : mins,
        c: d.countries || [], d: d.directors || [], a: d.actors || [], g: d.genres || [], l: d.languages || [],
        r: f.rating, date: f.date || '', cm: f.comment || '', p: f.p || '',
      };
    }).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const now = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
    const profile = { id: uid, name, updated: now, url: `https://www.douban.com/people/${uid}/`, posters: gcount, tmdb: tmdbUsed };
    const dataJs = `window.PROFILE = ${JSON.stringify(profile)};\nwindow.MOVIES = ${JSON.stringify(rows)};\n`;

    if (window.__FJ_SINK) { await window.__FJ_SINK({ profile, rows, dataJs, gallery, galleryFiles, detailed: list.filter((f) => f.detail).length, blocked }); finish('测试完成', `共 ${rows.length} 部`); return; }

    const files = {};
    for (const p of ['index.html', 'report.html', 'posters.html', 'assets/style.css', 'assets/common.js']) {
      const r = await fetch(BASE + 'template/' + p, { cache: 'no-store' });
      if (!r.ok) throw new Error('模板文件下载失败（' + p + '），请检查网络后重试。');
      files[p] = await r.text();
    }
    files['data/movies.js'] = dataJs;
    files['data/posters.js'] = `window.POSTERS = ${JSON.stringify(gallery)};\nwindow.CURATION = ${JSON.stringify(curation)};\n`;
    Object.assign(files, galleryFiles);
    files['README.txt'] = '\ufeff' + [
      `${name} 的观影志 · 生成于 ${now}`, '',
      '第一步一定要先解压：Windows 右键压缩包 →「全部解压缩」；Mac 双击压缩包。在压缩包里直接双击网页会显示不完整。',
      '打开方式：在解压出来的文件夹里双击 index.html（主页）或 report.html（年度报告）' + (gcount ? '，海报馆是 posters.html。' : '。'),
      '看其他年份的年度报告：在 report.html 的地址末尾加上 ?y=2025 这样的年份。',
      '分享：页面右上角“分享”可以生成 1080px 宽的长图。',
      '更新：以后在豆瓣标记了新的影视，再点一次收藏栏里的按钮，下载新的一份替换掉这个文件夹即可。',
      '想要公开链接：把整个文件夹上传到任意静态网站托管（如 GitHub Pages、Netlify、Vercel）。', '',
      '数据来自你的豆瓣“看过”列表；海报版权归各片方所有，仅供个人使用。',
    ].join('\r\n');
    const folder = `film-journal-${uid}/`;
    const zip = makeZip(Object.entries(files).map(([p, s]) => [folder + p, s]));
    const url = URL.createObjectURL(zip);
    const filename = `film-journal-${uid}.zip`;
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    const detailed = list.filter((f) => f.detail).length;
    finish('完成了 🎬',
      `共 ${rows.length} 部影视${gcount ? `，海报馆收集了 ${gcount} 张海报` : ''}，已下载「${filename}」（${(zip.size / 1048576).toFixed(1)} MB）。请先解压（Windows：右键压缩包 →「全部解压缩」；Mac：双击压缩包），再打开解压出来的文件夹里的 index.html。不要在压缩包里直接双击网页，那样会显示不完整。` +
      (tmdbNote ? ' ' + tmdbNote : '') + (blocked ? ` 有 ${list.length - detailed} 部的详情这次没读到（豆瓣暂时拦截了），用了列表页的简要信息；过一段时间再点一次按钮会更完整。`
        : detailed < list.length ? ` 有 ${list.length - detailed} 部的详情页打不开（通常是豆瓣已下架的条目），用了列表页的简要信息。` : ''),
      `<a class="b solid" href="${url}" download="${filename}">没有自动下载？点这里</a><button class="ok-btn">关闭</button>`);
  } catch (err) {
    if (err && err.message === 'skip') { fail('豆瓣需要先完成真人验证才能继续读取。请打开豆瓣完成验证，过一会儿再点一次收藏栏里的按钮。'); return; }
    if (!cancelled) fail('出了点问题：' + (err && err.message || err) + ' 刷新页面后可以再点一次按钮重试。');
  }

  /* ---------------------------------------------------------------- helpers */
  function countrySet() {
    return new Set(`中国大陆 中国香港 中国台湾 中国澳门 中国 美国 日本 韩国 英国 法国 德国 意大利 西班牙 印度 泰国 俄罗斯 苏联 加拿大 澳大利亚
      爱尔兰 瑞典 巴西 丹麦 新加坡 墨西哥 阿根廷 比利时 荷兰 瑞士 奥地利 波兰 伊朗 土耳其 新西兰 挪威 芬兰 匈牙利 捷克 希腊 葡萄牙 以色列 黎巴嫩
      冰岛 智利 哥伦比亚 南非 越南 菲律宾 马来西亚 印度尼西亚 卡塔尔 罗马尼亚 保加利亚 塞尔维亚 乌克兰 格鲁吉亚 西德 东德 捷克斯洛伐克 南斯拉夫
      卢森堡 埃及 摩洛哥 突尼斯 沙特阿拉伯 阿联酋 约旦 巴勒斯坦 不丹 尼泊尔 蒙古 哈萨克斯坦 古巴 秘鲁 乌拉圭 爱沙尼亚 拉脱维亚 立陶宛 克罗地亚
      斯洛文尼亚 斯洛伐克 波黑 北马其顿 马其顿 阿尔巴尼亚 塞浦路斯 马耳他 摩纳哥 柬埔寨 老挝 缅甸 孟加拉国 巴基斯坦 斯里兰卡 阿富汗 伊拉克 叙利亚
      肯尼亚 尼日利亚 塞内加尔 乍得 毛里塔尼亚 阿尔及利亚 委内瑞拉 玻利维亚 巴拉圭 厄瓜多尔 多米尼加 波多黎各 朝鲜 列支敦士登 科索沃 黑山`.split(/\s+/));
  }
  function isCountry(x) { return countrySet().has(String(x).split(' ')[0]); }

  function parseIntro(f) {
    const COUNTRIES = countrySet();
    const GENRES = new Set('剧情 喜剧 动作 爱情 科幻 动画 悬疑 惊悚 恐怖 纪录片 短片 情色 同性 音乐 歌舞 家庭 儿童 传记 历史 战争 犯罪 西部 奇幻 冒险 灾难 武侠 古装 运动 黑色电影 真人秀 脱口秀 戏曲 荒诞 鬼怪'.split(' '));
    const series = /第.{1,3}季|Season \d/.test(f.title + ' ' + (f.orig || ''));
    const segs = (f.intro || '').split(' / ').map((x) => x.trim().replace(/\/$/, '').trim()).filter(Boolean);
    const dates = segs.filter((x) => /^\d{4}(-\d{2}){0,2}(\(|$)/.test(x));
    const body = segs.filter((x) => !dates.includes(x));
    const rtRe = /^(\d+)\s*分钟/, isC = (x) => COUNTRIES.has(x.split(' ')[0]);
    let cut = body.length;
    for (let i = 1; i < body.length; i++) {
      const x = body[i];
      if (rtRe.test(x) || x === f.title || /(www\.|https?:|\.com|\.co\.)/.test(x) || GENRES.has(x)) { cut = i; break; }
    }
    let pre = body.slice(0, cut); const post = body.slice(cut);
    const rt = post.find((x) => rtRe.test(x));
    let directors = [];
    while (pre.length && !isC(pre[pre.length - 1]) && directors.length < 3) directors.unshift(pre.pop());
    const countries = [];
    while (pre.length && isC(pre[pre.length - 1])) countries.unshift(pre.pop().split(' ')[0]);
    if (!countries.length) { pre = pre.concat(directors); directors = []; }
    return {
      title: f.title, original_title: f.orig || '', year: dates[0] ? dates[0].slice(0, 4) : null,
      is_tv: series, episodes: 0, durations: rt ? [rt] : [],
      genres: post.filter((x) => GENRES.has(x)), countries,
      languages: post.filter((x) => !GENRES.has(x) && /(语|话|方言)$/.test(x) && x.length < 12),
      directors, actors: pre.slice(0, 6),
    };
  }

  /** Minimal zip writer (stored, no compression; posters are already compressed). Names are flagged UTF-8. */
  function makeZip(entries) {
    const enc = new TextEncoder();
    const table = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = table[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const d = new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const parts = [], central = [];
    let offset = 0;
    for (const [path, content] of entries) {
      const name = enc.encode(path), data = typeof content === 'string' ? enc.encode(content) : content, crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
      local.setUint16(10, time, true); local.setUint16(12, date, true); local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true); local.setUint32(22, data.length, true); local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
      parts.push(local, name, data);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true);
      cen.setUint16(12, time, true); cen.setUint16(14, date, true); cen.setUint32(16, crc, true);
      cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true); cen.setUint16(28, name.length, true);
      cen.setUint32(42, offset, true);
      central.push(cen, name);
      offset += 30 + name.length + data.length;
    }
    const size = central.reduce((n, p) => n + p.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: 'application/zip' });
  }
})();
