/* 任务存储 —— JSON 文件持久化 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'publisher-data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const LOG_DIR = path.join(DATA_DIR, 'logs');

function ensure() {
  [DATA_DIR, MEDIA_DIR, LOG_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
  if (!fs.existsSync(TASKS_FILE)) fs.writeFileSync(TASKS_FILE, '[]', 'utf8');
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({
      wecomWebhook: '',
      chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      userDataDir: path.join(DATA_DIR, 'chrome-profile'),
      headless: false,
      dryRun: true,
      publishDelayMs: 4500,
      maxRetries: 1,
      selectedPlatforms: ['x', 'youtube', 'instagram', 'facebook', 'linkedin', 'tiktok', 'threads']
    }, null, 2), 'utf8');
  }
}

function readTasks() { ensure(); try { return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')); } catch (e) { return []; } }
function writeTasks(t) { ensure(); fs.writeFileSync(TASKS_FILE, JSON.stringify(t, null, 2), 'utf8'); }
function readConfig() { ensure(); return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
function writeConfig(c) { ensure(); fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2), 'utf8'); }

function log(line) {
  ensure();
  const day = new Date().toISOString().slice(0, 10);
  const f = path.join(LOG_DIR, `publish-${day}.log`);
  fs.appendFileSync(f, `[${new Date().toLocaleTimeString('zh-CN')}] ${line}\n`, 'utf8');
}

module.exports = { ROOT, DATA_DIR, MEDIA_DIR, LOG_DIR, ensure, readTasks, writeTasks, readConfig, writeConfig, log };
