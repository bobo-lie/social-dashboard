#!/usr/bin/env node
/**
 * 一键部署：GitHub 推送 + Cloudflare Pages Direct Upload + 绑定子域名
 *
 * Cloudflare Pages Direct Upload 采用经过 wrangler 源码验证的 5 步协议：
 *   1. 本地构建 manifest（blake3 hash）
 *   2. GET  upload-token       (apiToken 鉴权) -> 短期 JWT
 *   3. POST assets/check-missing (JWT) -> 缺失 hash 列表
 *   4. POST assets/upload        (JWT) -> 上传缺失文件（base64）
 *   5. POST assets/upsert-hashes (JWT) -> 声明本次部署 asset 集合
 *   6. POST .../deployments      (apiToken 鉴权, multipart manifest)
 *
 * 用法：
 *   node deploy/build.cjs
 *   GITHUB_TOKEN=xxx CLOUDFLARE_API_TOKEN=yyy node deploy/deploy.cjs
 *
 * Token 权限：
 *   - GitHub PAT (classic): repo
 *   - Cloudflare API Token: Pages:Edit + Zone:DNS:Edit (lietrade.com)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { blake3 } = require('hash-wasm');

const ROOT = path.resolve(__dirname, '..');
const GH_TOKEN = process.env.GITHUB_TOKEN;
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const GH_REPO = 'bobo-lie/social-dashboard';
const CF_PROJECT = 'social-dashboard';
const DOMAIN = process.env.DOMAIN || 'social.lietrade.com';
const DEPLOY_DIR = path.join(ROOT, 'deploy');
const CF_API = 'https://api.cloudflare.com/client/v4';

function fail(msg) { console.error('\n✗ ' + msg); process.exit(1); }
function step(n, msg) { console.log(`\n[${n}/6] ${msg}`); }
function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    cwd: ROOT,
    stdio: opts.quiet ? 'ignore' : 'inherit',
    shell: process.platform === 'win32'
  });
}

async function cfFetch(url, { token = CF_TOKEN, json, body, method = 'GET', headers = {} } = {}) {
  const opts = { method, headers: { Authorization: `Bearer ${token}`, ...headers } };
  if (json !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(json);
  } else if (body !== undefined) {
    opts.body = body;
  }
  const res = await fetch(url, opts);
  let data;
  try { data = await res.json(); } catch (_) { data = {}; }
  if (!res.ok || data.success === false) {
    const msg = (data.errors || []).map(e => e.message || e.code).join('; ') || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function contentType(file) {
  return { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.txt': 'text/plain', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg' }[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

async function fileHash(buf, file) {
  // wrangler: hash = blake3(base64(content) + ext).hex()[:32]
  const ext = path.extname(file).replace(/^\./, '');
  const input = buf.toString('base64') + ext;
  const hex = await blake3(Buffer.from(input));
  return hex.slice(0, 32);
}

(async () => {
  console.log('=== 脉络社媒数据台 · 一键部署 ===\n');
  if (!GH_TOKEN) fail('缺少 GITHUB_TOKEN 环境变量');
  if (!CF_TOKEN) fail('缺少 CLOUDFLARE_API_TOKEN 环境变量');
  const htmlPath = path.join(DEPLOY_DIR, 'index.html');
  if (!fs.existsSync(htmlPath)) fail('缺少 deploy/index.html，请先运行 node deploy/build.cjs');

  // 1. 推送源码到 GitHub
  step(1, '推送源码到 GitHub');
  try { run('git', ['remote', 'remove', 'origin'], { quiet: true }); } catch (_) {}
  const authUrl = `https://x-access-token:${GH_TOKEN}@github.com/${GH_REPO}.git`;
  run('git', ['remote', 'add', 'origin', authUrl], { quiet: true });
  run('git', ['branch', '-M', 'main'], { quiet: true });
  run('git', ['push', '-u', 'origin', 'main', '--force']);
  console.log('  已推送: https://github.com/' + GH_REPO);

  // 2. 获取 Account ID
  step(2, '获取 Cloudflare 账户信息');
  const accRes = await cfFetch(`${CF_API}/accounts`);
  const accountId = accRes.result[0] && accRes.result[0].id;
  if (!accountId) fail('未找到 Cloudflare 账户，请检查 Token 权限');
  console.log('  Account ID:', accountId);

  // 3. 确保 Pages 项目存在
  step(3, '检查 Pages 项目');
  try {
    await cfFetch(`${CF_API}/accounts/${accountId}/pages/projects`, {
      method: 'POST', json: { name: CF_PROJECT, production_branch: 'main' }
    });
    console.log('  项目已创建:', CF_PROJECT);
  } catch (e) {
    if (/already exists|duplicate|taken/i.test(e.message)) console.log('  项目已存在，复用');
    else throw e;
  }

  // 4. 构建 manifest + 上传 asset
  step(4, '构建 manifest 并上传文件');
  const files = fs.readdirSync(DEPLOY_DIR).filter(f => fs.statSync(path.join(DEPLOY_DIR, f)).isFile());
  const manifest = {};       // "/index.html" -> hash
  const assetMap = {};       // hash -> { base64, contentType }
  for (const f of files) {
    const buf = fs.readFileSync(path.join(DEPLOY_DIR, f));
    const hash = await fileHash(buf, f);
    manifest['/' + f] = hash;
    assetMap[hash] = { value: buf.toString('base64'), contentType: contentType(f) };
  }
  console.log('  文件数:', files.length, '| manifest:', JSON.stringify(manifest));

  // 4a. upload-token (apiToken 鉴权)
  const tokenRes = await cfFetch(
    `${CF_API}/accounts/${accountId}/pages/projects/${CF_PROJECT}/upload-token`
  );
  const jwt = tokenRes.result;
  if (!jwt) fail('获取 upload-token 失败');
  console.log('  已获取上传令牌');

  // 4b. check-missing (JWT 鉴权，路径无 account 前缀)
  const hashes = Object.keys(assetMap);
  const missingRes = await cfFetch(`${CF_API}/pages/assets/check-missing`, {
    token: jwt, method: 'POST', json: { hashes }
  });
  const missing = missingRes.result && missingRes.result.hashes ? missingRes.result.hashes : (missingRes.result || []);
  console.log('  需上传文件:', Array.isArray(missing) ? missing.length : '全部');

  // 4c. upload (分批，JWT)
  const toUpload = Array.isArray(missing) && missing.length ? missing : hashes;
  const batch = [];
  for (const h of toUpload) {
    const a = assetMap[h];
    if (!a) continue;
    batch.push({ key: h, value: a.value, metadata: { contentType: a.contentType }, base64: true });
  }
  for (let i = 0; i < batch.length; i += 200) {
    await cfFetch(`${CF_API}/pages/assets/upload`, {
      token: jwt, method: 'POST', json: batch.slice(i, i + 200)
    });
  }
  console.log('  上传完成');

  // 4d. upsert-hashes (JWT) —— 声明本次部署完整 asset 集合
  await cfFetch(`${CF_API}/pages/assets/upsert-hashes`, {
    token: jwt, method: 'POST', json: { hashes }
  });
  console.log('  已登记 asset 集合');

  // 5. 创建 deployment (apiToken, multipart manifest)
  step(5, '创建部署');
  const boundary = '----WB' + Date.now().toString(16);
  const parts = [];
  function field(name, value) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  field('manifest', JSON.stringify(manifest));
  field('branch', 'main');
  field('commit_message', '脉络社媒数据台一键部署');
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const deployRes = await cfFetch(
    `${CF_API}/accounts/${accountId}/pages/projects/${CF_PROJECT}/deployments`,
    {
      method: 'POST',
      body: Buffer.concat(parts),
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }
    }
  );
  console.log('  部署已创建:', (deployRes.result && deployRes.result.url) || '(pending)');

  // 6. 绑定域名
  step(6, `绑定域名 ${DOMAIN}`);
  try {
    await cfFetch(`${CF_API}/accounts/${accountId}/pages/projects/${CF_PROJECT}/domains`, {
      method: 'POST', json: { name: DOMAIN }
    });
    console.log('  域名已绑定:', DOMAIN);
  } catch (e) {
    if (/already exists|duplicate/i.test(e.message)) console.log('  域名已绑定，跳过');
    else console.log('  域名绑定需手动处理:', e.message);
  }

  console.log('\n=== 完成 ===');
  console.log('站点地址:  https://' + DOMAIN);
  console.log('GitHub:     https://github.com/' + GH_REPO);
  console.log('Pages 项目: https://dash.cloudflare.com/' + accountId + '/pages/viewer/' + CF_PROJECT);
  console.log('\n提示：首次 DNS 生效可能需要几分钟；确认 lietrade.com 的 NS 在 Cloudflare。');
})().catch(e => fail(e.message));
