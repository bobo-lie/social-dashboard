/* 脉络 · 社媒数据台 — 本地单页应用 */
(function () {
  'use strict';

  /* ============ 平台定义 ============ */
  const PLATFORMS = [
    { key: 'bilibili', name: 'B站',      glyph: 'B',  color: '#00A1D6', bg: '#E8F7FD' },
    { key: 'douyin',   name: '抖音',     glyph: '抖', color: '#18181B', bg: '#F0F0F2' },
    { key: 'xhs',      name: '小红书',   glyph: '红', color: '#FF2442', bg: '#FFECEF' },
    { key: 'sph',      name: '视频号',   glyph: '视', color: '#FA9D3B', bg: '#FFF2E4' },
    { key: 'youtube',  name: 'YouTube',  glyph: '▶', color: '#FF0033', bg: '#FFE9EC' },
    { key: 'x',        name: 'X',        glyph: 'X',  color: '#18181B', bg: '#F0F0F2' },
    { key: 'course',   name: '课程站',   glyph: '课', color: '#6C5CE7', bg: '#EFECFF' }
  ];
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

  /* ============ 演示数据 ============ */
  function genHistory(followers, days = 30) {
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
    const w = weights || [0.09, 0.32, 0.17, 0.07, 0.03, 0.31, 0.01];
    const views = w.map(x => Math.round(total * x));
    views[0] += total - sum(views);
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
  function seedState() {
    const followers = { bilibili: 16139, douyin: 12863, xhs: 19475, sph: 4601, youtube: 325, x: 6042, course: 3433 };
    const accounts = PLATFORMS.map((p, i) => ({
      id: 'acc_' + p.key, platform: p.key,
      name: p.name + ' · 主账号', handle: '@mailuo_' + p.key,
      followers: followers[p.key], history: genHistory(followers[p.key])
    }));
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
    return { accounts, posts, activeView: 'dashboard', range: 7, month: { y: today().getFullYear(), m: today().getMonth() } };
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.accounts && s.posts) return Object.assign(seedState(), s);
      }
    } catch (e) { /* ignore */ }
    return seedState();
  }
  let state = loadState();
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
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
    const yMax = Math.max(Math.ceil(Math.max(...all, 1) * 1.12), 10);
    const xAt = i => PL + pw * (dates.length < 2 ? 0 : i / (dates.length - 1));
    const yAt = v => PT + ph * (1 - v / yMax);
    let g = '';
    [0, .25, .5, .75, 1].forEach(f => {
      const y = PT + ph * (1 - f);
      g += `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="#eef0f6"/>`;
      g += `<text x="${PL - 7}" y="${y + 4}" text-anchor="end" font-size="10" fill="#b2b2c3">${f === 1 ? fmt(yMax) : fmt(yMax * f)}</text>`;
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
  function barChart(labels, values, color = '#3b82f6') {
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
  function donutChart(items) {
    const size = 170, c = size / 2, r = 66, sw = 20, total = sum(items.map(i => i.value)) || 1;
    const C = 2 * Math.PI * r; let off = 0, g = '';
    items.forEach(it => {
      const len = it.value / total * C;
      g += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${sw}" stroke-dasharray="${Math.max(0, len - 2).toFixed(2)} ${(C - len + 2).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${c} ${c})"><title>${it.name} ${fmt(it.value)}</title></circle>`;
      off += len;
    });
    g += `<text x="${c}" y="${c - 1}" text-anchor="middle" font-size="19" font-weight="800" fill="#1b1b2b">${fmt(total)}</text><text x="${c}" y="${c + 16}" text-anchor="middle" font-size="10" fill="#a0a0b4">总播放</text>`;
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
      { tag: '涨粉', cls: 'g', html: `近 7 天涨粉最多的是 <b>${PMAP[top.key].name} +${fmt(top.v)}</b>，占六平台合计 +${fmt(total)} 的 <b>${Math.round(top.v / total * 100)}%</b>。` },
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
    const aligned = KEYS.filter(k => state.accounts.some(a => a.platform === k)).map(k => {
      const m = Object.fromEntries(historyOf(k).map(h => [h.date, h.delta]));
      return { name: PMAP[k].name, color: PMAP[k].color, values: dates.map(d => m[d] || 0) };
    });
    return `
      <div class="view-head">
        <div><h1>数据大屏</h1><p>全平台内容监控 · 覆盖 ${state.accounts.length} 个账号 · 最近 ${state.range} 天</p></div>
        <div class="pill-row">
          ${[7, 14, 30].map(r => `<button class="pill ${state.range === r ? 'on' : ''}" data-action="range" data-range="${r}">近 ${r} 天</button>`).join('')}
          <button class="pill" data-action="open-post">+ 新增内容</button>
        </div>
      </div>
      <section class="grid g-dash">
        <div class="card">
          <div class="card-head"><div class="card-title">最新发布</div><div class="card-sub">全平台同步状态</div></div>
          ${feat ? `<div class="featured">
            <div class="cover"><span class="cv-badge">第 ${published().length} 期</span><div class="cv-title">${esc(feat.cover)}</div><div class="cv-bar"></div><div class="cv-foot">口播稿从 2 小时到 20 分钟</div><div class="cv-live"><i class="dot green"></i>${KEYS.filter(k => (feat.stats[k] || {}).views > 0).length}/7 平台已发布</div></div>
            <div>
              <div class="date-pills"><span class="date-pill on">昨天 18:00</span><span class="date-pill">明天 18:00</span><span class="date-pill">${dateKey(today()).slice(5)} 18:00</span></div>
              <div class="feat-title">${esc(feat.title)}</div>
              <div class="feat-meta">${feat.date} ${feat.time} 发布 · 数据持续更新</div>
              <div class="plat-nums">${KEYS.filter(k => state.accounts.some(a => a.platform === k)).map(k => `<div class="plat-num">${picon(k)}<span>${fmt((feat.stats[k] || {}).views || 0)}</span></div>`).join('')}</div>
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
        <div class="stat"><div class="ico" style="background:#eef3ff;color:#2f6bff">✎</div><div><div class="lbl">发布数量（7天）</div><div class="val">${week.length} <span style="font-size:12px;color:#9a9ab0">条</span></div><div class="sub">上周 ${prevWeek.length} 条</div></div></div>
        <div class="stat"><div class="ico" style="background:#eaf8f1;color:#12a06a">▶</div><div><div class="lbl">全平台播放（7天）</div><div class="val">${fmt(wViews)}</div><div class="sub ${pViews ? (wViews >= pViews ? 'up' : 'down') : ''}">${pViews ? (wViews >= pViews ? '↑' : '↓') + Math.abs(Math.round((wViews / pViews - 1) * 100)) + '% vs 上周' : '暂无上周数据'}</div></div></div>
        <div class="stat"><div class="ico" style="background:#fff1e6;color:#f59e0b">✦</div><div><div class="lbl">互动总量（7天）</div><div class="val">${fmt(wEng)}</div><div class="sub">互动率 ${wViews ? (wEng / wViews * 100).toFixed(1) : '0.0'}%</div></div></div>
        <div class="stat"><div class="mini-cover">${esc(trunc(hot ? hot.cover : '暂无', 8))}</div><div style="min-width:0"><div class="lbl">最热素材（7天）</div><div class="val" style="font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(hot ? hot.title : '—')}</div><div class="sub">${fmt(hot ? postTotal(hot) : 0)} 播放</div></div></div>
      </section>
      <section class="plat-grid">
        ${PLATFORMS.filter(p => state.accounts.some(a => a.platform === p.key)).map(p => {
          const a = platformAgg(p.key);
          return `<div class="pcard" data-action="filter-platform" data-key="${p.key}" style="cursor:pointer">
            <div class="pc-head">${picon(p.key)}<span class="pname">${p.name}</span><span class="card-sub" style="margin-left:auto">${a.count ? '粉丝' : ''}</span></div>
            <div class="pc-follow">${fmt(a.followers)}</div>
            <div class="pc-chips"><span class="pc-chip">今日 <b class="up">+${fmt(a.today)}</b></span><span class="pc-chip">7天 <b class="up">+${fmt(a.week)}</b></span></div>
            ${sparkline(a.series.slice(-30), p.color)}
            <div class="pc-foot"><div>近7日播放<b>${fmt(sum(recentPosts(7).map(x => (x.stats[p.key] || {}).views || 0)))}</b></div><div>互动率<b>${a.rate.toFixed(1)}%</b></div></div>
          </div>`;
        }).join('')}
      </section>
      <section class="card mt14">
        <div class="card-head"><div class="card-title">近期内容明细</div><div class="card-sub">按发布时间倒序 · 点击平台卡片可筛选</div></div>
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
    const wk = recentPosts(7);
    const donutItems = KEYS.filter(k => state.accounts.some(a => a.platform === k)).map(k => ({ name: PMAP[k].name, color: PMAP[k].color, value: sum(wk.map(p => (p.stats[k] || {}).views || 0)) })).filter(x => x.value > 0);
    return `
      <div class="view-head"><div><h1>流量</h1><p>发布节奏、播放走势与平台流量结构</p></div>
        <div class="pill-row">${[7, 14, 30].map(r => `<button class="pill ${state.range === r ? 'on' : ''}" data-action="range" data-range="${r}">近 ${r} 天</button>`).join('')}</div>
      </div>
      <section class="grid g-traffic">
        <div class="card">
          <div class="card-head"><div><div class="card-title">播放走势（按平台）</div><div class="card-sub">按发布后 8 天衰减模型估算每日播放</div></div><div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div></div>
          ${lineChart(dates, series, { area: true })}
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">平台流量结构（7天）</div><div class="card-sub">${fmt(sum(donutItems.map(x => x.value)))} 次播放</div></div>
          <div class="donut-wrap">${donutChart(donutItems)}<div class="donut-list">${donutItems.sort((a, b) => b.value - a.value).map(x => `<div class="donut-item"><i style="background:${x.color}"></i><span class="nm">${x.name}</span><b>${Math.round(x.value / (sum(donutItems.map(y => y.value)) || 1) * 100)}%</b></div>`).join('')}</div></div>
          <div class="chart-note" style="margin-top:14px">占比最高的平台决定整体播放基本盘，互动率另见「分析」页。</div>
        </div>
      </section>
      <section class="card mt14">
        <div class="card-head"><div class="card-title">发布节奏（近 14 天）</div><div class="card-sub">共 ${sum(counts)} 条已发布内容</div></div>
        ${barChart(labels, counts, '#6c8cff')}
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
      <div class="pill-row" style="margin-top:14px">
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
          ${lineChart(dv.map(x => x.date), [{ name: '全平台播放', color: '#3b6bff', values: dv.map(x => x.value) }], { area: true })}
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
    return `
      <div class="view-head"><div><h1>账号管理</h1><p>导入各平台账号后可自动汇总统计 · 数据仅存于本机浏览器</p></div>
        <div class="pill-row"><button class="btn btn-ghost" data-action="export">导出数据</button><button class="btn btn-ghost" data-action="import">导入数据</button><button class="btn btn-danger" data-action="reset">重置示例</button></div>
      </div>
      <section class="grid g-traffic">
        <div class="card">
          <div class="card-head"><div class="card-title">已接入账号（${state.accounts.length}）</div><div class="card-sub">粉丝总数 ${fmt(totalFans())}</div></div>
          <div class="acc-list">${state.accounts.map(a => `
            <div class="acc-row">${picon(a.platform)}<div style="flex:1;min-width:0"><div class="acc-name">${esc(a.name)}</div><div class="acc-handle">${esc(a.handle)} · ${PMAP[a.platform].name}</div></div>
              <div style="text-align:right"><div class="acc-fans">${fmt(a.followers)}</div><div class="acc-handle">今日 +${fmt((a.history || []).slice(-1)[0] ? (a.history || []).slice(-1)[0].delta : 0)}</div></div>
              <button class="btn btn-danger" data-action="del-account" data-id="${a.id}">移除</button>
            </div>`).join('') || '<div class="hint">还没有账号，请在右侧导入。</div>'}</div>
        </div>
        <div>
          <div class="card">
            <div class="card-head"><div class="card-title">添加单个账号</div></div>
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
            <div class="hint" style="margin:10px 0">平台可用：${PLATFORMS.map(p => p.name).join(' / ')}。粉丝数可省略，默认 0。导入后系统按粉丝量生成近 30 天增长基线。</div>
            <button class="btn btn-primary" data-action="bulk-import">批量导入</button>
          </div>
        </div>
      </section>
      <div class="card mt14"><div class="hint">说明：当前为本地演示工具，平台数据为模拟数据。若要接入真实账号，需要各平台开放接口与授权凭证；导出/导入功能可用于在多台设备间迁移这份数据。</div></div>`;
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
  const VIEWS = { dashboard: viewDashboard, traffic: viewTraffic, calendar: viewCalendar, insights: viewInsights, accounts: viewAccounts };
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
    $$('#navTabs button').forEach(b => b.classList.toggle('active', b.dataset.view === state.activeView));
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
    if (a === 'add-account') {
      const platform = $('#accPlatform').value, name = $('#accName').value.trim() || PMAP[platform].name + ' · 账号';
      const handle = $('#accHandle').value.trim() || '@' + platform;
      const followers = Math.max(0, +$('#accFans').value || 0);
      state.accounts.push({ id: 'acc_' + Math.random().toString(36).slice(2, 9), platform, name, handle, followers, history: genHistory(followers) });
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
        state.accounts.push({ id: 'acc_' + Math.random().toString(36).slice(2, 9), platform: p.key, name, handle: '@' + p.key + n, followers, history: genHistory(followers) });
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
  if (window.PublishCenter) {
    window.PublishCenter.init().catch(() => {}).finally(() => render());
    // 兜底：3 秒后无论如何重绘一次，防止 fetch 卡住
    setTimeout(() => render(), 3000);
  } else {
    render();
  }
})();
