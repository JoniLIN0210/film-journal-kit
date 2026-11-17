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
    .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px;font:12px/1.4 'SF Mono',Menlo,monospace;color:rgba(255,255,255,.5)}
    .steps .on{color:#dfff4f}.steps .ok{color:#fff}
    .row{display:flex;gap:10px;margin-top:28px;flex-wrap:wrap}
    button,a.b{font:600 14px/1 'Helvetica Neue','PingFang SC',sans-serif;padding:13px 20px;border:1.5px solid #fff;background:none;color:#fff;cursor:pointer;text-decoration:none}
    .solid{background:#dfff4f;border-color:#dfff4f;color:#0b0b0c}
    .note{font-size:12px;color:rgba(255,255,255,.6);margin-top:18px;line-height:1.6}
  </style>
  <div class="bg"><div class="card">
    <div class="k">Film Journal · 观影志</div>
    <h1>正在整理你的观影志</h1>
    <p class="msg">准备中…</p>
    <div class="track"><div class="fill"></div></div>
    <div class="steps"><span>01 片单</span><span>02 详情</span><span>03 海报</span><span>04 打包</span></div>
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
    const fetchDoc = async (url) => {
      const res = await fetch(url, { credentials: 'include' });
      const html = await res.text();
      return { res, doc: new DOMParser().parseFromString(html, 'text/html'), html };
    };
    say('正在确认登录状态…');
    let uid = (location.pathname.match(/^\/people\/([^/]+)\/collect/) || [])[1];
    if (!uid) {
      const r = await fetch('/mine?status=collect', { credentials: 'include' });
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
      bar(0.1 * Math.min(1, films.size / total));
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
    const list = [...films.values()];
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
      };
    };
    let done = 0, blocked = false;
    const fetchDetail = async (f) => {
      for (let attempt = 0; attempt < 2 && !blocked; attempt++) {
        try {
          const { res, doc } = await fetchDoc(`/subject/${f.id}/`);
          if (/sec\.douban\.com|misc\/sorry|accounts\.douban/.test(res.url) || res.status === 403) { blocked = true; return; }
          const d = parseDetail(doc, f);
          if (d) { f.detail = d; return; }
        } catch { /* retry */ }
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
        bar(0.1 + 0.55 * done / list.length);
        await sleep(350);
      }
    }));

    /* ---------------------------------------------------------------- 3. posters, embedded so the site works offline */
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
        if (pdone % 5 === 0 || pdone === list.length) { say(`正在下载海报：${pdone} / ${list.length}`); bar(0.65 + 0.25 * pdone / list.length); }
      }
    }));

    /* ---------------------------------------------------------------- 4. build data + zip */
    step(3);
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
    const profile = { id: uid, name, updated: now, url: `https://www.douban.com/people/${uid}/` };
    const dataJs = `window.PROFILE = ${JSON.stringify(profile)};\nwindow.MOVIES = ${JSON.stringify(rows)};\n`;

    if (window.__FJ_SINK) { await window.__FJ_SINK({ profile, rows, dataJs, detailed: list.filter((f) => f.detail).length, blocked }); finish('测试完成', `共 ${rows.length} 部`); return; }

    const files = {};
    for (const p of ['index.html', 'report.html', 'assets/style.css', 'assets/common.js']) {
      const r = await fetch(BASE + 'template/' + p, { cache: 'no-store' });
      if (!r.ok) throw new Error('模板文件下载失败（' + p + '），请检查网络后重试。');
      files[p] = await r.text();
    }
    files['data/movies.js'] = dataJs;
    files['README.txt'] = '\ufeff' + [
      `${name} 的观影志 · 生成于 ${now}`, '',
      '打开方式：双击 index.html（主页）或 report.html（年度报告）。',
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
      `共 ${rows.length} 部影视，已下载「${filename}」（${(zip.size / 1048576).toFixed(1)} MB）。解压后双击里面的 index.html 就能打开你的观影志。` +
      (blocked || detailed < list.length ? ` 有 ${list.length - detailed} 部的详情这次没读到（豆瓣暂时拦截了），用了列表页的简要信息；过一段时间再点一次按钮会更完整。` : ''),
      `<a class="b solid" href="${url}" download="${filename}">没有自动下载？点这里</a><button class="ok-btn">关闭</button>`);
  } catch (err) {
    if (!cancelled) fail('出了点问题：' + (err && err.message || err) + ' 刷新页面后可以再点一次按钮重试。');
  }

  /* ---------------------------------------------------------------- helpers */
  function parseIntro(f) {
    const COUNTRIES = new Set(`中国大陆 中国香港 中国台湾 中国澳门 中国 美国 日本 韩国 英国 法国 德国 意大利 西班牙 印度 泰国 俄罗斯 苏联 加拿大 澳大利亚
      爱尔兰 瑞典 巴西 丹麦 新加坡 墨西哥 阿根廷 比利时 荷兰 瑞士 奥地利 波兰 伊朗 土耳其 新西兰 挪威 芬兰 匈牙利 捷克 希腊 葡萄牙 以色列 黎巴嫩
      冰岛 智利 哥伦比亚 南非 越南 菲律宾 马来西亚 印度尼西亚 卡塔尔 罗马尼亚 保加利亚 塞尔维亚 乌克兰 格鲁吉亚 西德 东德 捷克斯洛伐克 南斯拉夫
      卢森堡 埃及 摩洛哥 突尼斯 沙特阿拉伯 阿联酋 约旦 巴勒斯坦 不丹 尼泊尔 蒙古 哈萨克斯坦 古巴 秘鲁 乌拉圭 爱沙尼亚 拉脱维亚 立陶宛 克罗地亚
      斯洛文尼亚 斯洛伐克 波黑 北马其顿 马其顿 阿尔巴尼亚 塞浦路斯 马耳他 摩纳哥 柬埔寨 老挝 缅甸 孟加拉国 巴基斯坦 斯里兰卡 阿富汗 伊拉克 叙利亚
      肯尼亚 尼日利亚 塞内加尔 乍得 毛里塔尼亚 阿尔及利亚 委内瑞拉 玻利维亚 巴拉圭 厄瓜多尔 多米尼加 波多黎各 朝鲜 列支敦士登 科索沃 黑山`.split(/\s+/));
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
