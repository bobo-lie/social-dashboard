/* 平台注册表 —— 发布中心的勾选来源 */
'use strict';

const PLATFORMS = [
  // 海外主力
  { id: 'x',          name: 'X / Twitter', group: '海外', icon: 'X',  color: '#111827', stability: 'stable',   compose: 'https://x.com/compose/post' },
  { id: 'youtube',    name: 'YouTube',     group: '海外', icon: '▶',  color: '#FF0033', stability: 'stable',   compose: 'https://studio.youtube.com/' },
  { id: 'instagram',  name: 'Instagram',   group: '海外', icon: '◎',  color: '#E1306C', stability: 'beta',     compose: 'https://www.instagram.com/' },
  { id: 'facebook',   name: 'Facebook',    group: '海外', icon: 'f',  color: '#1877F2', stability: 'stable',   compose: 'https://www.facebook.com/' },
  { id: 'linkedin',   name: 'LinkedIn',    group: '海外', icon: 'in', color: '#0A66C2', stability: 'stable',   compose: 'https://www.linkedin.com/feed/' },
  { id: 'tiktok',     name: 'TikTok',      group: '海外', icon: '♪',  color: '#111827', stability: 'beta',     compose: 'https://www.tiktok.com/studio' },
  { id: 'threads',    name: 'Threads',     group: '海外', icon: '@',  color: '#111827', stability: 'beta',     compose: 'https://www.threads.net/' },
  { id: 'reddit',     name: 'Reddit',      group: '海外', icon: 'r/', color: '#FF4500', stability: 'beta',     compose: 'https://www.reddit.com/submit' },
  { id: 'telegram',   name: 'Telegram',    group: '海外', icon: '✈',  color: '#26A5E4', stability: 'experimental', compose: 'https://web.telegram.org/' },
  { id: 'pinterest',  name: 'Pinterest',   group: '海外', icon: 'P',  color: '#E60023', stability: 'experimental', compose: 'https://www.pinterest.com/' },
  // 国内（沿用原工具）
  { id: 'bilibili',   name: 'B站',          group: '国内', icon: 'B',  color: '#00A1D6', stability: 'manual',   compose: 'https://member.bilibili.com/platform/upload/video/frame' },
  { id: 'douyin',     name: '抖音',         group: '国内', icon: '抖', color: '#161823', stability: 'manual',   compose: 'https://creator.douyin.com/' },
  { id: 'xhs',        name: '小红书',       group: '国内', icon: '红', color: '#FF2442', stability: 'manual',   compose: 'https://creator.xiaohongshu.com/' },
  { id: 'sph',        name: '视频号',       group: '国内', icon: '视', color: '#FA9D3B', stability: 'manual',   compose: 'https://channels.weixin.qq.com/platform' },
];

const GROUP_ORDER = ['海外', '国内'];

function byId(id) { return PLATFORMS.find(p => p.id === id); }
function ids() { return PLATFORMS.map(p => p.id); }

module.exports = { PLATFORMS, GROUP_ORDER, byId, ids };
