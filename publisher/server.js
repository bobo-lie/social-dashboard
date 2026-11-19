/* 本地服务：静态托管 + 发布 API */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const engine = require('./engine');
const notifier = require('./notifier');
const { PLATFORMS } = require('./platforms');

const ROOT = store.ROOT;
const PORT = process.env.PORT || 8899;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.ico': 'image/x-icon' };

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS' });
  res.end(JSON.stringify(data));
}
function body(req, limit = 60 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('请求体过大')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* 简易 multipart 解析（无第三方依赖） */
function parseMultipart(buf, boundary) {
  const files = [];
  const sep = Buffer.from('--' + boundary);
  let pos = 0;
  while (true) {
    const start = buf.indexOf(sep, pos);
    if (start < 0) break;
    const headStart = start + sep.length + 2;
    const headEnd = buf.indexOf(Buffer.from('\r\n\r\n'), headStart);
    if (headEnd < 0) break;
    const head = buf.slice(headStart, headEnd).toString('utf8');
    const end = buf.indexOf(Buffer.from('\r\n--' + boundary), headEnd + 4);
    if (end < 0) break;
    const nameM = head.match(/name="([^"]+)"/), fileM = head.match(/filename="([^"]+)"/);
    if (fileM) {
      const data = buf.slice(headEnd + 4, end);
      files.push({ field: nameM ? nameM[1] : 'file', filename: fileM[1], data });
    }
    pos = end + 2;
  }
  return files;
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '/index.html') rel = '/index.html';
  // 媒体文件从 publisher-data/media 提供
  let file;
  if (rel.startsWith('/media/')) file = path.join(store.DATA_DIR, 'media', path.basename(rel));
  else {
    file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

async function handleApi(req, res, url) {
  const p = url.pathname;
  if (req.method === 'OPTIONS') return json(res, 200, {});

  if (p === '/api/config' && req.method === 'GET') return json(res, 200, { ok: true, config: store.readConfig(), platforms: PLATFORMS });
  if (p === '/api/config' && req.method === 'POST') {
    const cfg = JSON.parse((await body(req)).toString('utf8'));
    const merged = Object.assign(store.readConfig(), cfg);
    store.writeConfig(merged); store.log('配置已保存');
    return json(res, 200, { ok: true, config: merged });
  }

  if (p === '/api/tasks' && req.method === 'GET') {
    const tasks = store.readTasks().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return json(res, 200, { ok: true, tasks });
  }
  if (p === '/api/tasks' && req.method === 'POST') {
    const d = JSON.parse((await body(req)).toString('utf8'));
    const task = {
      id: 'T' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: d.title || (d.text || '').slice(0, 30),
      text: d.text || '',
      media: d.media || [],
      platforms: d.platforms || [],
      scheduledAt: d.scheduledAt || null,
      status: 'pending',
      results: [],
      createdAt: Date.now()
    };
    const tasks = store.readTasks(); tasks.push(task); store.writeTasks(tasks);
    store.log(`新建任务 ${task.id} → ${task.platforms.join(',')}`);
    return json(res, 200, { ok: true, task });
  }

  const mTask = p.match(/^\/api\/tasks\/([^/]+)$/);
  if (mTask && req.method === 'DELETE') {
    const tasks = store.readTasks().filter(t => t.id !== mTask[1]);
    store.writeTasks(tasks); return json(res, 200, { ok: true });
  }

  const mRun = p.match(/^\/api\/tasks\/([^/]+)\/publish$/);
  if (mRun && req.method === 'POST') {
    const tasks = store.readTasks();
    const task = tasks.find(t => t.id === mRun[1]);
    if (!task) return json(res, 404, { ok: false, error: '任务不存在' });
    const cfg = store.readConfig();
    task.status = 'running'; task.startedAt = Date.now(); task.results = [];
    store.writeTasks(tasks);
    store.log(`任务 ${task.id} 开始执行`);
    // 后台执行
    (async () => {
      try {
        const results = await engine.runTask(task, cfg, partial => {
          const ts = store.readTasks(); const t = ts.find(x => x.id === task.id);
          if (t) { t.results = partial; store.writeTasks(ts); }
        });
        const ts = store.readTasks(); const t = ts.find(x => x.id === task.id);
        const failed = results.some(r => r.status === 'failed');
        if (t) { t.results = results; t.status = failed ? 'partial' : 'done'; t.finishedAt = Date.now(); store.writeTasks(ts); }
        const notify = await notifier.send(notifier.buildSummary(results, task));
        const ts2 = store.readTasks(); const t2 = ts2.find(x => x.id === task.id);
        if (t2) { t2.notified = notify.ok; t2.notifyError = notify.error || ''; store.writeTasks(ts2); }
        store.log(`任务 ${task.id} 结束 status=${failed ? 'partial' : 'done'} 通知=${notify.ok ? 'ok' : notify.error}`);
      } catch (e) {
        const ts = store.readTasks(); const t = ts.find(x => x.id === task.id);
        if (t) { t.status = 'failed'; t.error = e.message; store.writeTasks(ts); }
        store.log('任务异常：' + e.message);
      }
    })();
    return json(res, 200, { ok: true, taskId: task.id });
  }

  if (p === '/api/media' && req.method === 'POST') {
    const buf = await body(req);
    const ct = req.headers['content-type'] || '';
    const bm = ct.match(/boundary=(.+)$/);
    if (!bm) return json(res, 400, { ok: false, error: '缺少 boundary' });
    const files = parseMultipart(buf, bm[1].trim().replace(/^"|"$/g, ''));
    if (!files.length) return json(res, 400, { ok: false, error: '没有收到文件' });
    const saved = [];
    for (const f of files) {
      const safe = Date.now() + '-' + f.filename.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_');
      fs.writeFileSync(path.join(store.MEDIA_DIR, safe), f.data);
      saved.push({ originalName: f.filename, storedName: safe, size: f.data.length, type: path.extname(f.filename).toLowerCase() });
      store.log('收到素材：' + f.filename + ' ' + f.data.length + ' bytes');
    }
    return json(res, 200, { ok: true, files: saved });
  }

  if (p === '/api/test/wecom' && req.method === 'POST') {
    const d = JSON.parse((await body(req)).toString('utf8') || '{}');
    const r = await notifier.send('### ✅ 企业微信通知测试\n> 发布中心已连通，发布完成后会推送结果到这里。', d);
    return json(res, 200, r);
  }

  if (p === '/api/browser/close' && req.method === 'POST') { await engine.closeContext(); return json(res, 200, { ok: true }); }

  if (p === '/api/logs' && req.method === 'GET') {
    const day = new Date().toISOString().slice(0, 10);
    const f = path.join(store.LOG_DIR, `publish-${day}.log`);
    const text = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).slice(-120) : [];
    return json(res, 200, { ok: true, lines: text });
  }

  return json(res, 404, { ok: false, error: '未知接口 ' + p });
}

const server = http.createServer(async (req, res) => {
  store.ensure();
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(req, res, url.pathname);
  } catch (e) {
    store.log('HTTP 错误：' + e.message);
    json(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  store.ensure(); store.log(`发布服务已启动 http://127.0.0.1:${PORT}`);
  console.log(`\n  发布中心已启动：http://127.0.0.1:${PORT}\n`);
});