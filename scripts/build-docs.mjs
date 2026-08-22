#!/usr/bin/env node
// 生成 docs/ 文档 HTML 渲染版 + 索引页
// 用法：node scripts/build-docs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const md = new MarkdownIt({ html: true, linkify: true, typographer: false });

// 文档清单：顺序即展示顺序
const DOCS = [
  { file: 'legal-framework.md', title: '法律框架', icon: '⚖️', desc: 'EFMA 法条、Work Permit Conditions、MDW 不受 Employment Act 覆盖、准证关键事实' },
  { file: 'mom-process.md', title: '完整雇佣流程', icon: '🛤️', desc: '申请前 → 申请 → 到达前/后 → 雇佣期 → 通知义务 → 结束雇佣，双语对照含全部时限' },
  { file: 'costs.md', title: '成本模型', icon: '💰', desc: '法定成本汇总表 + 市场成本模板（工资/中介费/保险保费待询价）' },
  { file: 'sources.md', title: '来源索引', icon: '📎', desc: '26 个 MOM 页面 + 法律条文 + eServices 入口索引，含更新日期' },
  { file: 'xhs-insights.md', title: '小红书观察', icon: '📕', desc: '用户评价观察摘要（红黑榜线索、避雷、收费透明度关注点）' },
];

const INTERNAL_DOCS = new Set(DOCS.map(d => d.file.replace(/\.md$/, '')));

// 渲染后的 HTML 中，把文档交叉引用（.md 文本）改为指向渲染版 HTML 的可点击链接
function linkInternalDocs(body) {
  // 1) code 内引用：<code>xxx.md</code> → <code><a href="xxx.html">xxx.md</a></code>
  body = body.replace(/<code>((?:docs\/)?[a-zA-Z0-9_-]+\.md)<\/code>/g, (m, f) => {
    const base = f.replace(/\.md$/, '').replace(/^docs\//, '');
    if (INTERNAL_DOCS.has(base)) return `<code><a href="${base}.html">${f}</a></code>`;
    return m;
  });
  // 2) 裸文本引用（排除 HTML 标签内部，避免与上面已生成的链接冲突）
  body = body.replace(/(?<![<>\/a-zA-Z0-9_-])(?:docs\/)?([a-zA-Z0-9_-]+\.md)(?![a-zA-Z0-9_-])/g, (m, f) => {
    const base = f.replace(/\.md$/, '').replace(/^docs\//, '');
    if (INTERNAL_DOCS.has(base)) return `<a href="${base}.html">${f}</a>`;
    return m;
  });
  return body;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
:root { --ink:#1f2937; --muted:#6b7280; --line:#e5e7eb; --accent:#2563eb; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif; color:var(--ink); background:#f9fafb; line-height:1.8; }
.wrap { max-width:820px; margin:0 auto; padding:36px 20px 60px; }
.bread { font-size:12px; color:var(--muted); margin-bottom:18px; }
.bread a { color:var(--accent); text-decoration:none; }
h1 { font-size:26px; margin:0 0 8px; }
.doc-sub { color:var(--muted); font-size:13px; margin-bottom:26px; padding-bottom:16px; border-bottom:2px solid var(--line); }
article { background:#fff; border:1px solid var(--line); border-radius:12px; padding:28px 32px; }
article h1 { font-size:22px; margin-bottom:16px; }
article h2 { font-size:19px; margin:28px 0 10px; padding-bottom:6px; border-bottom:1px solid var(--line); }
article h3 { font-size:16px; margin:20px 0 8px; }
article p { margin:10px 0; font-size:14px; }
article ul, article ol { margin:10px 0 10px 24px; font-size:14px; }
article li { margin:4px 0; }
article blockquote { border-left:4px solid var(--accent); background:#eff6ff; padding:10px 16px; margin:12px 0; border-radius:0 8px 8px 0; color:#1e3a8a; font-size:13px; }
article blockquote p { margin:4px 0; }
article table { width:100%; border-collapse:collapse; margin:14px 0; font-size:13px; }
article th, article td { padding:8px 10px; border:1px solid var(--line); text-align:left; vertical-align:top; }
article th { background:#f3f4f6; font-weight:600; }
article a { color:var(--accent); }
article code { background:#f3f4f6; padding:1px 6px; border-radius:4px; font-size:12px; }
article pre { background:#111827; color:#f9fafb; padding:14px 16px; border-radius:8px; overflow-x:auto; font-size:12px; margin:12px 0; }
article pre code { background:none; padding:0; color:inherit; }
.back { margin-top:24px; font-size:13px; }
.back a { color:var(--accent); text-decoration:none; }
/* 索引页 */
.cards { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:8px; }
@media (max-width:640px) { .cards { grid-template-columns:1fr; } }
.card { background:#fff; border:1px solid var(--line); border-radius:12px; padding:20px; transition:box-shadow .15s, border-color .15s; }
.card:hover { border-color:var(--accent); box-shadow:0 2px 8px rgba(37,99,235,.12); }
.card .ic { font-size:22px; }
.card h3 { font-size:15px; margin:8px 0 6px; }
.card h3 a { color:var(--ink); text-decoration:none; }
.card h3 a:hover { color:var(--accent); }
.card p { font-size:12px; color:var(--muted); line-height:1.7; }
.hint { font-size:12px; color:var(--muted); margin-top:22px; line-height:1.8; }
`;

// 生成单篇文档页
const docPages = DOCS.map(d => {
  const body = linkInternalDocs(md.render(fs.readFileSync(path.join(ROOT, 'docs', d.file), 'utf8')));
  const base = d.file.replace(/\.md$/, '');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(d.title)} · sg-helper</title>
<meta name="description" content="${esc(d.desc)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏡</text></svg>">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="bread"><a href="../index.html">🏠 看板</a> ｜ <a href="./index.html">📚 文档索引</a></div>
  <h1>${d.icon} ${esc(d.title)}</h1>
  <p class="doc-sub">${esc(d.desc)}</p>
  <article>${body}</article>
  <p class="back"><a href="./index.html">← 返回文档索引</a> ｜ <a href="../index.html">返回看板</a></p>
</div>
</body>
</html>`;
});

// 索引页
const cards = DOCS.map(d => `
  <div class="card">
    <div class="ic">${d.icon}</div>
    <h3><a href="${d.file.replace(/\.md$/, '.html')}">${esc(d.title)}</a></h3>
    <p>${esc(d.desc)}</p>
  </div>`).join('');

const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>文档索引 · sg-helper</title>
<meta name="description" content="新加坡女佣雇佣法律流程与中介观察文档索引">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏡</text></svg>">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="bread"><a href="../index.html">🏠 返回看板</a></div>
  <h1>📚 法律与流程研究</h1>
  <p class="doc-sub">MOM 雇佣外籍女佣（MDW）的法规、流程、成本与中介观察文档。信息以 MOM 官网为准，双语对照。</p>
  <div class="cards">${cards}</div>
  <p class="hint">📅 信息截至 2026-08-22。政策可能变化，重大决策前请以 <a href="https://www.mom.gov.sg" target="_blank">MOM 官网</a> 当前内容为准。</p>
</div>
</body>
</html>`;

// 写入
for (let i = 0; i < DOCS.length; i++) {
  fs.writeFileSync(path.join(ROOT, 'docs', DOCS[i].file.replace(/\.md$/, '.html')), docPages[i]);
}
fs.writeFileSync(path.join(ROOT, 'docs', 'index.html'), indexHtml);
console.log(`已生成 docs/index.html + ${DOCS.length} 篇文档 HTML`);
