/* 脉络 · 社媒数据台 — 本地单页应用 */
(function () {
  'use strict';

  /* ============ 平台定义 ============ */
  const PLATFORMS = [
    { key: 'bilibili', name: 'B站',      glyph: 'B',  color: '#00A1D6', bg: '#E8F7FD' },
    { key: 'douyin',   name: '抖音',     glyph: '抖', color: '#18181B', bg: '#F0F0F2' },
    { key: 'xhs',      name: '小红书',   glyph: '红', color: '#FF2442', bg: '#FFECEF' },
    { key: 'sph',      name: '视频号',   glyph: '视', color: '#FA9D3B', bg: '#FFF2E4' },
    { key: 'youtube',  name: 'YouTube',  glyph: '▶',  color: '#FF0033', bg: '#FFE9EC' },
    { key: 'x',        name: 'X',        glyph: 'X',  color: '#18181B', bg: '#F0F0F2' },
    { key: 'tiktok',   name: 'TikTok',   glyph: '♪',  color: '#010101', bg: '#F0F0F2' },
    { key: 'instagram',name: 'Instagram',glyph: '◎',  color: '#E1306C', bg: '#FFEAF3' },
    { key: 'reddit',   name: 'Reddit',   glyph: 'r/', color: '#FF4500', bg: '#FFEDE6' },
    { key: 'discord',  name: 'Discord',  glyph: 'D',  color: '#5865F2', bg: '#ECEEFE' }
  ];
  // 各平台默认播放占比（用于新建内容在缺省权重时按平台分配）
  const SHARE = {
    bilibili: .09, douyin: .30, xhs: .16, sph: .06, youtube: .03, x: .22,
    tiktok: .07, instagram: .04, reddit: .02, discord: .01
  };
  const PMAP = Object.fromEntries(PLATFORMS.map(p => [p.key, p]));
  const KEYS = PLATFORMS.map(p => p.key);
  const STORE_KEY = 'mailuo-social-dashboard-v2';

  /* ============ 工具 ============ */
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const fmt = n => Math.round(n || 0).toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const engRate = st => {
    if (!st || !st.views) return 0;
    return ((st.likes + st.comments + st.saves + st.shares) / st.views) * 100;
  };
  const sum = arr => arr.reduce((a, b) => a + b, 0);
  const picon = (key, extra = '') => {
    const p = PMAP[key] || { color: '#999', bg: '#f0f0f4', glyph: '?' };
    return `<span class="picon" style="background:${p.bg};color:${p.color};${extra}">${p.glyph}</span>`;
  };
  const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; };
  // 平台多了以后，图表按数值取前 N 名，其余合并为「其他」，避免图例与线条过密
  function groupSeries(list, max = 6) {
    if (list.length <= max + 1) return list;
    const sorted = list.slice().sort((a, b) => sum(b.values) - sum(a.values));
    const head = sorted.slice(0, max);
    const rest = sorted.slice(max);
    head.push({
      name: '其他', color: '#C7C7CC',
      values: rest[0].values.map((_, i) => sum(rest.map(r => r.values[i] || 0)))
    });
    return head;
  }

  /* ============ 演示数据 ============ */
  function genHistory(followers, days = 30) {
    // 没有真实粉丝数时不伪造历史，避免出现「0 粉丝却有涨粉」
    if (!followers || followers <= 0) return [];
    const out = [], base = Math.max(1, followers * 0.0017);
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(today(), -i);
      let v = Math.round(base * (0.4 + Math.random() * 1.7));
      if (Math.random() < 0.09) v = Math.round(v * 2.3);
      out.push({ date: dateKey(d), delta: v });
    }
    return out;
  }
  function makeStats(total, weights) {
    // 权重按 KEYS 顺序排列；未提供或数量不足时按平台默认占比补齐，最后归一化
    const w = KEYS.map((k, i) => (weights && weights[i] != null) ? weights[i] : (SHARE[k] || 0));
    const tw = sum(w) || 1;
    const views = w.map(x => Math.round(total * x / tw));
    views[0] += Math.round(total || 0) - sum(views);
    const out = {};
    KEYS.forEach((k, i) => {
      const v = Math.max(0, views[i]);
      out[k] = {
        views: v,
        likes: Math.round(v * (0.018 + Math.random() * 0.022)),
        comments: Math.round(v * (0.003 + Math.random() * 0.004)),
        saves: Math.round(v * (0.006 + Math.random() * 0.012)),
        shares: Math.round(v * (0.002 + Math.random() * 0.005))
      };
    });
    return out;
  }
  const SEED_FOLLOWERS = {
    bilibili: 16139, douyin: 12863, xhs: 19475, sph: 4601, youtube: 325, x: 6042,
    tiktok: 5210, instagram: 3860, reddit: 1240, discord: 680
  };
  function seedAccount(p) {
    const f = SEED_FOLLOWERS[p.key] || 800;
    return {
      id: 'acc_' + p.key, platform: p.key,
      name: p.name + ' · 主账号', handle: '@mailuo_' + p.key,
      followers: f, history: genHistory(f)
    };
  }
  function seedAccounts() { return PLATFORMS.map(seedAccount); }
  function seedState() {
    const accounts = seedAccounts();
    const P = (daysAgo, title, total, status, weights) => {
      const d = addDays(today(), -daysAgo);
      return {
        id: 'post_' + Math.random().toString(36).slice(2, 9),
        title, date: dateKey(d), time: '18:00', status: status || '已发布',
        cover: title, stats: makeStats(total, weights)
      };
    };
    const posts = [
      P(2, '10 个 Bot 组成的编辑部', 7005, '已发布', [609 / 7005, 2245 / 7005, 1177 / 7005, 464 / 7005, 202 / 7005, 2240 / 7005, 68 / 7005]),
      P(4, '我的 Agent 记', 6181),
      P(6, '给爸妈做一个防诈骗助手', 20993),
      P(9, 'AI 剪辑实测：嘟嘟', 9840),
      P(12, '帮我读完 50 本书', 16216),
      P(16, '用 AI 做一支产品', 12480),
      P(20, '微信读书助手', 7310),
      P(25, '一场 AI 直播复盘', 5320),
      { id: 'post_f1', title: '把微信群聊交给 AI', date: dateKey(today()), time: '18:00', status: '等待点布', cover: '把微信群聊交给 AI', stats: makeStats(0) },
      { id: 'post_f2', title: 'AI 剪辑实测：第二期', date: dateKey(addDays(today(), 2)), time: '18:00', status: '计划中', cover: 'AI 剪辑实测：第二期', stats: makeStats(0) }
    ];
    return { accounts, posts, activeView: 'dashboard', range: 7, schema: SCHEMA, month: { y: today().getFullYear(), m: today().getMonth() } };
  }
  const SCHEMA = 4; // 数据结构版本：用于老数据一次性迁移
  function loadState() {
    let s = seedState();
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.accounts && parsed.posts) {
          s = Object.assign(seedState(), parsed);
          s.schema = parsed.schema || 0; // 老数据没有版本号 → 触发一次迁移
        }
      }
    } catch (e) { /* ignore */ }
    const prev = s.schema || 0;
    if (prev !== SCHEMA) {
      // 清理已下线平台的账号与内容数据（不在当前平台列表中的一律移除）
      s.accounts = (s.accounts || []).filter(a => PMAP[a.platform]);
      (s.posts || []).forEach(p => {
        if (!p.stats) return;
        Object.keys(p.stats).forEach(k => { if (!PMAP[k]) delete p.stats[k]; });
      });
      if (prev < 3) {
        // 迁移：补齐当时新增平台的账号（老数据里只有最初 7 个平台）
        const has = new Set((s.accounts || []).map(a => a.platform));
        PLATFORMS.forEach(p => { if (!has.has(p.key)) s.accounts.push(seedAccount(p)); });
        // 迁移：老内容补齐新平台的播放/互动数据，避免卡片显示 0
        (s.posts || []).forEach(p => {
          if (!p.stats) p.stats = {};
          const base = sum(KEYS.map(k => (p.stats[k] || {}).views || 0));
          KEYS.forEach(k => {
            if (p.stats[k]) return;
            const v = Math.round(base * (SHARE[k] || 0));
            p.stats[k] = {
              views: v,
              likes: Math.round(v * (0.018 + Math.random() * 0.022)),
              comments: Math.round(v * (0.003 + Math.random() * 0.004)),
              saves: Math.round(v * (0.006 + Math.random() * 0.012)),
              shares: Math.round(v * (0.002 + Math.random() * 0.005))
            };
          });
        });
      }
      s.schema = SCHEMA;
      // 迁移结果立即落盘，避免用户删掉某平台账号后又被自动补回
      try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
    }
    return s;
  }
  let state = loadState();
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /* ============ 真实账号导入（调用本机服务抓取） ============ */
  const LOCAL_API = (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
    ? location.origin
    : 'http://127.0.0.1:8899';
  async function localApi(path, data) {
    let res;
    try {
      res = await fetch(LOCAL_API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {})
      });
    } catch (e) {
      throw new Error('连不上本机服务，请先双击运行「启动发布中心.bat」再试');
    }
    if (!res.ok) throw new Error('本机服务返回 HTTP ' + res.status);
    return res.json();
  }
  function rsStatus(msg, kind) {
    const el = $('#rsStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = kind === 'err' ? '#c0392b' : kind === 'ok' ? '#1d9d74' : '';
  }
  // 把抓取结果写入账号：优先更新同名账号；否则把该平台的示例账号升级为真实账号；再否则新建
  function applyReal(d, input) {
    const key = dateKey(today());
    const f = d.followers == null ? null : Math.max(0, Math.round(d.followers));
    const raw = input;
    let hit = state.accounts.find(a => a.platform === d.platform && ((d.handle && a.handle === d.handle) || (a.url && a.url === raw)));
    if (!hit) hit = state.accounts.find(a => a.platform === d.platform && !a.real); // 示例账号原地升级
    if (hit) {
      const wasReal = !!hit.real;
      const prev = +hit.followers || 0;
      if (f != null) hit.followers = f;
      hit.name = d.name || hit.name;
      hit.handle = d.handle || hit.handle;
      hit.real = true; hit.url = raw; hit.lastSync = key; hit.source = d.source || hit.source;
      // 示例账号的假历史要丢掉，真实账号则保留并累计当天变化
      if (!Array.isArray(hit.history) || !wasReal) hit.history = [];
      const last = hit.history[hit.history.length - 1];
      // 首次抓取（示例→真实 / 原本没有基线）只记基线，不算涨粉
      const delta = (f != null && wasReal && prev) ? f - prev : 0;
      if (last && last.date === key) last.delta = (last.delta || 0) + delta;
      else hit.history.push({ date: key, delta });
      return hit;
    }
    const acc = {
      id: 'acc_' + Math.random().toString(36).slice(2, 9),
      platform: d.platform,
      name: d.name || (PMAP[d.platform] ? PMAP[d.platform].name : d.platform),
      handle: d.handle || raw,
      followers: f == null ? 0 : f,
      real: true, url: raw, source: d.source || '', lastSync: key,
      history: [{ date: key, delta: 0 }]
    };
    state.accounts.push(acc);
    return acc;
  }

  /* ============ 派生计算 ============ */
  function historyOf(key) {
    const map = {};
    state.accounts.filter(a => a.platform === key).forEach(a =>
      (a.history || []).forEach(h => { map[h.date] = (map[h.date] || 0) + (h.delta || 0); })
    );
    return Object.keys(map).sort().map(d => ({ date: d, delta: map[d] }));
  }
  function allHistory() {
    const map = {};
    state.accounts.forEach(a => (a.history || []).forEach(h => { map[h.date] = (map[h.date] || 0) + (h.delta || 0); }));
    return Object.keys(map).sort().map(d => ({ date: d, delta: map[d] }));
  }
  function totalFans() { return sum(state.accounts.map(a => +a.followers || 0)); }
  function gain(days) { return sum(allHistory().slice(-days).map(h => h.delta)); }
  function published() { return state.posts.filter(p => p.status === '已发布'); }
  function postTotal(p) { return sum(KEYS.map(k => (p.stats[k] || {}).views || 0)); }
  function postEngagement(p) {
    const s = KEYS.reduce((acc, k) => {
      const x = p.stats[k] || {};
      ['likes', 'comments', 'saves', 'shares'].forEach(f => { acc[f] = (acc[f] || 0) + (x[f] || 0); });
      return acc;
    }, {});
    return { ...s, views: postTotal(p), rate: engRate({ ...s, views: postTotal(p) }) };
  }
  function recentPosts(days) {
    const from = dateKey(addDays(today(), -days + 1));
    return published().filter(p => p.date >= from && p.date <= dateKey(today()));
  }
  function platformAgg(key) {
    const accs = state.accounts.filter(a => a.platform === key);
    const h = historyOf(key);
    const ps = published();
    const views = sum(ps.map(p => (p.stats[key] || {}).views || 0));
    const eng = sum(ps.map(p => {
      const s = p.stats[key] || {};
      return (s.likes || 0) + (s.comments || 0) + (s.saves || 0) + (s.shares || 0);
    }));
    const top = ps.slice().sort((a, b) => ((b.stats[key] || {}).views || 0) - ((a.stats[key] || {}).views || 0))[0];
    return {
      key, followers: sum(accs.map(a => +a.followers || 0)),
      today: h.length ? h[h.length - 1].delta : 0,
      week: sum(h.slice(-7).map(x => x.delta)), series: h.map(x => x.delta),
      views, rate: views ? eng / views * 100 : 0,
      topTitle: top ? top.title : '—', topViews: top ? (top.stats[key] || {}).views || 0 : 0,
      count: accs.length
    };
  }
  function dailyViews(days = 30) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(today(), -i), k = dateKey(d);
      let v = 0;
      published().forEach(p => {
        const age = Math.round((new Date(k) - new Date(p.date)) / 86400000);
        if (age >= 0 && age < 8) v += postTotal(p) * [0.38, 0.24, 0.15, 0.09, 0.06, 0.04, 0.025, 0.015][age];
      });
      out.push({ date: k, value: Math.round(v) });
    }
    return out;
  }

  /* ============ SVG 图表 ============ */
  let gid = 0;
  function smoothPath(pts) {
    if (pts.length < 2) return '';
    let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], cx = (a.x + b.x) / 2;
      d += ` C${cx.toFixed(1)},${a.y.toFixed(1)} ${cx.toFixed(1)},${b.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
    }
    return d;
  }
  function stackedChart(dates, series, opts = {}) {
    const W = 640, H = 248, PL = 38, PR = 10, PT = 18, PB = 26;
    const pw = W - PL - PR, ph = H - PT - PB;
    const totals = dates.map((_, i) => sum(series.map(s => s.values[i] || 0)));
    const yMax = Math.max(Math.ceil(Math.max(...totals, 1) / 50) * 50, 50);
    const step = pw / dates.length, bw = Math.max(3, Math.min(15, step * .62));
    let g = '';
    [0, .5, 1].forEach(f => {
      const y = PT + ph * (1 - f);
      g += `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="#edf0f6"/>`;
      g += `<text x="${PL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#b2b2c3">${Math.round(yMax * f)}</text>`;
    });
    dates.forEach((d, i) => {
      let acc = 0; const x = PL + step * i + (step - bw) / 2;
      series.forEach(s => {
        const v = s.values[i] || 0, h = ph * v / yMax, y = PT + ph - acc - h;
        acc += h;
        g += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="1" fill="${s.color}"><title>${d} · ${s.name} +${fmt(v)}</title></rect>`;
      });
      if (i % 5 === 0 || i === dates.length - 1)
        g += `<text x="${(PL + step * i + step / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle" font-size="9.5" fill="#b2b2c3">${d.slice(5)}</text>`;
    });
    (opts.notes || []).forEach(n => {
      const x = PL + step * n.index + step / 2;
      g += `<line x1="${x.toFixed(1)}" y1="${PT}" x2="${x.toFixed(1)}" y2="${PT + ph}" stroke="#b9c6e8" stroke-dasharray="3 4"/>`;
      g += `<text x="${(x + 4).toFixed(1)}" y="${PT + 11 + (n.row || 0) * 12}" font-size="9.5" fill="#5c78bd" font-weight="700">${esc(n.label)}</text>`;
    });
    return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}">${g}</svg></div>`;
  }
  function lineChart(dates, series, opts = {}) {
    const W = 660, H = 258, PL = 46, PR = 12, PT = 18, PB = 28;
    const pw = W - PL - PR, ph = H - PT - PB;
    const all = series.reduce((a, s) => a.concat(s.values), []);
    const hi = Math.max(...all, 1), lo = Math.min(...all);
    let yMin = 0, yMax = Math.max(Math.ceil(hi * 1.12), 10);
    // 累计值这类高位窄幅数据：从 0 起画会压成一条直线，改为按数据区间自适应
    if (opts.zoom) {
      const pad = Math.max(1, (hi - lo) * 0.25);
      yMin = Math.max(0, Math.floor(lo - pad));
      yMax = Math.ceil(hi + pad);
    }
    const xAt = i => PL + pw * (dates.length < 2 ? 0 : i / (dates.length - 1));
    const yAt = v => PT + ph * (1 - (v - yMin) / (yMax - yMin || 1));
    let g = '';
    [0, .25, .5, .75, 1].forEach(f => {
      const y = PT + ph * (1 - f);
      g += `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="#eef0f6"/>`;
      g += `<text x="${PL - 7}" y="${y + 4}" text-anchor="end" font-size="10" fill="#b2b2c3">${fmt(yMin + (yMax - yMin) * f)}</text>`;
    });
    series.forEach((s, si) => {
      const pts = s.values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
      const d = smoothPath(pts);
      if (opts.area && si === 0) {
        const id = 'area' + (++gid);
        const ar = `M${pts[0].x.toFixed(1)},${(PT + ph).toFixed(1)} ` + pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ` L${pts[pts.length - 1].x.toFixed(1)},${(PT + ph).toFixed(1)} Z`;
        g += `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".26"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs><path d="${ar}" fill="url(#${id})"/>`;
      }
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2.2}" stroke-linecap="round" stroke-linejoin="round"/>`;
      pts.forEach((p, i) => { g += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${s.color}" opacity="0"><title>${dates[i]} · ${s.name} ${fmt(s.values[i])}</title></circle><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.4" fill="#fff" stroke="${s.color}" stroke-width="1.6"/>`; });
    });
    dates.forEach((d, i) => { if (i % 5 === 0 || i === dates.length - 1) g += `<text x="${xAt(i).toFixed(1)}" y="${H - 7}" text-anchor="middle" font-size="9.5" fill="#b2b2c3">${d.slice(5)}</text>`; });
    return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}">${g}</svg></div>`;
  }
  function barChart(labels, values, color = '#0071e3') {
    const W = 640, H = 210, PL = 30, PR = 10, PT = 14, PB = 26;
    const pw = W - PL - PR, ph = H - PT - PB;
    const yMax = Math.max(Math.ceil(Math.max(...values, 1) * 1.2), 3);
    const step = pw / labels.length, bw = Math.min(26, step * .5);
    let g = '';
    [0, .5, 1].forEach(f => {
      const y = PT + ph * (1 - f);
      g += `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="#eef0f6"/><text x="${PL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#b2b2c3">${Math.round(yMax * f)}</text>`;
    });
    labels.forEach((l, i) => {
      const h = ph * values[i] / yMax, x = PL + step * i + (step - bw) / 2, y = PT + ph - h;
      g += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="4" fill="${color}" opacity=".85"><title>${l} · ${values[i]}</title></rect>`;
      g += `<text x="${(PL + step * i + step / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle" font-size="9.5" fill="#b2b2c3">${l.slice(5)}</text>`;
    });
    return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}">${g}</svg></div>`;
  }
  function donutChart(items, opts = {}) {
    const size = 170, c = size / 2, r = 66, sw = 20, total = sum(items.map(i => i.value)) || 1;
    const C = 2 * Math.PI * r; let off = 0, g = '';
    items.forEach(it => {
      const len = it.value / total * C;
      g += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${sw}" stroke-dasharray="${Math.max(0, len - 2).toFixed(2)} ${(C - len + 2).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${c} ${c})"><title>${it.name} ${fmt(it.value)}</title></circle>`;
      off += len;
    });
    g += `<text x="${c}" y="${c - 1}" text-anchor="middle" font-size="19" font-weight="800" fill="#1b1b2b">${opts.value != null ? opts.value : fmt(total)}</text><text x="${c}" y="${c + 16}" text-anchor="middle" font-size="10" fill="#a0a0b4">${opts.label || '总播放'}</text>`;
    return `<svg viewBox="0 0 ${size} ${size}" style="width:158px;height:158px;flex:none">${g}</svg>`;
  }
  function sparkline(values, color) {
    const id = 'sp' + (++gid), W = 120, H = 36, P = 2;
    const max = Math.max(...values, 1) * 1.12;
    const pts = values.map((v, i) => ({ x: P + (W - 2 * P) * (i / (values.length - 1 || 1)), y: H - P - (H - 2 * P) * v / max }));
    const ar = `M${pts[0].x.toFixed(1)},${H} ` + pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ` L${pts[pts.length - 1].x.toFixed(1)},${H} Z`;
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:36px;display:block"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${ar}" fill="url(#${id})"/><path d="${smoothPath(pts)}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  }

  /* ============ 分析文案 ============ */
  function shortInsights() {
    const hs = allHistory();
    const per = KEYS.map(k => ({ key: k, v: sum(historyOf(k).slice(-7).map(h => h.delta)) })).sort((a, b) => b.v - a.v);
    const top = per[0] || { key: 'bilibili', v: 0 }, total = sum(per.map(x => x.v)) || 1;
    const last30 = hs.slice(-30);
    const pubDates = new Set(published().map(p => p.date));
    const pubArr = last30.filter(h => pubDates.has(h.date));
    const nonArr = last30.filter(h => !pubDates.has(h.date));
    const pubAvg = pubArr.length ? sum(pubArr.map(h => h.delta)) / pubArr.length : 0;
    const nonAvg = nonArr.length ? sum(nonArr.map(h => h.delta)) / nonArr.length : 0;
    const diff = Math.round((pubAvg / (nonAvg || 1) - 1) * 100);
    const viewsByPlat = KEYS.map(k => ({ key: k, v: sum(recentPosts(30).map(p => (p.stats[k] || {}).views || 0)) })).sort((a, b) => b.v - a.v);
    const vp = viewsByPlat[0], vtotal = sum(viewsByPlat.map(x => x.v)) || 1;
    const rates = KEYS.map(k => platformAgg(k)).filter(a => a.views > 0).sort((a, b) => b.rate - a.rate);
    const best = rates[0] || { key: 'bilibili', rate: 0 }, worst = rates[rates.length - 1] || { key: 'x', rate: 0 };
    return [
      { tag: '涨粉', cls: 'g', html: `近 7 天涨粉最多的是 <b>${PMAP[top.key].name} +${fmt(top.v)}</b>，占 ${KEYS.length} 平台合计 +${fmt(total)} 的 <b>${Math.round(top.v / total * 100)}%</b>。` },
      { tag: '发布日', cls: 'g', html: `发布当天平均涨粉 <b>${fmt(pubAvg)}</b>，非发布日 <b>${fmt(nonAvg)}</b>，<b>${diff >= 0 ? '高' : '低'} ${Math.abs(diff)}%</b>。` },
      { tag: '播放', cls: 'b', html: `近 30 天 <b>${Math.round(vp.v / vtotal * 100)}%</b> 的播放来自 <b>${PMAP[vp.key].name}</b>（${fmt(vp.v)} / ${fmt(vtotal)}）。` },
      { tag: '互动', cls: 'o', html: `互动率最高的是 <b>${PMAP[best.key].name} ${best.rate.toFixed(1)}%</b>，最低 ${PMAP[worst.key].name} ${worst.rate.toFixed(1)}%，相差 <b>${(best.rate / (worst.rate || 1)).toFixed(1)} 倍</b>。` }
    ];
  }
  function recommendations() {
    const out = [];
    const rates = KEYS.map(k => platformAgg(k)).filter(a => a.views > 0).sort((a, b) => b.rate - a.rate);
    const best = rates[0], worst = rates[rates.length - 1];
    if (best) out.push(`<b>加大 ${PMAP[best.key].name} 投入：</b>互动率 ${best.rate.toFixed(1)}% 为全平台最高，建议将每周 1–2 条重点内容优先首发该平台，并尝试把爆款结构复用到其他平台。`);
    if (worst && best) out.push(`<b>优化 ${PMAP[worst.key].name} 内容形态：</b>互动率仅 ${worst.rate.toFixed(1)}%，建议缩短前 3 秒信息密度、补充字幕与封面文案，先做 2 周 A/B 测试再决定是否减投。`);
    const ps = published().slice().sort((a, b) => postTotal(b) - postTotal(a));
    if (ps[0]) {
      const dow = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(ps[0].date + 'T00:00:00').getDay()];
      out.push(`<b>固定 ${dow} 发布节奏：</b>最高播放内容《${esc(trunc(ps[0].title, 16))}》发布于 ${dow}，建议连续 4 周在同一时段发布同类选题，验证账号权重。`);
      out.push(`<b>复用高表现选题：</b>「${esc(trunc(ps[0].title, 14))}」已验证需求，可拆成清单体、前后对比、答疑三条衍生内容，间隔 5–7 天分发。`);
    }
    const w = recentPosts(7), prev = published().filter(p => p.date >= dateKey(addDays(today(), -14)) && p.date < dateKey(addDays(today(), -7)));
    const tw = sum(w.map(postTotal)), pv = sum(prev.map(postTotal));
    if (pv) out.push(`<b>本周目标：</b>当前 7 天播放 ${fmt(tw)}，上周同期 ${fmt(pv)}，${tw >= pv ? '保持' : '需回升'}。建议下周发布量 ${Math.max(3, w.length + 1)} 条，重点提升单条播放中位数而非单纯加量。`);
    else out.push(`<b>补齐历史基线：</b>上周暂无已发布内容，建议先连续发布 4 条建立基线，再评估渠道投入。`);
    return out;
  }

  /* ============ 视图：大屏 ============ */
  function viewDashboard() {
    const hs = allHistory(), dates = hs.map(h => h.date);
    const feat = published().slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    const featAgg = feat ? postEngagement(feat) : { views: 0, likes: 0, comments: 0, saves: 0, shares: 0, rate: 0 };
    const week = recentPosts(7), prevWeek = published().filter(p => p.date >= dateKey(addDays(today(), -14)) && p.date < dateKey(addDays(today(), -7)));
    const wViews = sum(week.map(postTotal)), pViews = sum(prevWeek.map(postTotal));
    const wEng = sum(week.map(p => postEngagement(p).likes + postEngagement(p).comments + postEngagement(p).saves + postEngagement(p).shares));
    const hot = week.slice().sort((a, b) => postTotal(b) - postTotal(a))[0];
    const insightHtml = shortInsights().map(i => `<div class="insight"><span class="tag ${i.cls}">${i.tag}</span>${i.html}</div>`).join('');
    const notes = [];
    published().slice(0, 2).forEach((p, i) => { const idx = dates.indexOf(p.date); if (idx >= 0) notes.push({ index: idx, label: trunc(p.title, 6), row: i % 2 }); });
    // 按平台分别取 30 天序列并对齐日期
    const alignedAll = KEYS.filter(k => state.accounts.some(a => a.platform === k)).map(k => {
      const m = Object.fromEntries(historyOf(k).map(h => [h.date, h.delta]));
      return { name: PMAP[k].name, color: PMAP[k].color, values: dates.map(d => m[d] || 0) };
    });
    const aligned = groupSeries(alignedAll, 6);
    return `
      <div class="view-head">
        <div><h1>数据大屏</h1><p>全平台内容监控 · 覆盖 ${state.accounts.length} 个账号 · 最近 ${state.range} 天</p></div>
        <div class="pill-row">
          ${[7, 14, 30].map(r => `<button class="pill ${state.range === r ? 'on' : ''}" data-action="range" data-range="${r}">近 ${r} 天</button>`).join('')}
          <button class="pill" data-action="open-post">+ 新增内容</button>
        </div>
      </div>
      <section class="plat-grid">
        ${PLATFORMS.filter(p => state.accounts.some(a => a.platform === p.key)).map(p => {
          const a = platformAgg(p.key);
          return `<div class="pcard" data-action="open-platform" data-key="${p.key}" title="进入 ${p.name} 多账号分析">
            <span class="pc-go">›</span>
            <div class="pc-head">${picon(p.key)}<span class="pname">${p.name}</span>${a.count > 1 ? `<span class="pc-n">${a.count}</span>` : ''}</div>
            <div class="pc-follow">${fmt(a.followers)}</div>
            <div class="pc-chips"><span class="pc-chip">今日 <b class="up">+${fmt(a.today)}</b></span><span class="pc-chip">7天 <b class="up">+${fmt(a.week)}</b></span></div>
            ${sparkline(a.series.slice(-30), p.color)}
            <div class="pc-foot"><div>7日播放<b>${fmt(sum(recentPosts(7).map(x => (x.stats[p.key] || {}).views || 0)))}</b></div><div>互动率<b>${a.rate.toFixed(1)}%</b></div></div>
          </div>`;
        }).join('')}
      </section>
      <section class="grid g-dash">
        <div class="card">
          <div class="card-head"><div class="card-title">最新发布</div><div class="card-sub">全平台同步状态</div></div>
          ${feat ? `<div class="featured">
            <div class="cover"><span class="cv-badge">第 ${published().length} 期</span><div class="cv-title">${esc(feat.cover)}</div><div class="cv-bar"></div><div class="cv-foot">口播稿从 2 小时到 20 分钟</div><div class="cv-live"><i class="dot green"></i>${KEYS.filter(k => (feat.stats[k] || {}).views > 0).length}/${KEYS.length} 平台已发布</div></div>
            <div>
              <div class="date-pills"><span class="date-pill on">昨天 18:00</span><span class="date-pill">明天 18:00</span><span class="date-pill">${dateKey(today()).slice(5)} 18:00</span></div>
              <div class="feat-title">${esc(feat.title)}</div>
              <div class="feat-meta">${feat.date} ${feat.time} 发布 · 数据持续更新</div>
              <div class="plat-nums">${(() => {
                const rows = KEYS.map(k => ({ k, v: (feat.stats[k] || {}).views || 0 })).filter(r => r.v > 0).sort((a, b) => b.v - a.v);
                const top = rows.slice(0, 5), rest = rows.slice(5);
                return top.map(r => `<div class="plat-num">${picon(r.k)}<span>${fmt(r.v)}</span></div>`).join('')
                  + (rest.length ? `<div class="plat-num plat-num-more">+${rest.length} 平台<span>${fmt(sum(rest.map(r => r.v)))}</span></div>` : '');
              })()}</div>
              <div class="metrics">
                <div class="metric"><div class="m-label">全平台播放</div><div class="m-val">${fmt(featAgg.views)}</div></div>
                <div class="metric"><div class="m-label">互动（赞评藏转）</div><div class="m-val">${fmt(featAgg.likes + featAgg.comments + featAgg.saves + featAgg.shares)}</div></div>
                <div class="metric"><div class="m-label">互动率</div><div class="m-val sm">${featAgg.rate.toFixed(1)}%</div></div>
              </div>
              <div class="progress"><i style="width:${Math.min(100, Math.max(8, pViews ? wViews / pViews * 100 : 68))}%"></i></div>
              <div class="card-sub" style="margin-top:6px">上周同期 ${fmt(pViews)} 播放 · 本周 ${fmt(wViews)}</div>
            </div>
          </div>` : '<div class="hint">暂无已发布内容，点击右上角新增。</div>'}
        </div>
        <div class="card">
          <div class="card-head"><div><div class="card-title">粉丝</div><div class="card-sub">多平台合计</div></div><div class="card-sub">不含未接入账号</div></div>
          <div class="fans-num">${fmt(totalFans())}</div>
          <div class="pill-row" style="margin-bottom:14px">
            <span class="chip">今日 <strong class="up">+${fmt(gain(1))}</strong></span>
            <span class="chip">近 7 天 <strong class="up">+${fmt(gain(7))}</strong></span>
            <span class="chip">近 30 天 <strong class="up">+${fmt(gain(30))}</strong></span>
          </div>
          <div class="card-sub" style="margin-bottom:8px">每日净增 · 近 30 天</div>
          ${stackedChart(dates, aligned, { notes })}
          <div class="legend" style="margin-top:10px">${aligned.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>
          <div class="chart-note">全部平台均有记录 · 悬停查看每日明细</div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">数据分析</div><div class="card-sub">按规则自动算</div></div>
          <div class="insight-list">${insightHtml}</div>
          <div class="chart-note" style="margin-top:12px">每日更新 · 规则基于当前数据自动计算</div>
        </div>
      </section>
      <section class="week-strip">
        <div class="stat"><div class="ico" style="background:#e8f1fd;color:#0071e3">✎</div><div><div class="lbl">发布数量（7天）</div><div class="val">${week.length} <span style="font-size:12px;color:#a1a1a6">条</span></div><div class="sub">上周 ${prevWeek.length} 条</div></div></div>
        <div class="stat"><div class="ico" style="background:#e6f5ef;color:#1d9d74">▶</div><div><div class="lbl">全平台播放（7天）</div><div class="val">${fmt(wViews)}</div><div class="sub ${pViews ? (wViews >= pViews ? 'up' : 'down') : ''}">${pViews ? (wViews >= pViews ? '↑' : '↓') + Math.abs(Math.round((wViews / pViews - 1) * 100)) + '% vs 上周' : '暂无上周数据'}</div></div></div>
        <div class="stat"><div class="ico" style="background:#fff2e0;color:#e08a00">✦</div><div><div class="lbl">互动总量（7天）</div><div class="val">${fmt(wEng)}</div><div class="sub">互动率 ${wViews ? (wEng / wViews * 100).toFixed(1) : '0.0'}%</div></div></div>
        <div class="stat"><div class="mini-cover">${esc(trunc(hot ? hot.cover : '暂无', 8))}</div><div style="min-width:0"><div class="lbl">最热素材（7天）</div><div class="val stat-title">${esc(hot ? hot.title : '—')}</div><div class="sub">${fmt(hot ? postTotal(hot) : 0)} 播放</div></div></div>
      </section>
      <section class="card mt14">
        <div class="card-head"><div class="card-title">近期内容明细</div><div class="card-sub">按发布时间倒序 · 点击上方平台卡片进入该平台多账号分析</div></div>
        ${postTable(state.filterKey ? published().filter(p => (p.stats[state.filterKey] || {}).views > 0) : published().slice(0, 8))}
      </section>`;
  }

  /* ============ 视图：流量 ============ */
  function viewTraffic() {
    const days = 14;
    const labels = [], counts = [];
    for (let i = days - 1; i >= 0; i--) { const k = dateKey(addDays(today(), -i)); labels.push(k); counts.push(published().filter(p => p.date === k).length); }
    const dv = dailyViews(30), dates = dv.map(x => x.date);
    const series = KEYS.filter(k => state.accounts.some(a => a.platform === k)).map(k => {
      const vals = dates.map(d => {
        let v = 0;
        published().forEach(p => {
          const age = Math.round((new Date(d) - new Date(p.date)) / 86400000);
          if (age >= 0 && age < 8) v += ((p.stats[k] || {}).views || 0) * [0.38, 0.24, 0.15, 0.09, 0.06, 0.04, 0.025, 0.015][age];
        });
        return Math.round(v);
      });
      return { name: PMAP[k].name, color: PMAP[k].color, values: vals };
    });
    const seriesTop = groupSeries(series, 6);
    const wk = recentPosts(7);
    const rawDonut = KEYS.filter(k => state.accounts.some(a => a.platform === k)).map(k => ({ name: PMAP[k].name, color: PMAP[k].color, value: sum(wk.map(p => (p.stats[k] || {}).views || 0)) })).filter(x => x.value > 0).sort((a, b) => b.value - a.value);
    const donutItems = rawDonut.length > 8
      ? rawDonut.slice(0, 7).concat([{ name: '其他', color: '#C7C7CC', value: sum(rawDonut.slice(7).map(x => x.value)) }])
      : rawDonut;
    return `
      <div class="view-head"><div><h1>流量</h1><p>发布节奏、播放走势与平台流量结构</p></div>
        <div class="pill-row">${[7, 14, 30].map(r => `<button class="pill ${state.range === r ? 'on' : ''}" data-action="range" data-range="${r}">近 ${r} 天</button>`).join('')}</div>
      </div>
      <section class="grid g-traffic">
        <div class="card">
          <div class="card-head"><div><div class="card-title">播放走势（按平台）</div><div class="card-sub">按发布后 8 天衰减模型估算每日播放</div></div><div class="legend">${seriesTop.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div></div>
          ${lineChart(dates, seriesTop, { area: true })}
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">平台流量结构（7天）</div><div class="card-sub">${fmt(sum(donutItems.map(x => x.value)))} 次播放</div></div>
          <div class="donut-wrap">${donutChart(donutItems)}<div class="donut-list">${donutItems.sort((a, b) => b.value - a.value).map(x => `<div class="donut-item"><i style="background:${x.color}"></i><span class="nm">${x.name}</span><b>${Math.round(x.value / (sum(donutItems.map(y => y.value)) || 1) * 100)}%</b></div>`).join('')}</div></div>
          <div class="chart-note" style="margin-top:14px">占比最高的平台决定整体播放基本盘，互动率另见「分析」页。</div>
        </div>
      </section>
      <section class="card mt14">
        <div class="card-head"><div class="card-title">发布节奏（近 14 天）</div><div class="card-sub">共 ${sum(counts)} 条已发布内容</div></div>
        ${barChart(labels, counts, '#0071e3')}
      </section>
      <section class="card mt14">
        <div class="card-head"><div class="card-title">平台数据明细</div><div class="card-sub">近 7 天已发布内容汇总</div></div>
        ${platformTable(wk)}
      </section>`;
  }

  /* ============ 视图：日历 ============ */
  function viewCalendar() {
    const y = state.month.y, m = state.month.m;
    const first = new Date(y, m, 1), start = new Date(first); start.setDate(1 - first.getDay());
    const cells = [];
    for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
    const last = new Date(y, m + 1, 0);
    const future = state.posts.filter(p => p.status !== '已发布').length;
    return `
      <div class="view-head"><div><h1>日历</h1><p>近两周发布安排 · 接下来还有 ${future} 期要发</p></div>
        <div class="cal-head"><button data-action="month-prev">‹</button><div class="cal-title">${y} 年 ${m + 1} 月</div><button data-action="month-next">›</button><button class="btn btn-primary" data-action="open-post">+ 新增内容</button></div>
      </div>
      <div class="card">
        <div class="cal-scroll">
        <div class="cal-grid">${['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(d => `<div class="cal-dow">${d}</div>`).join('')}</div>
        <div class="cal-grid" style="margin-top:6px">
          ${cells.map(d => {
            const k = dateKey(d), out = d.getMonth() !== m || d.getFullYear() !== y;
            const ps = state.posts.filter(p => p.date === k);
            const isToday = k === dateKey(today());
            return `<div class="cal-cell ${out ? 'out' : ''} ${isToday ? 'today' : ''}" data-action="day" data-date="${k}">
              <div class="cal-day">${d.getDate()}${isToday ? ' · 今天' : ''}</div>
              ${ps.slice(0, 2).map(p => `<div class="cal-post"><div class="nm">${esc(trunc(p.title, 12))}</div><div class="mt"><i class="dot ${p.status === '已发布' ? 'green' : p.status === '计划中' ? 'blue' : 'orange'}"></i> ${p.time} · ${p.status === '已发布' ? '已发布 · ' + fmt(postTotal(p)) : p.status}</div></div>`).join('')}
              ${ps.length > 2 ? `<div class="cal-more">+${ps.length - 2} 更多</div>` : ''}
            </div>`;
          }).join('')}
        </div>
        </div>
        <div class="cal-hint">左右滑动查看整月 →</div>
      </div>
      <div class="pill-row">
        <span class="chip"><i class="dot green"></i>已发布</span><span class="chip"><i class="dot blue"></i>已定时</span><span class="chip"><i class="dot orange"></i>等待点布</span><span class="chip"><i class="dot gray"></i>计划中</span><span class="chip"><i class="dot red"></i>异常</span>
      </div>`;
  }

  /* ============ 视图：分析 ============ */
  function viewInsights() {
    const ins = shortInsights();
    const ps = published().slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    const dv = dailyViews(30);
    return `
      <div class="view-head"><div><h1>分析</h1><p>基于现有数据的归因、复盘与未来行动建议</p></div>
        <div class="pill-row"><button class="btn btn-primary" data-action="open-post">+ 新增内容</button></div>
      </div>
      <section class="grid g-insights">
        <div class="card">
          <div class="card-head"><div class="card-title">数据归因</div><div class="card-sub">规则自动计算</div></div>
          <div class="insight-list">${ins.map(i => `<div class="insight"><span class="tag ${i.cls}">${i.tag}</span>${i.html}</div>`).join('')}</div>
          <div class="sec-label" style="margin-top:18px">未来建议</div>
          ${recommendations().map((r, i) => `<div class="rec"><div class="rn">${i + 1}</div><div class="rt">${r}</div></div>`).join('')}
        </div>
        <div class="card">
          <div class="card-head"><div><div class="card-title">播放走势</div><div class="card-sub">全平台每日播放估算 · 近 30 天</div></div></div>
          ${lineChart(dv.map(x => x.date), [{ name: '全平台播放', color: '#0071e3', values: dv.map(x => x.value) }], { area: true })}
          <div class="sec-label" style="margin-top:18px">内容复盘 · 最近 6 条</div>
          <div class="tbl-wrap"><table><thead><tr><th>内容</th><th>发布时间</th><th>全平台播放</th><th>互动率</th><th>相对上一条</th></tr></thead><tbody>
            ${ps.map((p, i) => {
              const t = postTotal(p), r = postEngagement(p).rate;
              const prevT = ps[i + 1] ? postTotal(ps[i + 1]) : 0;
              const d = prevT ? Math.round((t / prevT - 1) * 100) : 0;
              return `<tr><td>${esc(trunc(p.title, 14))}</td><td>${p.date}</td><td><b>${fmt(t)}</b></td><td>${r.toFixed(1)}%</td><td class="${d >= 0 ? 'up' : 'down'}">${prevT ? (d >= 0 ? '+' : '') + d + '%' : '—'}</td></tr>`;
            }).join('')}
          </tbody></table></div>
          <div class="chart-note" style="margin-top:12px">同一选题在不同平台的互动率差异，建议以互动率而非绝对播放量作为投放依据。</div>
        </div>
      </section>`;
  }

  /* ============ 视图：账号 ============ */
  function viewAccounts() {
    const realN = state.accounts.filter(a => a.real).length;
    return `
      <div class="view-head"><div><h1>账号管理</h1><p>从平台主页链接导入真实账号 · 数据存于本机浏览器</p></div>
        <div class="pill-row"><button class="btn btn-ghost" data-action="export">导出数据</button><button class="btn btn-ghost" data-action="import">导入数据</button><button class="btn btn-danger" data-action="reset">重置示例</button></div>
      </div>
      <section class="grid g-traffic">
        <div class="card">
          <div class="card-head"><div class="card-title">已接入账号（${state.accounts.length}）</div><div class="card-sub">真实 ${realN} · 示例 ${state.accounts.length - realN} · 粉丝总数 ${fmt(totalFans())}</div></div>
          <div class="acc-list">${state.accounts.map(a => `
            <div class="acc-row">${picon(a.platform)}<div style="flex:1;min-width:0"><div class="acc-name">${esc(a.name)} ${a.real ? '<span class="src-badge real">真实</span>' : '<span class="src-badge demo">示例</span>'}</div><div class="acc-handle">${esc(a.handle)} · ${PMAP[a.platform].name}${a.lastSync ? ' · ' + a.lastSync + ' 同步' : ''}</div></div>
              <div style="text-align:right"><div class="acc-fans">${fmt(a.followers)}</div><div class="acc-handle">今日 ${((a.history || []).slice(-1)[0] ? (a.history || []).slice(-1)[0].delta : 0) >= 0 ? '+' : ''}${fmt((a.history || []).slice(-1)[0] ? (a.history || []).slice(-1)[0].delta : 0)}</div></div>
              <button class="btn btn-danger" data-action="del-account" data-id="${a.id}">移除</button>
            </div>`).join('') || '<div class="hint">还没有账号，请在右侧导入。</div>'}</div>
        </div>
        <div>
          <div class="card">
            <div class="card-head"><div><div class="card-title">从主页链接导入</div><div class="card-sub">真实抓取粉丝数，非模拟</div></div></div>
            <div class="form-row">
              <div class="field"><label>平台</label><select id="rsPlatform">${PLATFORMS.map(p => `<option value="${p.key}"${state.presetPlatform === p.key ? ' selected' : ''}>${p.name}</option>`).join('')}</select></div>
              <div class="field" style="flex:2;min-width:220px"><label>主页链接 / 账号标识</label><input id="rsInput" placeholder="https://space.bilibili.com/2"></div>
            </div>
            <div class="pill-row" style="margin-bottom:10px">
              <button class="btn btn-primary" data-action="resolve-account">抓取并导入</button>
              <button class="btn btn-ghost" data-action="sync-accounts">同步全部真实账号</button>
            </div>
            <div class="hint" id="rsStatus">需要本机运行发布中心（双击「启动发布中心.bat」）。B站、Discord、YouTube、X、Instagram、TikTok、Reddit 走公开接口；抖音、小红书走本机登录态浏览器。</div>
          </div>
          <div class="card mt14">
            <div class="card-head"><div class="card-title">手动添加</div><div class="card-sub">没有公开主页时用</div></div>
            <div class="form-row">
              <div class="field"><label>平台</label><select id="accPlatform">${PLATFORMS.map(p => `<option value="${p.key}">${p.name}</option>`).join('')}</select></div>
              <div class="field"><label>账号名称</label><input id="accName" placeholder="例如：B站 · 主账号"></div>
            </div>
            <div class="form-row">
              <div class="field"><label>账号标识</label><input id="accHandle" placeholder="@your_account"></div>
              <div class="field" style="max-width:150px"><label>当前粉丝数</label><input id="accFans" type="number" min="0" value="0"></div>
            </div>
            <button class="btn btn-primary" data-action="add-account">添加账号</button>
          </div>
          <div class="card mt14">
            <div class="card-head"><div class="card-title">批量导入</div><div class="card-sub">每行一个账号</div></div>
            <div class="field"><label>格式：平台, 账号名称, 粉丝数</label><textarea id="bulkText" placeholder="B站, 我的小号, 12000&#10;小红书, 品牌号, 8600"></textarea></div>
            <div class="hint" style="margin:10px 0">平台可用：${PLATFORMS.map(p => p.name).join(' / ')}。粉丝数请填真实值，留空会记为 0。</div>
            <button class="btn btn-primary" data-action="bulk-import">批量导入</button>
          </div>
        </div>
      </section>
      <div class="card mt14"><div class="hint">「真实」标记的账号：粉丝数来自平台实时抓取，每次同步会记录当天变化，趋势从导入当天开始累积（历史数据无法回溯）。「示例」标记的账号为演示数据，可随时移除。视频号没有公开主页，只能手动填写。</div></div>`;
  }

  /* ============ 视图：单平台详情（多账号） ============ */
  const ACC_COLORS = ['#0071e3', '#7c5cff', '#1d9d74', '#f08c00', '#e5484d', '#00a1d6', '#e1306c', '#5865f2'];
  function accStat(a, dates) {
    const h = a.history || [];
    const m = Object.fromEntries(h.map(x => [x.date, x.delta || 0]));
    const fans = +a.followers || 0;
    const d30 = sum(dates.slice(-30).map(d => m[d] || 0));
    const base = fans - d30;
    const last = h[h.length - 1];
    return {
      fans, d30, w7: sum(dates.slice(-7).map(d => m[d] || 0)),
      today: last ? (last.delta || 0) : 0,
      grow: base > 0 ? d30 / base * 100 : 0,
      lastSync: a.lastSync || ''
    };
  }
  function viewPlatform() {
    const key = state.platformKey, p = PMAP[key];
    if (!p) { state.activeView = 'dashboard'; return viewDashboard(); }
    const accs = state.accounts.filter(a => a.platform === key)
      .sort((a, b) => (+b.followers || 0) - (+a.followers || 0));
    const agg = platformAgg(key), total = agg.followers;
    const wk = recentPosts(7);
    const pv = sum(wk.map(x => (x.stats[key] || {}).views || 0));
    const e7 = sum(wk.map(x => { const s = x.stats[key] || {}; return (s.likes || 0) + (s.comments || 0) + (s.saves || 0) + (s.shares || 0); }));
    const rate7 = pv ? e7 / pv * 100 : 0;
    const prevWk = published().filter(x => x.date >= dateKey(addDays(today(), -14)) && x.date < dateKey(addDays(today(), -7)));
    const pvPrev = sum(prevWk.map(x => (x.stats[key] || {}).views || 0));
    const hist = historyOf(key);
    const dates = hist.slice(-30).map(h => h.date);
    const dm = Object.fromEntries(hist.map(h => [h.date, h.delta]));
    const d30 = sum(hist.slice(-30).map(h => h.delta));
    const accSeries = accs.map((a, i) => {
      const m = Object.fromEntries((a.history || []).map(h => [h.date, h.delta || 0]));
      return { name: a.name, color: ACC_COLORS[i % ACC_COLORS.length], values: dates.map(d => m[d] || 0) };
    });
    // 由当前粉丝总数按每日净增反推累计曲线
    const cum = []; let cv = total;
    for (let i = dates.length - 1; i >= 0; i--) { cum[i] = cv; cv -= (dm[dates[i]] || 0); }
    const platPosts = published().filter(x => (x.stats[key] || {}).views > 0)
      .sort((a, b) => ((b.stats[key] || {}).views || 0) - ((a.stats[key] || {}).views || 0));
    // 全站 7 天互动率基线，用于对比该平台
    const stViews = sum(KEYS.map(k => sum(wk.map(x => (x.stats[k] || {}).views || 0))));
    const stEng = sum(KEYS.map(k => sum(wk.map(x => { const s = x.stats[k] || {}; return (s.likes || 0) + (s.comments || 0) + (s.saves || 0) + (s.shares || 0); }))));
    const stRate = stViews ? stEng / stViews * 100 : 0;
    // 该平台表现最好的星期
    const DOW = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dow = DOW.map(n => ({ n, cnt: 0, v: 0 }));
    platPosts.forEach(x => { const i = new Date(x.date + 'T00:00:00').getDay(); dow[i].cnt++; dow[i].v += (x.stats[key] || {}).views || 0; });
    const bestDow = dow.filter(o => o.cnt).sort((a, b) => b.v / b.cnt - a.v / a.cnt)[0];
    const KPI = [
      { l: '粉丝总数', v: fmt(total), s: `${accs.length} 个账号`, cls: '' },
      { l: '今日净增', v: (agg.today >= 0 ? '+' : '') + fmt(agg.today), s: agg.today >= 0 ? '较昨日' : '较昨日下滑', cls: agg.today >= 0 ? 'up' : 'down' },
      { l: '近 7 天', v: (agg.week >= 0 ? '+' : '') + fmt(agg.week), s: '粉丝净增', cls: agg.week >= 0 ? 'up' : 'down' },
      { l: '近 30 天', v: (d30 >= 0 ? '+' : '') + fmt(d30), s: '粉丝净增', cls: d30 >= 0 ? 'up' : 'down' },
      { l: '7 天播放', v: fmt(pv), s: pvPrev ? `${pv >= pvPrev ? '↑' : '↓'}${Math.abs(Math.round((pv / pvPrev - 1) * 100))}% 环比上周` : '暂无上周数据', cls: '' },
      { l: '互动率', v: rate7.toFixed(1) + '%', s: `全站 ${stRate.toFixed(1)}%`, cls: '' }
    ];
    const ins = [];
    if (accs.length > 1) {
      const topSh = total ? (+accs[0].followers || 0) / total * 100 : 0;
      ins.push({ tag: '账号结构', cls: topSh >= 70 ? 'o' : 'b', html: `<b>${esc(trunc(accs[0].name, 12))}</b> 占该平台粉丝 <b>${Math.round(topSh)}%</b>${topSh >= 70 ? '，集中度偏高，新号还接不住流量' : '，账号分布相对健康'}。` });
      const fast = accs.map(a => ({ a, s: accStat(a, dates) })).sort((x, y) => y.s.d30 - x.s.d30)[0];
      ins.push({ tag: '增速', cls: 'g', html: `近 30 天涨粉最快的是 <b>${esc(trunc(fast.a.name, 12))}</b> +${fmt(fast.s.d30)}，增速 <b>${fast.s.grow.toFixed(1)}%</b>。` });
    } else {
      ins.push({ tag: '账号结构', cls: 'o', html: `该平台只有 <b>1 个账号</b>，无法做账号间对比。建议再导入一个账号（矩阵号 / 子号），才能看出内容与账号的匹配度。` });
    }
    if (pvPrev) ins.push({ tag: '播放', cls: 'b', html: `7 天播放 <b>${fmt(pv)}</b>，上周同期 ${fmt(pvPrev)}，${pv >= pvPrev ? '环比上升' : '环比下降'} <b>${Math.abs(Math.round((pv / pvPrev - 1) * 100))}%</b>。` });
    else ins.push({ tag: '播放', cls: 'b', html: `7 天播放 <b>${fmt(pv)}</b>，暂无上周同期数据可对比。` });
    if (bestDow) ins.push({ tag: '节奏', cls: 'g', html: `该平台单条均播最高的星期是 <b>${bestDow.n}</b>（${fmt(Math.round(bestDow.v / bestDow.cnt))} 播放/条，共 ${bestDow.cnt} 条），建议把重点内容排到这一天。` });
    ins.push({ tag: '互动', cls: 'b', html: `7 天互动率 <b>${rate7.toFixed(1)}%</b>，${rate7 >= stRate ? '高于' : '低于'}全站平均 ${stRate.toFixed(1)}%${rate7 >= stRate ? '，可把这个平台当主阵地优先首发' : '，建议先优化开头 3 秒与封面文案'}。` });
    return `
      <div class="view-head">
        <div>
          <button class="pf-back" data-action="back-dashboard">‹ 数据大屏</button>
          <h1 class="pf-title">${picon(key, 'width:30px;height:30px;font-size:14px;border-radius:9px')}<span>${p.name}</span></h1>
          <p>${accs.length} 个账号 · 粉丝合计 ${fmt(total)} · 近 30 天数据 · ${platPosts.length} 条已发布内容</p>
        </div>
        <div class="pill-row">
          ${accs.some(a => a.real && a.url) ? '<button class="btn btn-ghost" data-action="sync-platform">同步该平台账号</button>' : ''}
          <button class="btn btn-primary" data-action="import-for-platform">+ 导入账号</button>
        </div>
      </div>
      <section class="kpi-grid">
        ${KPI.map(k => `<div class="kpi"><div class="k-lbl">${k.l}</div><div class="k-val ${k.cls}">${k.v}</div><div class="k-sub">${k.s}</div></div>`).join('')}
      </section>
      <section class="card">
        <div class="card-head"><div><div class="card-title">账号对比</div><div class="card-sub">${accs.length > 1 ? '按粉丝数排序 · 同一平台横向对比' : '该平台目前只有 1 个账号，再导入一个即可对比'}</div></div><div class="card-sub">合计 ${fmt(total)} 粉丝</div></div>
        <div class="acc-cards">
          ${accs.map((a, i) => {
            const s = accStat(a, dates), sh = total ? (+a.followers || 0) / total * 100 : 0;
            return `<div class="acc-card">
              <div class="ac-top"><span class="ac-dot" style="background:${ACC_COLORS[i % ACC_COLORS.length]}"></span>
                <div style="flex:1;min-width:0"><div class="acc-name">${esc(trunc(a.name, 14))}${i === 0 && accs.length > 1 ? '<span class="ac-rank">主力</span>' : ''}</div>
                <div class="acc-handle">${esc(a.handle)} ${a.real ? '<span class="src-badge real">真实</span>' : '<span class="src-badge demo">示例</span>'}</div></div></div>
              <div class="ac-fans">${fmt(s.fans)}</div>
              <div class="ac-share"><div class="ac-track"><i style="width:${Math.max(2, sh).toFixed(1)}%;background:${ACC_COLORS[i % ACC_COLORS.length]}"></i></div><span>${sh.toFixed(1)}%</span></div>
              <div class="ac-stats">
                <div><div class="ac-l">今日</div><div class="ac-v ${s.today >= 0 ? 'up' : 'down'}">${s.today >= 0 ? '+' : ''}${fmt(s.today)}</div></div>
                <div><div class="ac-l">7 天</div><div class="ac-v ${s.w7 >= 0 ? 'up' : 'down'}">${s.w7 >= 0 ? '+' : ''}${fmt(s.w7)}</div></div>
                <div><div class="ac-l">30 天</div><div class="ac-v ${s.d30 >= 0 ? 'up' : 'down'}">${s.d30 >= 0 ? '+' : ''}${fmt(s.d30)}</div></div>
              </div>
              ${accSeries[i].values.length >= 2 ? sparkline(accSeries[i].values, ACC_COLORS[i % ACC_COLORS.length]) : ''}
              <div class="ac-foot"><span>增速 ${s.grow.toFixed(1)}%</span><span>${s.lastSync ? s.lastSync + ' 同步' : '未同步'}</span>${a.real && a.url ? `<button class="ac-sync" data-action="sync-account" data-id="${a.id}">同步</button>` : ''}</div>
            </div>`;
          }).join('') || '<div class="hint">该平台还没有账号。</div>'}
          ${accs.length === 1 ? `<div class="acc-card acc-add" data-action="import-for-platform"><div class="ac-add-t">+ 导入第二个账号</div><div class="ac-add-sub">有对比才看得出账号差异</div></div>` : ''}
        </div>
        <div class="chart-note">粉丝与涨粉是账号维度；播放 / 互动等内容数据是平台维度（同平台多账号合并统计，发布时未绑定具体账号）。</div>
      </section>
      <section class="grid g-pf">
        <div class="card">
          <div class="card-head"><div><div class="card-title">各账号粉丝日增</div><div class="card-sub">近 30 天净增 · 堆叠</div></div>
            <div class="legend">${accSeries.map(s => `<span><i style="background:${s.color}"></i>${esc(trunc(s.name, 7))}</span>`).join('')}</div></div>
          ${dates.length >= 2 ? stackedChart(dates, accSeries) : '<div class="hint">历史数据不足：真实账号从导入当天开始累积，同步 2 天以上即可看到趋势。</div>'}
        </div>
        <div class="card">
          <div class="card-head"><div><div class="card-title">账号粉丝占比</div><div class="card-sub">谁是这个平台的主力</div></div></div>
          ${total > 0 ? `<div class="donut-wrap">${donutChart(accs.map((a, i) => ({ name: a.name, color: ACC_COLORS[i % ACC_COLORS.length], value: +a.followers || 0 })), { label: '粉丝合计' })}<div class="donut-list">${accs.map((a, i) => `<div class="donut-item"><i style="background:${ACC_COLORS[i % ACC_COLORS.length]}"></i><span class="nm">${esc(trunc(a.name, 10))}</span><b>${Math.round((+a.followers || 0) / total * 100)}%</b></div>`).join('')}</div></div>` : '<div class="hint">还没有粉丝数据。</div>'}
        </div>
      </section>
      <section class="grid g-pf-wide">
        <div class="card">
          <div class="card-head"><div><div class="card-title">累计粉丝曲线</div><div class="card-sub">按每日净增反推 · 近 30 天</div></div></div>
          ${dates.length >= 2 ? lineChart(dates, [{ name: p.name, color: p.color, values: cum }], { area: true, zoom: true }) : '<div class="hint">数据不足。</div>'}
        </div>
        <div class="card">
          <div class="card-head"><div><div class="card-title">互动结构（7 天）</div><div class="card-sub">赞 / 评 / 藏 / 转</div></div></div>
          ${(() => {
            const s = { likes: 0, comments: 0, saves: 0, shares: 0 };
            wk.forEach(x => { const t = x.stats[key] || {}; ['likes', 'comments', 'saves', 'shares'].forEach(f => { s[f] += t[f] || 0; }); });
            const items = [{ name: '点赞', color: '#0071e3', value: s.likes }, { name: '评论', color: '#7c5cff', value: s.comments }, { name: '收藏', color: '#1d9d74', value: s.saves }, { name: '转发', color: '#f08c00', value: s.shares }].filter(x => x.value > 0);
            if (!items.length) return '<div class="hint">近 7 天该平台暂无互动数据。</div>';
            const tt = sum(items.map(y => y.value));
            return `<div class="donut-wrap">${donutChart(items, { label: '总互动' })}<div class="donut-list">${items.map(x => `<div class="donut-item"><i style="background:${x.color}"></i><span class="nm">${x.name}</span><b>${Math.round(x.value / (tt || 1) * 100)}%</b></div>`).join('')}</div></div>`;
          })()}
          <div class="chart-note">评论占比高说明话题性强，收藏占比高说明工具性强，可直接指导选题。</div>
        </div>
      </section>
      <section class="grid g-pf-wide">
        <div class="card">
          <div class="card-head"><div><div class="card-title">单条内容表现</div><div class="card-sub">该平台播放 Top ${Math.min(6, platPosts.length) || 0}</div></div></div>
          ${platPosts.length ? `<div class="hbar-list">${platPosts.slice(0, 6).map(x => {
            const v = (x.stats[key] || {}).views || 0, mx = (platPosts[0].stats[key] || {}).views || 1;
            return `<div class="hbar-row"><div class="hb-title">${esc(trunc(x.title, 18))}<span>${x.date}</span></div><div class="hb-track"><i style="width:${Math.max(3, v / mx * 100).toFixed(1)}%;background:${p.color}"></i></div><div class="hb-val">${fmt(v)}</div></div>`;
          }).join('')}</div>` : '<div class="hint">该平台还没有已发布内容。</div>'}
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">平台洞察</div><div class="card-sub">按当前数据自动计算</div></div>
          <div class="insight-list">${ins.map(i => `<div class="insight"><span class="tag ${i.cls}">${i.tag}</span>${i.html}</div>`).join('')}</div>
        </div>
      </section>
      <section class="card">
        <div class="card-head"><div><div class="card-title">该平台内容明细</div><div class="card-sub">共 ${platPosts.length} 条 · 按该平台播放排序</div></div></div>
        ${platPosts.length ? `<div class="tbl-wrap"><table><thead><tr><th>内容</th><th>发布时间</th><th>该平台播放</th><th>赞</th><th>评论</th><th>收藏</th><th>转发</th><th>互动率</th><th>占全站播放</th></tr></thead><tbody>
          ${platPosts.map(x => {
            const s = x.stats[key] || {}, v = s.views || 0;
            const all = postTotal(x) || 1;
            const r = v ? ((s.likes || 0) + (s.comments || 0) + (s.saves || 0) + (s.shares || 0)) / v * 100 : 0;
            return `<tr><td>${esc(trunc(x.title, 18))}</td><td>${x.date} ${x.time || ''}</td><td><b>${fmt(v)}</b></td><td>${fmt(s.likes || 0)}</td><td>${fmt(s.comments || 0)}</td><td>${fmt(s.saves || 0)}</td><td>${fmt(s.shares || 0)}</td><td class="up">${r.toFixed(1)}%</td><td>${(v / all * 100).toFixed(1)}%</td></tr>`;
          }).join('')}
        </tbody></table></div>` : '<div class="hint">暂无数据。</div>'}
      </section>`;
  }

  /* ============ 表格 ============ */
  function postTable(posts) {
    if (!posts.length) return '<div class="hint">暂无数据</div>';
    return `<div class="tbl-wrap"><table><thead><tr><th>内容</th><th>平台</th><th>发布时间</th><th>播放</th><th>赞</th><th>评论</th><th>收藏</th><th>转发</th><th>互动率</th></tr></thead><tbody>
      ${posts.slice().sort((a, b) => b.date.localeCompare(a.date)).map(p => {
        const e = postEngagement(p), n = KEYS.filter(k => (p.stats[k] || {}).views > 0).length;
        return `<tr><td>${esc(trunc(p.title, 18))}</td><td>${n} 个平台</td><td>${p.date} ${p.time}</td><td><b>${fmt(e.views)}</b></td><td>${fmt(e.likes)}</td><td>${fmt(e.comments)}</td><td>${fmt(e.saves)}</td><td>${fmt(e.shares)}</td><td class="up">${e.rate.toFixed(1)}%</td></tr>`;
      }).join('')}
    </tbody></table></div>`;
  }
  function platformTable(posts) {
    return `<div class="tbl-wrap"><table><thead><tr><th>平台</th><th>状态</th><th>播放</th><th>赞</th><th>评论</th><th>收藏</th><th>转发</th><th>互动率</th></tr></thead><tbody>
      ${KEYS.filter(k => state.accounts.some(a => a.platform === k)).map(k => {
        const views = sum(posts.map(p => (p.stats[k] || {}).views || 0));
        const likes = sum(posts.map(p => (p.stats[k] || {}).likes || 0));
        const cmts = sum(posts.map(p => (p.stats[k] || {}).comments || 0));
        const saves = sum(posts.map(p => (p.stats[k] || {}).saves || 0));
        const shares = sum(posts.map(p => (p.stats[k] || {}).shares || 0));
        return `<tr><td>${picon(k)} ${PMAP[k].name}</td><td><span class="status-badge"><i class="dot green"></i>已接入</span></td><td><b>${fmt(views)}</b></td><td>${fmt(likes)}</td><td>${fmt(cmts)}</td><td>${fmt(saves)}</td><td>${fmt(shares)}</td><td class="up">${(views ? (likes + cmts + saves + shares) / views * 100 : 0).toFixed(1)}%</td></tr>`;
      }).join('')}
    </tbody></table></div>`;
  }

  /* ============ 渲染 & 弹窗 ============ */
  const VIEWS = { dashboard: viewDashboard, platform: viewPlatform, traffic: viewTraffic, calendar: viewCalendar, insights: viewInsights, accounts: viewAccounts };
  function render() {
    if (state.activeView === 'publish' && window.PublishCenter) {
      $$('#navTabs button').forEach(b => b.classList.toggle('active', b.dataset.view === 'publish'));
      const d = new Date(), wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
      $('#clock').textContent = `${d.getMonth() + 1}/${d.getDate()} ${wd} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      window.PublishCenter.render();
      return;
    }
    if (window.PublishCenter) window.PublishCenter.stopPolling();
    $('#mainContent').innerHTML = VIEWS[state.activeView]();
    // 平台详情是「数据大屏」的下级页面，导航上仍高亮大屏
    const navKey = state.activeView === 'platform' ? 'dashboard' : state.activeView;
    $$('#navTabs button').forEach(b => b.classList.toggle('active', b.dataset.view === navKey));
    const d = new Date(), wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    $('#clock').textContent = `${d.getMonth() + 1}/${d.getDate()} ${wd} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function toast(msg) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; document.body.appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }
  function showModal(html) { $('#modalRoot').innerHTML = `<div class="mask" data-action="close-mask"><div class="modal" data-stop>${html}</div></div>`; }
  function closeModal() { $('#modalRoot').innerHTML = ''; }
  function postModal(date) {
    showModal(`<h3>新增内容</h3><div class="mp">发布后可在日历与大屏中查看统计</div>
      <div class="field" style="margin-bottom:12px"><label>内容标题</label><input id="npTitle" placeholder="例如：10 个 Bot 组成的编辑部"></div>
      <div class="form-row"><div class="field"><label>发布日期</label><input id="npDate" type="date" value="${date || dateKey(today())}"></div>
      <div class="field" style="max-width:120px"><label>时间</label><input id="npTime" type="time" value="18:00"></div>
      <div class="field"><label>状态</label><select id="npStatus"><option>计划中</option><option>等待点布</option><option>已发布</option></select></div></div>
      <div class="field"><label>总播放（已发布时填写，将按平台权重分配）</label><input id="npViews" type="number" min="0" value="0"></div>
      <div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">取消</button><button class="btn btn-primary" data-action="save-post">保存内容</button></div>`);
  }
  function dayModal(date) {
    const ps = state.posts.filter(p => p.date === date);
    showModal(`<h3>${date}</h3><div class="mp">${ps.length ? ps.length + ' 条内容' : '当天暂无内容'}</div>
      ${ps.map(p => `<div class="acc-row"><div style="flex:1"><div class="acc-name">${esc(p.title)}</div><div class="acc-handle">${p.time} · ${p.status} · ${fmt(postTotal(p))} 播放</div></div><button class="btn btn-danger" data-action="del-post" data-id="${p.id}">删除</button></div>`).join('')}
      <div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">关闭</button><button class="btn btn-primary" data-action="open-post" data-date="${date}">+ 新增内容</button></div>`);
  }

  /* ============ 事件 ============ */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t) { if (e.target.classList.contains('mask')) closeModal(); return; }
    const a = t.dataset.action;
    if (a === 'close-mask' && e.target.closest('[data-stop]')) return;
    if (a === 'close-modal' || a === 'close-mask') { closeModal(); return; }
    if (a === 'range') { state.range = +t.dataset.range; saveState(); render(); return; }
    if (a === 'open-platform') { state.platformKey = t.dataset.key; state.activeView = 'platform'; saveState(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (a === 'back-dashboard') { state.activeView = 'dashboard'; saveState(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (a === 'import-for-platform') { state.presetPlatform = state.platformKey; state.activeView = 'accounts'; saveState(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (a === 'sync-platform') {
      const list = state.accounts.filter(x => x.platform === state.platformKey && x.real && x.url);
      if (!list.length) { toast('该平台还没有可同步的真实账号'); return; }
      (async () => {
        let ok = 0, fail = 0;
        toast(`开始同步 ${list.length} 个账号…`);
        for (let i = 0; i < list.length; i++) {
          try {
            const d = await localApi('/api/account/resolve', { platform: list[i].platform, input: list[i].url });
            if (!d.ok) throw new Error(d.error || '失败');
            applyReal(d, list[i].url); ok++;
          } catch (e) { fail++; }
        }
        saveState(); render();
        toast(`同步完成：成功 ${ok} 个${fail ? `，失败 ${fail} 个` : ''}`);
      })();
      return;
    }
    if (a === 'sync-account') {
      const acc = state.accounts.find(x => x.id === t.dataset.id);
      if (!acc || !acc.url) { toast('该账号没有主页链接，无法同步'); return; }
      t.disabled = true; t.textContent = '同步中…';
      localApi('/api/account/resolve', { platform: acc.platform, input: acc.url }).then(d => {
        if (!d.ok) throw new Error(d.error || '抓取失败');
        applyReal(d, acc.url); saveState(); render(); toast(`${acc.name} 已同步`);
      }).catch(e => { t.disabled = false; t.textContent = '同步'; toast('同步失败：' + e.message); });
      return;
    }
    if (a === 'filter-platform') { state.filterKey = state.filterKey === t.dataset.key ? null : t.dataset.key; render(); return; }
    if (a === 'month-prev') { state.month = { y: state.month.m === 0 ? state.month.y - 1 : state.month.y, m: (state.month.m + 11) % 12 }; render(); return; }
    if (a === 'month-next') { state.month = { y: state.month.m === 11 ? state.month.y + 1 : state.month.y, m: (state.month.m + 1) % 12 }; render(); return; }
    if (a === 'open-post') { postModal(t.dataset.date); return; }
    if (a === 'day') { dayModal(t.dataset.date); return; }
    if (a === 'save-post') {
      const title = $('#npTitle').value.trim();
      if (!title) { toast('请输入内容标题'); return; }
      const date = $('#npDate').value || dateKey(today());
      const status = $('#npStatus').value;
      const total = Math.max(0, +$('#npViews').value || 0);
      state.posts.push({ id: 'post_' + Math.random().toString(36).slice(2, 9), title, cover: title, date, time: $('#npTime').value || '18:00', status, stats: status === '已发布' ? makeStats(total) : makeStats(0) });
      saveState(); closeModal(); render(); toast('内容已保存'); return;
    }
    if (a === 'del-post') { state.posts = state.posts.filter(p => p.id !== t.dataset.id); saveState(); closeModal(); render(); toast('已删除'); return; }
    if (a === 'resolve-account') {
      const platform = $('#rsPlatform').value, input = $('#rsInput').value.trim();
      if (!input) { rsStatus('请先粘贴该账号的主页链接', 'err'); return; }
      rsStatus('正在抓取…（首次会启动专用 Chrome，可能需要十几秒）');
      localApi('/api/account/resolve', { platform, input }).then(d => {
        if (!d.ok) throw new Error(d.error || '抓取失败');
        const acc = applyReal(d, input);
        saveState(); render();
        rsStatus(d.followers == null
          ? `已导入 ${acc.name}，但该平台不公开粉丝数，请到列表里手动补填（${d.note || 'Reddit 个人主页不公开粉丝数'}）`
          : `✓ 已导入 ${acc.name}：${fmt(acc.followers)} ${d.platform === 'discord' ? '成员' : '粉丝'}（${d.source || '实时抓取'}）${d.note ? ' · ' + d.note : ''}`,
          d.followers == null ? 'err' : 'ok');
        toast('账号已导入');
      }).catch(e => rsStatus('✗ ' + e.message, 'err'));
      return;
    }
    if (a === 'sync-accounts') {
      const list = state.accounts.filter(x => x.real && x.url);
      if (!list.length) { rsStatus('还没有可同步的真实账号，先在上方导入一个', 'err'); return; }
      (async () => {
        let ok = 0, fail = 0;
        for (let i = 0; i < list.length; i++) {
          rsStatus(`正在同步 ${i + 1}/${list.length}：${list[i].name}…`);
          try {
            const d = await localApi('/api/account/resolve', { platform: list[i].platform, input: list[i].url });
            if (!d.ok) throw new Error(d.error || '失败');
            applyReal(d, list[i].url); ok++;
          } catch (e) { fail++; }
        }
        saveState(); render();
        rsStatus(`同步完成：成功 ${ok} 个${fail ? '，失败 ' + fail + ' 个' : ''}`, fail ? 'err' : 'ok');
      })();
      return;
    }
    if (a === 'add-account') {
      const platform = $('#accPlatform').value, name = $('#accName').value.trim() || PMAP[platform].name + ' · 账号';
      const handle = $('#accHandle').value.trim() || '@' + platform;
      const followers = Math.max(0, +$('#accFans').value || 0);
      state.accounts.push({ id: 'acc_' + Math.random().toString(36).slice(2, 9), platform, name, handle, followers, real: false, history: genHistory(followers) });
      saveState(); render(); toast('账号已添加'); return;
    }
    if (a === 'del-account') { state.accounts = state.accounts.filter(x => x.id !== t.dataset.id); saveState(); render(); toast('账号已移除'); return; }
    if (a === 'bulk-import') {
      const lines = $('#bulkText').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      let n = 0;
      lines.forEach(line => {
        const parts = line.split(/[,，\t]/).map(x => x.trim());
        const p = PLATFORMS.find(x => x.name === parts[0] || x.key === parts[0] || x.name.toLowerCase() === (parts[0] || '').toLowerCase() || parts[0].toLowerCase().includes(x.key));
        if (!p) return;
        const name = parts[1] || p.name + ' · 账号';
        const followers = Math.max(0, parseInt((parts[2] || '0').replace(/[^\d]/g, ''), 10) || 0);
        state.accounts.push({ id: 'acc_' + Math.random().toString(36).slice(2, 9), platform: p.key, name, handle: '@' + p.key + n, followers, real: false, history: genHistory(followers) });
        n++;
      });
      saveState(); render(); toast(`成功导入 ${n} 个账号`); return;
    }
    if (a === 'export') {
      const blob = new Blob([JSON.stringify({ accounts: state.accounts, posts: state.posts }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = '脉络社媒数据.json'; link.click(); URL.revokeObjectURL(url); toast('已导出'); return;
    }
    if (a === 'import') { $('#fileInput').click(); return; }
    if (a === 'reset') {
      if (confirm('确定重置为示例数据？当前数据将被覆盖。')) { state = seedState(); saveState(); render(); toast('已重置'); }
      return;
    }
  });
  $$('#navTabs button').forEach(b => b.addEventListener('click', () => {
    state.activeView = b.dataset.view; saveState(); render(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  $('#refreshBtn').addEventListener('click', () => { render(); toast('数据已刷新'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  const fi = document.createElement('input'); fi.type = 'file'; fi.id = 'fileInput'; fi.accept = '.json'; fi.style.display = 'none';
  document.body.appendChild(fi);
  fi.addEventListener('change', () => {
    const f = fi.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d.accounts || !d.posts) throw new Error('格式不符');
        state.accounts = d.accounts; state.posts = d.posts; saveState(); render(); toast('导入成功');
      } catch (err) { toast('导入失败：文件格式不正确'); }
      fi.value = '';
    };
    r.readAsText(f);
  });

  /* ============ 启动 ============ */
  // 若处于发布中心视图，先等服务连接检测完成再渲染，避免误显示"离线"
  let painted = false;
  const paint = () => { painted = true; render(); };
  if (window.PublishCenter) {
    window.PublishCenter.init().catch(() => {}).finally(paint);
    // 兜底：3 秒后仍未渲染过才补一次，避免把用户刚操作的提示刷掉
    setTimeout(() => { if (!painted) paint(); }, 3000);
  } else {
    paint();
  }
})();
