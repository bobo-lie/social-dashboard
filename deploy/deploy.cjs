#!/usr/bin/env node
/**
 * 一键部署：GitHub 推送 + Cloudflare Pages 托管 + 绑定子域名
 *
 * 用法（在项目根目录）：
 *   GITHUB_TOKEN=xxx CLOUDFLARE_API_TOKEN=yyy node deploy/deploy.cjs
 *
 * 需要的权限：
 *   - GitHub Personal Access Token (classic)：勾选 repo
 *   - Cloudflare API Token：Account / Pages:Edit + DNS:Edit
 *
 * 域名：social.lietrade.com（可在 DOMAIN 常量修改）
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GH_TOKEN = process.env.GITHUB_TOKEN;
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const GH_REPO = 'bobo-lie/social-dashboard';
const CF_PROJECT = 'social-dashboard';
const DOMAIN = process.env.DOMAIN || 'social.lietrade.com';
const DEPLOY_DIR = path.join(ROOT, 'deploy');

function fail(msg) { console.error('\n✗ ' + msg); process.exit(1); }
function step(n, msg) { console.log(`\n[${n}/5] ${msg}`); }
function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, stdio: opts.quiet ? 'ignore' : 'inherit', shell: process.platform === 'win32' });
}

async function cfFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${CF_TOKEN}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.success === false)) {
    throw new Error(`${res.status} ${JSON.stringify(data.errors || data)}`);
  }
  return data;
}

(async () => {
  console.log('=== 脉络社媒数据台 · 一键部署 ===\n');
  if (!GH_TOKEN) fail('缺少 GITHUB_TOKEN 环境变量');
  if (!CF_TOKEN) fail('缺少 CLOUDFLARE_API_TOKEN 环境变量');
  if (!fs.existsSync(path.join(DEPLOY_DIR, 'index.html'))) fail('缺少 deploy/index.html，请先运行生成脚本');

  // 1. 推送源码到 GitHub
  step(1, '推送源码到 GitHub');
  try { run('git', ['remote', 'remove', 'origin'], { quiet: true }); } catch (_) {}
  const authUrl = `https://x-access-token:${GH_TOKEN}@github.com/${GH_REPO}.git`;
  run('git', ['remote', 'add', 'origin', authUrl], { quiet: true });
  // 本地分支是 master，远程空仓库需要 main
  run('git', ['branch', '-M', 'main'], { quiet: true });
  run('git', ['push', '-u', 'origin', 'main', '--force']);
  console.log('  源码已推送，仓库：https://github.com/' + GH_REPO);

  // 2. 获取 Cloudflare Account ID
  step(2, '获取 Cloudflare 账户信息');
  const accRes = await cfFetch('https://api.cloudflare.com/client/v4/accounts');
  const accountId = accRes.result[0] && accRes.result[0].id;
  if (!accountId) fail('未找到 Cloudflare 账户，请检查 API Token 权限');
  console.log('  Account ID:', accountId);

  // 3. 创建 Pages 项目（已存在则跳过）
  step(3, '创建 Cloudflare Pages 项目');
  try {
    await cfFetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`, {
      method: 'POST',
      body: JSON.stringify({
        name: CF_PROJECT,
        production_branch: 'main'
      })
    });
    console.log('  项目已创建:', CF_PROJECT);
  } catch (e) {
    if (/already exists|duplicate/i.test(e.message)) console.log('  项目已存在，跳过');
    else throw e;
  }

  // 4. 上传部署单文件（Pages Direct Upload API）
  step(4, '上传站点文件');
  const html = fs.readFileSync(path.join(DEPLOY_DIR, 'index.html'));
  const boundary = '----WB' + Date.now();
  const parts = [];
  function field(name, value) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  field('manifest', JSON.stringify({
    name: 'index.html',
    file_path: 'index.html',
    size: html.length,
    hash: require('crypto').createHash('sha256').update(html).digest('hex')
  }));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="index.html"; filename="index.html"\r\nContent-Type: text/html\r\n\r\n`));
  parts.push(html);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  const body = Buffer.concat(parts);
  const uploadRes = await cfFetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${CF_PROJECT}/deployments`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body
    }
  );
  const deployment = uploadRes.result;
  console.log('  部署已创建:', deployment.id || '(id pending)');
  console.log('  预览地址:', deployment.url || '');

  // 5. 绑定自定义域名
  step(5, `绑定域名 ${DOMAIN}`);
  try {
    await cfFetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${CF_PROJECT}/domains`, {
      method: 'POST',
      body: JSON.stringify({ name: DOMAIN })
    });
    console.log('  域名已绑定:', DOMAIN);
  } catch (e) {
    if (/already exists|duplicate/i.test(e.message)) console.log('  域名已绑定，跳过');
    else console.log('  域名绑定需手动处理:', e.message);
  }

  console.log('\n=== 完成 ===');
  console.log('站点地址: https://' + DOMAIN);
  console.log('GitHub:    https://github.com/' + GH_REPO);
  console.log('\n注意：DNS 解析需 lietrade.com 的 NS 在 Cloudflare；Pages 会自动添加 CNAME 记录。');
})().catch(e => fail(e.message));
