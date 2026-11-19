# 脉络 · 社媒数据台 (Social Media Dashboard)

社媒数据统计、可视化分析与多平台自动发布工具。

## 功能

- **数据看板**：发布数量、流量、互动、最热素材、粉丝增长，纯前端可视化
- **流量分析**：平台播放走势、流量结构、发布节奏
- **内容日历**：已发布 / 计划中 / 待发布
- **数据洞察**：涨粉归因、互动率对比、未来发布建议
- **账号管理**：**从主页链接真实抓取粉丝数**（B站/YouTube/X/Instagram/TikTok/Discord 等）/ 单个添加 / 批量导入 / JSON 导入导出
- **发布中心**（仅本地）：浏览器自动化多平台发布 + 企业微信通知

## 真实账号导入

「账号」页 →「从主页链接导入」：粘贴平台主页链接即可抓取**真实粉丝数**（不是模拟数据）。

- 抓取由本地服务完成，需先运行 `node publisher/server.js`（或双击 `启动发布中心.bat`）。
- 抓取走两条路径：平台公开接口 → 失败则用本机 Chrome 的登录态读取页面。
- 支持的平台与限制见 `发布中心-使用说明.txt`；视频号没有公开主页，只能手动填写。
- 抓取失败会明确报错，不会编造数字；可随时在「手动添加」里补真实粉丝数。

## 本地运行

数据看板是纯静态页面，双击 `index.html` 即可打开。

发布中心需要本地服务（驱动本机 Chrome，用到你的登录态，因此不能放在云端）：

```bash
npm install
node publisher/server.js
```

或双击 `启动发布中心.bat`，然后打开 `index.html` → 「发布中心」。

## 部署到 Cloudflare Pages

仓库地址：`https://github.com/bobo-lie/social-dashboard`（公开）
线上地址：**`https://social.lietrade.com`**（已上线，DNS 托管在 Cloudflare）

> 当前线上版本为 **Cloudflare Pages Direct Upload** 部署的自包含单文件站点
> （`deploy/index.html`，CSS/JS 全部内联）。Pages 项目名 `social-dashboard`。

### 方式一：一键部署（推荐）

双击 `一键部署.bat`，按提示粘贴两个 Token 即可自动完成：
推送源码 → 创建 Pages 项目 → 上传站点 → 绑定域名。

需要准备：

1. **GitHub Token**：https://github.com/settings/tokens → Generate new token (classic) → 勾选 `repo`
2. **Cloudflare Token**：https://dash.cloudflare.com/profile/api-tokens → Create Token →
   Start from scratch → Account policy → 权限组搜索 `Cloudflare Pages` →
   Bulk Select → Add all Read & Write permissions（Pages 读写权限即可）

也可命令行运行：

```bash
node deploy/build.cjs
GITHUB_TOKEN=xxx CLOUDFLARE_API_TOKEN=yyy node deploy/deploy.cjs
```

### 方式二：手动部署

Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git →
选 `bobo-lie/social-dashboard` → 构建命令留空、输出目录填 `deploy` → Deploy。
完成后在项目的 Custom domains 添加 `social.lietrade.com`。

**DNS 说明**：Pages 绑域名后 Cloudflare 不会自动建 CNAME，需到
`lietrade.com → DNS → Records` 手动添加一条：
`social`（CNAME）→ `<项目名>.pages.dev`（本项目为 `social-dashboard-5ly.pages.dev`）。
当前这条记录已添加完成，后续重新部署无需重复操作。

> **发布中心**依赖本机 Chrome 与登录态，**线上版本为只读数据看板**，
> 自动发布仍需本地运行。线上与本地数据互不相通（保存在各自浏览器 localStorage）。

## 数据说明

所有平台数据默认保存在浏览器 `localStorage`，为演示数据；
接入真实数据需要各平台开放接口授权。仓库不包含任何账号凭证、Cookie 或 Webhook 密钥。
