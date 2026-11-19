#!/usr/bin/env node
/**
 * 把前端多个文件内联成一个自包含的 deploy/index.html
 * 用于 Cloudflare Pages Direct Upload（只需上传一个文件）
 * 运行: node deploy/build.cjs
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let html = read('index.html');
// 注意：必须用函数形式替换，否则源码中的 $$ / $& 会被 String.replace 当作特殊替换模式
// （例如 publish.js 里的 const $$ 会被替换成 const $，导致语法错误）
html = html.replace('<link rel="stylesheet" href="style.css">', () => '<style>\n' + read('style.css') + '\n</style>');
html = html.replace('<script src="publish.js"></script>', () => '<script>\n' + read('publish.js') + '\n</script>');
html = html.replace('<script src="app.js"></script>', () => '<script>\n' + read('app.js') + '\n</script>');

const out = path.join(ROOT, 'deploy', 'index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('已生成:', out, '(' + Buffer.byteLength(html) + ' bytes)');
