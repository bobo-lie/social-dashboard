/* 浏览器自动化引擎 —— 复用你已登录的 Chrome，逐平台发布 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const store = require('./store');
const { byId } = require('./platforms');

let context = null;

async function getContext(cfg) {
  if (context) return context;
  const executablePath = cfg.chromePath;
  if (!fs.existsSync(executablePath)) throw new Error('找不到 Chrome：' + executablePath);
  store.log('启动 Chrome（持久化用户目录，复用已登录状态）');
  context = await chromium.launchPersistentContext(cfg.userDataDir, {
    executablePath,
    headless: !!cfg.headless,
    viewport: { width: 1440, height: 900 },
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check']
  });
  return context;
}

async function closeContext() {
  if (context) { try { await context.close(); } catch (e) {} context = null; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 通用：在多个选择器中找第一个可见元素 */
async function findFirst(page, selectors, timeout = 6000) {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: Math.min(1800, timeout) })) return el;
    } catch (e) {}
  }
  return null;
}

async function fillText(page, text, selectors) {
  const el = await findFirst(page, selectors);
  if (!el) return false;
  await el.click();
  await el.fill(text);
  return true;
}

async function uploadFiles(page, files, selectors) {
  if (!files || !files.length) return 0;
  const inputSel = [
    'input[type=file][accept*="image"]', 'input[type=file][accept*="video"]',
    'input[type=file]', '[data-testid*="file"] input[type=file]'
  ].concat(selectors || []);
  let n = 0;
  for (const sel of [...new Set(inputSel)]) {
    const count = await page.locator(sel).count();
    if (!count) continue;
    for (let i = 0; i < count && n < files.length; i++) {
      try { await page.locator(sel).nth(i).setInputFiles(files.slice(n, n + 1)); n++; }
      catch (e) { store.log('上传失败 ' + sel + '：' + e.message); }
    }
    if (n >= files.length) break;
  }
  return n;
}

function mediaPaths(task) {
  return (task.media || []).map(m => path.join(store.MEDIA_DIR, m.storedName)).filter(f => fs.existsSync(f));
}

/* ---------- 各平台适配器 ---------- */
const adapters = {
  x: async (page, task, ctx) => {
    await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1800);
    if (page.url().includes('/i/flow/login') || page.url().includes('/login')) throw new Error('X 未登录，请先在专用 Chrome 中登录');
    const ok = await fillText(page, task.text, ['[data-testid="tweetTextarea_0"]', 'div[role="textbox"]', 'textarea']);
    if (!ok) throw new Error('找不到 X 输入框');
    await uploadFiles(page, ctx.files);
    await sleep(1200);
    if (!ctx.dryRun) {
      const btn = await findFirst(page, ['[data-testid="tweetButton"]', 'button:has-text("发布")', 'button:has-text("Post")']);
      if (!btn) throw new Error('找不到 X 发布按钮');
      await btn.click();
      await sleep(2500);
      return { url: page.url().includes('/status/') ? page.url() : '' };
    }
    return {};
  },

  youtube: async (page, task, ctx) => {
    await page.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1800);
    if (page.url().includes('/accounts/signin') || page.url().includes('accounts.google.com')) throw new Error('YouTube 未登录');
    const upload = await findFirst(page, ['ytcp-button#create-icon', 'button[aria-label="创建"]', 'ytd-button-renderer:has-text("创建")', 'button:has-text("Create")']);
    if (upload) { await upload.click(); await sleep(800); }
    const menu = await findFirst(page, ['tp-yt-paper-item:has-text("上传视频")', 'tp-yt-paper-item:has-text("Upload videos")', 'a:has-text("上传视频")']);
    if (menu) { await menu.click(); await sleep(1000); }
    const videos = ctx.files.filter(f => /\.(mp4|mov|webm|mkv|avi)$/i.test(f));
    if (!videos.length) throw new Error('YouTube 需要视频文件');
    const input = await findFirst(page, ['input[type=file][accept*="video"]', 'input[type=file]']);
    if (!input) throw new Error('找不到 YouTube 上传控件');
    await input.setInputFiles(videos);
    await sleep(2500);
    // 填写标题/简介/标签
    await fillText(page, task.title || task.text.slice(0, 80), ['#textbox input', 'input[placeholder*="标题"]', 'input[aria-label*="Title"]']);
    await fillText(page, task.text, ['#description-textarea ytp-textarea textarea', 'textarea[aria-label*="Description"]', 'textarea']);
    await sleep(1200);
    if (!ctx.dryRun) {
      let done = false;
      for (let i = 0; i < 3 && !done; i++) {
        const btn = await findFirst(page, ['ytcp-button#done-button', 'button:has-text("完成")', 'button:has-text("Done")', 'ytcp-button:has-text("发布")']);
        if (btn && await btn.isEnabled()) { await btn.click(); done = true; }
        await sleep(2000);
      }
      if (!done) throw new Error('YouTube 未完成发布（可能仍在转码）');
      return { url: page.url() };
    }
    return {};
  },

  instagram: async (page, task, ctx) => {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    if (page.url().includes('/accounts/login')) throw new Error('Instagram 未登录');
    const create = await findFirst(page, ['a[href*="create"]', 'div[role="button"]:has-text("创建")', 'button:has-text("Create")', 'svg[aria-label="新建"]']);
    if (create) { await create.click(); await sleep(1000); }
    const media = ctx.files.filter(f => /\.(jpg|jpeg|png|mp4|mov)$/i.test(f));
    if (!media.length) throw new Error('Instagram 需要图片或视频');
    const input = await findFirst(page, ['input[type=file][accept*="image"]', 'input[type=file]']);
    if (!input) throw new Error('找不到 Instagram 上传控件');
    await input.setInputFiles(media);
    await sleep(2500);
    // 多步向导：Next → 文案 → Next → Share
    for (let i = 0; i < 3; i++) {
      const next = await findFirst(page, ['button:has-text("下一步")', 'button:has-text("Next")', 'div[role="button"]:has-text("下一步")']);
      if (next) { await next.click(); await sleep(1200); }
    }
    await fillText(page, task.text, ['textarea[aria-label*="说明"]', 'textarea[aria-label*="Caption"]', 'div[contenteditable="true"]']);
    if (!ctx.dryRun) {
      const share = await findFirst(page, ['button:has-text("分享")', 'button:has-text("Share")', 'div[role="button"]:has-text("分享")']);
      if (!share) throw new Error('找不到 Instagram 分享按钮');
      await share.click(); await sleep(3000);
    }
    return {};
  },

  facebook: async (page, task, ctx) => {
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    if (page.url().includes('/login')) throw new Error('Facebook 未登录');
    const composer = await findFirst(page, ['[role="textbox"][aria-label*="帖子"]', 'div[contenteditable="true"]', 'textarea[placeholder*="What"]', 'textarea']);
    if (!composer) { await page.goto('https://www.facebook.com/me/?modal=admin_todo_tour', { waitUntil: 'domcontentloaded' }); await sleep(1500); }
    const box = await findFirst(page, ['[role="textbox"][aria-label*="帖子"]', 'div[contenteditable="true"]', 'textarea']);
    if (!box) throw new Error('找不到 Facebook 发帖框');
    await box.click(); await box.fill(task.text);
    await uploadFiles(page, ctx.files);
    await sleep(1500);
    if (!ctx.dryRun) {
      const btn = await findFirst(page, ['[aria-label="发布"]', 'button:has-text("发布")', 'button:has-text("Post")', 'div[aria-label="Post"]']);
      if (!btn) throw new Error('找不到 Facebook 发布按钮');
      await btn.click(); await sleep(2500);
    }
    return {};
  },

  linkedin: async (page, task, ctx) => {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    if (page.url().includes('/login')) throw new Error('LinkedIn 未登录');
    const start = await findFirst(page, ['button:has-text("开始发帖子")', 'button:has-text("Start a post")', '.share-box-feed-entry__trigger']);
    if (start) { await start.click(); await sleep(1200); }
    const box = await findFirst(page, ['div[contenteditable="true"][role="textbox"]', 'textarea[data-id="post-text"]', 'div.ql-editor']);
    if (!box) throw new Error('找不到 LinkedIn 输入框');
    await box.click(); await box.fill(task.text);
    await uploadFiles(page, ctx.files);
    await sleep(1500);
    if (!ctx.dryRun) {
      const btn = await findFirst(page, ['button:has-text("发布")', 'button:has-text("Post")', '.share-actions__primary-action']);
      if (!btn) throw new Error('找不到 LinkedIn 发布按钮');
      await btn.click(); await sleep(2500);
    }
    return {};
  },

  tiktok: async (page, task, ctx) => {
    await page.goto('https://www.tiktok.com/studio/upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    if (page.url().includes('/login')) throw new Error('TikTok 未登录');
    const videos = ctx.files.filter(f => /\.(mp4|mov|webm)$/i.test(f));
    if (!videos.length) throw new Error('TikTok 需要视频文件');
    const input = await findFirst(page, ['input[type=file][accept*="video"]', 'input[type=file]']);
    if (!input) throw new Error('找不到 TikTok 上传控件');
    await input.setInputFiles(videos);
    await sleep(3000);
    await fillText(page, task.text, ['[data-testid*="caption"] [contenteditable="true"]', 'div[contenteditable="true"]', 'textarea']);
    if (!ctx.dryRun) {
      const btn = await findFirst(page, ['button:has-text("发布")', 'button:has-text("Post")', 'button:has-text("发布视频")']);
      if (!btn) throw new Error('找不到 TikTok 发布按钮');
      await btn.click(); await sleep(3000);
    }
    return {};
  },

  threads: async (page, task, ctx) => {
    await page.goto('https://www.threads.net/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    if (page.url().includes('/login')) throw new Error('Threads 未登录');
    const box = await findFirst(page, ['[contenteditable="true"][data-placeholder*="说"]', 'div[contenteditable="true"]', 'textarea']);
    if (!box) throw new Error('找不到 Threads 输入框');
    await box.click(); await box.fill(task.text);
    await uploadFiles(page, ctx.files);
    await sleep(1200);
    if (!ctx.dryRun) {
      const btn = await findFirst(page, ['button:has-text("发布")', 'button:has-text("Post")', 'button[aria-label="发布"]']);
      if (!btn) throw new Error('找不到 Threads 发布按钮');
      await btn.click(); await sleep(2200);
    }
    return {};
  },

  reddit: async (page, task, ctx) => {
    await page.goto('https://www.reddit.com/submit', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    if (page.url().includes('/login')) throw new Error('Reddit 未登录');
    await fillText(page, task.title || 'Post', ['input[placeholder*="title"]', 'textarea[placeholder*="title"]', '[data-testid="post-title"]']);
    await fillText(page, task.text, ['[contenteditable="true"][role="textbox"]', 'textarea[data-testid*="text"]', 'textarea']);
    await uploadFiles(page, ctx.files);
    if (!ctx.dryRun) {
      const btn = await findFirst(page, ['button:has-text("发布")', 'button:has-text("Post")', 'button[data-testid="post-submit-button"]']);
      if (!btn) throw new Error('找不到 Reddit 发布按钮');
      await btn.click(); await sleep(2500);
    }
    return {};
  },

  telegram: async (page, task, ctx) => {
    await page.goto('https://web.telegram.org/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);
    if (page.url().includes('/login')) throw new Error('Telegram 未登录');
    const box = await findFirst(page, ['div[contenteditable="true"][data-placeholder]', 'textarea#message-input', 'div[contenteditable="true"]']);
    if (!box) throw new Error('找不到 Telegram 输入框');
    await box.click(); await box.fill(task.text);
    await uploadFiles(page, ctx.files);
    if (!ctx.dryRun) {
      await page.keyboard.press('Enter'); await sleep(1200);
    }
    return {};
  },

  pinterest: async (page, task, ctx) => {
    await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    if (page.url().includes('/login')) throw new Error('Pinterest 未登录');
    const imgs = ctx.files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    if (!imgs.length) throw new Error('Pinterest 需要图片');
    const input = await findFirst(page, ['input[type=file][accept*="image"]', 'input[type=file]']);
    if (!input) throw new Error('找不到 Pinterest 上传控件');
    await input.setInputFiles(imgs);
    await sleep(2000);
    await fillText(page, task.title || task.text.slice(0, 80), ['input[placeholder*="标题"]', 'input[name="title"]']);
    await fillText(page, task.text, ['textarea[placeholder*="说明"]', 'div[contenteditable="true"]']);
    if (!ctx.dryRun) {
      const btn = await findFirst(page, ['button:has-text("发布")', 'button:has-text("Publish")', 'div[role="button"]:has-text("发布")']);
      if (!btn) throw new Error('找不到 Pinterest 发布按钮');
      await btn.click(); await sleep(2500);
    }
    return {};
  }
};

async function publishOne(task, platformId, cfg) {
  const p = byId(platformId);
  const ctx = { dryRun: !!cfg.dryRun, files: mediaPaths(task) };
  const started = Date.now();
  store.log(`开始 ${p.name} dryRun=${ctx.dryRun} 文件${ctx.files.length}个`);
  if (p.stability === 'manual') return { platform: platformId, platformName: p.name, status: 'skipped', error: '该平台需人工点发布，已生成素材待办', ms: 0 };
  if (!adapters[platformId]) return { platform: platformId, platformName: p.name, status: 'skipped', error: '暂无自动化适配器', ms: 0 };
  const c = await getContext(cfg);
  const page = await c.newPage();
  try {
    const extra = await adapters[platformId](page, task, ctx);
    store.log(`${p.name} 成功（${Date.now() - started}ms）`);
    return { platform: platformId, platformName: p.name, status: 'success', url: extra.url || '', ms: Date.now() - started };
  } catch (e) {
    // 演练模式：登录态缺失或页面改版都属于环境问题，不应算作"发布失败"，
    // 而是如实在演练结果里标注，让用户先看懂流程、再去登录/适配。
    if (ctx.dryRun) {
      store.log(`${p.name} 演练跳过（环境未就绪）：${e.message}`);
      return { platform: platformId, platformName: p.name, status: 'skipped', error: '演练：' + e.message, ms: Date.now() - started };
    }
    store.log(`${p.name} 失败：${e.message}`);
    return { platform: platformId, platformName: p.name, status: 'failed', error: e.message, ms: Date.now() - started };
  } finally {
    try { await page.close(); } catch (e) {}
  }
}

async function runTask(task, cfg, onProgress) {
  const results = [];
  for (const pid of task.platforms) {
    let r = await publishOne(task, pid, cfg);
    if (r.status === 'failed' && (cfg.maxRetries || 0) > 0) {
      const delay = (cfg.publishDelayMs || 4000) * 1.5;
      await sleep(delay);
      r = await publishOne(task, pid, cfg);
    }
    results.push(r);
    if (onProgress) onProgress(results.slice());
    const pause = cfg.dryRun ? Math.min(800, cfg.publishDelayMs || 800) : (cfg.publishDelayMs || 0);
    if (pause) await sleep(pause);
  }
  return results;
}

module.exports = { runTask, closeContext, getContext, adapters };
