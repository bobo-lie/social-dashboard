#!/usr/bin/env node
/** 用 GitHub Contents API 逐文件推送（空仓库可用，git CLI 走代理失败时的备用通道） */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) { console.error('缺少 GITHUB_TOKEN'); process.exit(1); }
const OWNER = 'bobo-lie', REPO = 'social-dashboard', BRANCH = 'main';
const ROOT = path.resolve(__dirname, '..');
const API = 'https://api.github.com';

function api(method, urlPath, body) {
  const args = ['-s', '-X', method, `${API}${urlPath}`,
    '-H', `Authorization: Bearer ${TOKEN}`,
    '-H', 'Accept: application/vnd.github+json',
    '-H', 'X-GitHub-Api-Version: 2022-11-28'];
  if (body !== undefined) { args.push('-H', 'Content-Type: application/json'); args.push('--data-binary', '@-'); }
  const out = execFileSync('curl', args, { input: body === undefined ? undefined : JSON.stringify(body), maxBuffer: 50 * 1024 * 1024 });
  return JSON.parse(out.toString());
}

(async () => {
  console.log('=== GitHub Contents API 推送 ===');
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT }).toString().split('\0').filter(Boolean);
  console.log('文件数:', files.length);
  let ok = 0, fail = 0;
  for (const f of files) {
    // URL 编码路径（中文文件名）
    const enc = f.split('/').map(encodeURIComponent).join('/');
    const content = fs.readFileSync(path.join(ROOT, f)).toString('base64');
    const body = {
      message: '添加 ' + f,
      content,
      branch: BRANCH
    };
    // 若文件已存在需带 sha
    let existing;
    try { existing = api('GET', `/repos/${OWNER}/${REPO}/contents/${enc}?ref=${BRANCH}`); } catch (_) {}
    if (existing && existing.sha) body.sha = existing.sha;
    const res = api('PUT', `/repos/${OWNER}/${REPO}/contents/${enc}`, body);
    if (res.content && res.content.sha) { console.log('  ✓', f); ok++; }
    else { console.log('  ✗', f, JSON.stringify(res).slice(0, 160)); fail++; }
  }
  console.log(`\n完成: ${ok} 成功, ${fail} 失败`);
  console.log('https://github.com/' + OWNER + '/' + REPO);
  if (fail) process.exit(1);
})().catch(e => { console.error('✗', e.message); process.exit(1); });
