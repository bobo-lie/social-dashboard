/* 企业微信群机器人通知 */
'use strict';
const store = require('./store');

function escapeMd(s) { return String(s == null ? '' : s).replace(/([<>])/g, '\\$1'); }

async function send(text, opts = {}) {
  const cfg = store.readConfig();
  const webhook = (opts.webhook || cfg.wecomWebhook || '').trim();
  if (!webhook) return { ok: false, error: '未配置企业微信群机器人 Webhook' };
  if (!/^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send/.test(webhook))
    return { ok: false, error: 'Webhook 地址格式不正确，应为企业微信 qyapi.weixin.qq.com 的机器人地址' };

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'markdown', markdown: { content: text } })
    });
    const data = await res.json();
    if (data.errcode === 0) { store.log('通知已推送到企业微信'); return { ok: true }; }
    return { ok: false, error: `微信返回 ${data.errcode}: ${data.errmsg}` };
  } catch (e) {
    return { ok: false, error: '网络错误：' + e.message };
  }
}

function buildSummary(results, task) {
  const ok = results.filter(r => r.status === 'success');
  const fail = results.filter(r => r.status === 'failed');
  const skip = results.filter(r => r.status === 'skipped');
  const dry = cfgDry();
  const head = dry ? '### 🧪 发布演练完成（未真实发布）\n' : '### ✅ 自动发布任务完成\n';
  let body = head;
  body += `> 内容：**${escapeMd(task.title || '(无标题)')}**\n`;
  body += `> 计划时间：${task.scheduledAt || '立即'}　完成时间：${new Date().toLocaleString('zh-CN')}\n\n`;
  body += `**结果：** 成功 ${ok.length} / 失败 ${fail.length} / 跳过 ${skip.length}\n\n`;
  if (ok.length) body += `🟢 成功：${ok.map(r => r.platformName).join('、')}\n`;
  if (fail.length) body += `🔴 失败：${fail.map(r => `${r.platformName}（${escapeMd(r.error || '未知')}）`).join('、')}\n`;
  if (skip.length) body += `⚪ 跳过：${skip.map(r => r.platformName).join('、')}\n`;
  const urlLines = ok.filter(r => r.url).map(r => `> [${r.platformName}] ${r.url}`);
  if (urlLines.length) body += `\n**已发布链接**\n${urlLines.join('\n')}\n`;
  return body;
}

function cfgDry() { try { return !!store.readConfig().dryRun; } catch (e) { return true; } }

module.exports = { send, buildSummary };
