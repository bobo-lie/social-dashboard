/* 发布中心前端 —— 挂到主工具的视图系统 */
(function () {
  'use strict';
  const API = 'http://127.0.0.1:8899';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let cfg = null, platforms = [], tasks = [], drafts = [], online = false;
  let pollTimer = null;

  async function api(path, opts = {}) {
    try {
      const res = await fetch(API + path, opts);
      return await res.json();
    } catch (e) { return { ok: false, error: '无法连接发布服务' }; }
  }
  async function init() {
    const r = await api('/api/config');
    if (r.ok) { cfg = r.config; platforms = r.platforms; online = true; await refreshTasks(); }
    else { online = false; }
  }
  async function refreshTasks() {
    const r = await api('/api/tasks'); if (r.ok) tasks = r.tasks;
  }
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
      if (!online || !$('#publishTasks')) return;
      const r = await api('/api/tasks'); if (!r.ok) return;
      const running = tasks.some(t => t.status === 'running');
      tasks = r.tasks;
      if (running || $$('#publishTasks [data-status="running"]').length) renderTaskList();
    }, 1500);
  }
  function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }

  /* ---------- 主视图 ---------- */
  function viewPublish() {
    if (!online) return offlineView();
    const groups = ['海外', '国内'];
    return `
      <div class="view-head">
        <div><h1>发布中心</h1><p>上传内容、勾选平台、一键自动发布 · 完成后微信推送结果</p></div>
        <div class="pill-row">
          <span class="chip"><i class="dot ${cfg.dryRun ? 'orange' : 'green'}"></i>${cfg.dryRun ? '演练模式 · 不真实发布' : '真实发布模式'}</span>
          <button class="pill" data-pub="toggle-dry">${cfg.dryRun ? '切换到真实发布' : '切换到演练模式'}</button>
        </div>
      </div>

      ${!cfg.wecomWebhook ? `<div class="pub-alert"><b>⚠ 还没有连微信</b><span>发布结果无法推送。到下方「发布设置」填入企业微信群机器人 Webhook，5 分钟搞定。</span></div>` : ''}

      <section class="grid g-publish">
        <!-- 左：内容编辑 -->
        <div class="card">
          <div class="card-head"><div class="card-title">① 本次发布内容</div><div class="card-sub">文本 / 图片 / 视频</div></div>
          <div class="field" style="margin-bottom:10px"><label>标题（YouTube / Reddit / Pinterest 用）</label><input id="pubTitle" placeholder="例如：10 个 Bot 组成的编辑部"></div>
          <div class="field"><label>正文 / 文案</label><textarea id="pubText" style="min-height:130px" placeholder="粘贴这次要发的文案……"></textarea></div>
          <div class="pub-upload" id="pubDrop">
            <div class="pu-icon">＋</div>
            <div class="pu-main">点击选择 或 拖拽文件到这里</div>
            <div class="pu-sub">图片 jpg/png/webp · 视频 mp4/mov/webm · 可多选</div>
            <input type="file" id="pubFiles" multiple accept="image/*,video/*" style="display:none">
          </div>
          <div id="pubMediaList" class="pub-media-list"></div>
          <div class="form-row" style="margin-top:12px">
            <div class="field"><label>计划发布时间（可留空立即执行）</label><input id="pubSchedule" type="datetime-local"></div>
          </div>
        </div>

        <!-- 右：平台勾选 -->
        <div class="card">
          <div class="card-head">
            <div class="card-title">② 发布平台</div>
            <div class="pill-row" style="gap:5px">
              <button class="pill" data-pub="select-all">全选</button>
              <button class="pill" data-pub="select-overseas">仅海外</button>
              <button class="pill" data-pub="select-none">清空</button>
            </div>
          </div>
          ${groups.map(g => {
            const ps = platforms.filter(p => p.group === g);
            return `<div class="plat-group">
              <div class="plat-group-title">${g}</div>
              <div class="plat-check-grid">
                ${ps.map(p => `<label class="plat-check ${selected(p.id) ? 'on' : ''}" data-pid="${p.id}">
                  <input type="checkbox" value="${p.id}" ${selected(p.id) ? 'checked' : ''}>
                  <span class="pc-ico" style="background:${p.color}">${p.icon}</span>
                  <span class="pc-txt"><b>${esc(p.name)}</b><small>${stabText(p.stability)}</small></span>
                  <span class="pc-tick">✓</span>
                </label>`).join('')}
              </div>
            </div>`;
          }).join('')}
          <button class="btn btn-primary pub-launch" data-pub="launch">开始自动发布 →</button>
          <div class="pub-tip">平台 UI 改版时自动化可能失败，失败会在下面列出并推送到微信，可单独重试。</div>
        </div>
      </section>

      <section class="card mt14">
        <div class="card-head"><div class="card-title">发布任务</div><div class="pill-row">
          <button class="pill" data-pub="refresh-tasks">刷新</button>
          <button class="pill" data-pub="clear-done">清理已完成</button>
        </div></div>
        <div id="publishTasks"></div>
      </section>

      <section class="grid g-publish mt14">
        <div class="card">
          <div class="card-head"><div class="card-title">发布设置</div><div class="card-sub">本地保存</div></div>
          <div class="field"><label>企业微信群机器人 Webhook</label><input id="cfgWebhook" value="${esc(cfg.wecomWebhook)}" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."></div>
          <div class="hint" style="margin:10px 0">微信里建个群 → 群设置 → 群机器人 → 添加 → 复制 Webhook 地址粘贴到这里。<button class="link" data-pub="test-wecom">发送测试消息</button></div>
          <div class="form-row">
            <div class="field"><label>平台间间隔（毫秒）</label><input id="cfgDelay" type="number" min="1000" step="500" value="${cfg.publishDelayMs}"></div>
            <div class="field" style="max-width:120px"><label>失败重试次数</label><input id="cfgRetry" type="number" min="0" max="3" value="${cfg.maxRetries}"></div>
          </div>
          <div class="form-row">
            <label class="switch-row"><input type="checkbox" id="cfgHeadless" ${cfg.headless ? 'checked' : ''}> 无头模式（不弹 Chrome 窗口）</label>
          </div>
          <button class="btn btn-primary" data-pub="save-config">保存设置</button>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">运行日志</div><div class="pill-row"><button class="pill" data-pub="refresh-logs">刷新</button><button class="pill" data-pub="close-browser">关闭 Chrome</button></div></div>
          <div id="pubLogs" class="pub-logs"></div>
          <div class="hint" style="margin-top:10px"><b>首次使用：</b>关闭「演练模式」后第一次真实发布，Chrome 会弹出各平台登录页，请手动登录一次（每平台一次即可）。之后登录态会被记住，无需重复。</div>
        </div>
      </section>`;
  }

  function stabText(s) { return { stable: '较稳定', beta: '测试中', experimental: '实验', manual: '需人工点发布' }[s] || s; }
  function selected(id) {
    const el = $(`.plat-check[data-pid="${id}"] input`);
    if (el) return el.checked;
    return (cfg && cfg.selectedPlatforms || []).includes(id);
  }

  function offlineView() {
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    const h1 = local ? '发布服务没有启动' : '线上版 · 自动发布需本机运行';
    const body = local
      ? `双击项目目录里的 <b>启动发布中心.bat</b>，<br>看到「发布中心已启动」后刷新本页即可。<br><br>发布服务负责驱动你本机的 Chrome 和推送微信通知，<br>数据全部在你本机，不上传任何服务器。`
      : `当前是部署在云端的只读数据看板。<br>自动发布要驱动<b>你自己电脑上的 Chrome 和登录态</b>，<br>这一步只能在本地完成，无法放在云服务器上。<br><br>在本机运行项目里的 <b>启动发布中心.bat</b>，<br>即可解锁完整的自动发布 + 微信通知功能。数据依然全在本机。`;
    return `<div class="view-head"><div><h1>发布中心</h1><p>${local ? '自动发布需要本地服务运行中' : '线上只读版 · 发布功能请在本机使用'}</p></div></div>
      <div class="card" style="max-width:640px;margin:0 auto;text-align:center;padding:48px">
        <div style="font-size:44px;margin-bottom:14px">${local ? '🔌' : '☁️'}</div>
        <div class="card-title" style="font-size:19px;margin-bottom:10px">${h1}</div>
        <p class="card-sub" style="line-height:1.8;margin-bottom:20px">${body}</p>
        <button class="btn btn-ghost" data-pub="retry">${local ? '重新检测连接' : '重新检测'}</button>
      </div>`;
  }

  /* ---------- 任务列表 ---------- */
  function renderTaskList() {
    const box = $('#publishTasks'); if (!box) return;
    if (!tasks.length) { box.innerHTML = '<div class="hint">还没有发布任务。上面填好内容和平台后点「开始自动发布」。</div>'; return; }
    box.innerHTML = tasks.slice(0, 20).map(t => {
      const statusMap = {
        pending: ['待执行', 'gray'], running: ['发布中…', 'blue'],
        done: ['已完成', 'green'], partial: ['部分失败', 'orange'], failed: ['失败', 'red']
      };
      const [label, dot] = statusMap[t.status] || [t.status, 'gray'];
      const ok = (t.results || []).filter(r => r.status === 'success');
      const fail = (t.results || []).filter(r => r.status === 'failed');
      const skip = (t.results || []).filter(r => r.status === 'skipped');
      return `<div class="task-row" data-status="${t.status}">
        <div class="task-top">
          <span class="status-badge"><i class="dot ${dot}"></i>${label}</span>
          <b>${esc(t.title)}</b>
          <span class="card-sub">${new Date(t.createdAt).toLocaleString('zh-CN')}</span>
          <span style="margin-left:auto;display:flex;gap:6px">
            ${t.status === 'pending' ? `<button class="btn btn-ghost" data-pub="run-task" data-id="${t.id}">执行</button>` : ''}
            <button class="btn btn-ghost" data-pub="del-task" data-id="${t.id}">删除</button>
          </span>
        </div>
        <div class="task-detail">
          <span>平台 ${t.platforms.length}</span>
          ${t.results.length ? `<span class="up">成功 ${ok.length}</span>` : ''}
          ${fail.length ? `<span class="down">失败 ${fail.length}</span>` : ''}
          ${skip.length ? `<span>跳过 ${skip.length}</span>` : ''}
          ${t.notified ? '<span class="up">✓ 已推微信</span>' : (t.notifyError ? `<span class="down">微信推送失败</span>` : '')}
          ${t.scheduledAt ? `<span>定时 ${esc(t.scheduledAt)}</span>` : ''}
        </div>
        ${fail.length ? `<div class="task-errors">${fail.map(r => `<div><b>${r.platformName}</b>：${esc(r.error)}</div>`).join('')}</div>` : ''}
        ${ok.filter(r => r.url).length ? `<div class="task-links">${ok.filter(r => r.url).map(r => `<a href="${esc(r.url)}" target="_blank">${r.platformName} ↗</a>`).join('')}</div>` : ''}
      </div>`;
    }).join('');
  }

  async function loadLogs() {
    const box = $('#pubLogs'); if (!box) return;
    const r = await api('/api/logs');
    box.innerHTML = r.ok && r.lines.length ? r.lines.slice().reverse().map(l => `<div>${esc(l)}</div>`).join('') : '<div class="card-sub">暂无日志</div>';
  }

  /* ---------- 交互 ---------- */
  let pendingFiles = [];

  function renderMedia() {
    const box = $('#pubMediaList'); if (!box) return;
    box.innerHTML = pendingFiles.map((f, i) => `<div class="media-item">
      <span class="mi-type">${/\.(mp4|mov|webm)$/i.test(f.originalName) ? '🎬' : '🖼'}</span>
      <span class="mi-name">${esc(f.originalName)}</span>
      <span class="mi-size">${(f.size / 1024 / 1024).toFixed(1)} MB</span>
      <span class="mi-del" data-pub="del-media" data-i="${i}">✕</span>
    </div>`).join('');
  }

  async function uploadFiles(fileList) {
    const fd = new FormData();
    Array.from(fileList).forEach(f => fd.append('files', f));
    const r = await api('/api/media', { method: 'POST', body: fd });
    if (r.ok) { pendingFiles.push(...r.files); renderMedia(); }
    else alert('上传失败：' + r.error);
  }

  function collectSelected() { return $$('.plat-check input:checked').map(i => i.value); }

  async function launch() {
    const text = ($('#pubText') || {}).value || '';
    const title = ($('#pubTitle') || {}).value || '';
    const platformsSel = collectSelected();
    if (!text.trim() && !pendingFiles.length) { alert('请填写文案或上传至少一个文件'); return; }
    if (!platformsSel.length) { alert('请至少勾选一个平台'); return; }
    const scheduledAt = ($('#pubSchedule') || {}).value || null;
    const r = await api('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, text, media: pendingFiles, platforms: platformsSel, scheduledAt })
    });
    if (!r.ok) { alert('创建任务失败：' + r.error); return; }
    pendingFiles = []; renderMedia();
    $('#pubText').value = ''; $('#pubTitle').value = '';
    await refreshTasks(); renderTaskList();
    if (!cfg.dryRun || confirm('任务已创建。演练模式下不会真实发布，是否立即执行演练？\n（点「取消」则只保存待办）')) {
      await runTask(r.task.id);
    }
  }

  async function runTask(id) {
    const r = await api(`/api/tasks/${id}/publish`, { method: 'POST' });
    if (!r.ok) { alert('启动失败：' + r.error); return; }
    await refreshTasks(); renderTaskList();
  }

  async function saveConfig() {
    const patch = {
      wecomWebhook: $('#cfgWebhook').value.trim(),
      publishDelayMs: +$('#cfgDelay').value || 4500,
      maxRetries: +$('#cfgRetry').value || 0,
      headless: $('#cfgHeadless').checked
    };
    const r = await api('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    if (r.ok) { cfg = r.config; alert('设置已保存'); }
  }

  async function toggleDry() {
    const r = await api('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun: !cfg.dryRun }) });
    if (r.ok) { cfg = r.config; render(); }
  }

  function render() {
    const main = $('#mainContent');
    // 只负责发布视图，其余由 app.js 渲染
    if (!main || document.querySelector('#navTabs button.active')?.dataset.view !== 'publish') return;
    main.innerHTML = viewPublish();
    renderTaskList(); loadLogs();
    startPolling();
  }

  /* 事件委托 */
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-pub]'); if (!t) return;
    const a = t.dataset.pub;
    if (a === 'retry') { await init(); render(); return; }
    if (a === 'select-all') { $$('.plat-check input').forEach(i => i.checked = true); $$('.plat-check').forEach(x => x.classList.add('on')); persistSelection(); return; }
    if (a === 'select-none') { $$('.plat-check input').forEach(i => i.checked = false); $$('.plat-check').forEach(x => x.classList.remove('on')); persistSelection(); return; }
    if (a === 'select-overseas') { $$('.plat-check').forEach(x => { const on = ['x','youtube','instagram','facebook','linkedin','tiktok','threads','reddit'].includes(x.dataset.pid); x.querySelector('input').checked = on; x.classList.toggle('on', on); }); persistSelection(); return; }
    if (a === 'del-media') { pendingFiles.splice(+t.dataset.i, 1); renderMedia(); return; }
    if (a === 'launch') { await launch(); return; }
    if (a === 'run-task') { await runTask(t.dataset.id); return; }
    if (a === 'del-task') { await api(`/api/tasks/${t.dataset.id}`, { method: 'DELETE' }); await refreshTasks(); renderTaskList(); return; }
    if (a === 'refresh-tasks') { await refreshTasks(); renderTaskList(); return; }
    if (a === 'clear-done') { for (const task of tasks.filter(x => ['done','partial'].includes(x.status))) await api(`/api/tasks/${task.id}`, { method: 'DELETE' }); await refreshTasks(); renderTaskList(); return; }
    if (a === 'save-config') { await saveConfig(); return; }
    if (a === 'toggle-dry') { await toggleDry(); return; }
    if (a === 'refresh-logs') { await loadLogs(); return; }
    if (a === 'close-browser') { await api('/api/browser/close', { method: 'POST' }); return; }
    if (a === 'test-wecom') {
      const hook = $('#cfgWebhook').value.trim();
      const r = await api('/api/test/wecom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ webhook: hook }) });
      alert(r.ok ? '测试消息已推送，去群里看看' : '推送失败：' + r.error); return;
    }
  });

  document.addEventListener('change', e => {
    if (e.target.matches('.plat-check input')) {
      e.target.closest('.plat-check').classList.toggle('on', e.target.checked);
      persistSelection();
    }
  });

  function persistSelection() {
    const sel = collectSelected();
    api('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedPlatforms: sel }) })
      .then(r => { if (r.ok) cfg = r.config; });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const drop = document.getElementById('pubDrop');
    if (drop) {
      drop.addEventListener('click', () => $('#pubFiles').click());
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); uploadFiles(e.dataTransfer.files); });
      $('#pubFiles').addEventListener('change', e => uploadFiles(e.target.files));
    }
  });

  /* 供 app.js 调用 */
  window.PublishCenter = {
    init, render, viewPublish, refresh: async () => { await init(); render(); },
    isOnline: () => online,
    stopPolling
  };
})();
