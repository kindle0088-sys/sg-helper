#!/usr/bin/env node
// 生成前十中介独立研报 agencies/reports/*.html + 索引页
// 数据源：
//   data/agency-scores.json        综合评分
//   data/agencies.json             基本信息
//   data/agency-report-notes.json  收费/案例/优劣势（人工整理带来源）
//   data/agencies/raw/google-reviews.json  Google 评论
// 用法：node scripts/build-agency-reports.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const scores = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/agency-scores.json'), 'utf8'));
const agencies = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/agencies.json'), 'utf8')).agencies;
const notes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/agency-report-notes.json'), 'utf8')).agencies;
const reviewsRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/agencies/raw/google-reviews.json'), 'utf8'));

const byId = Object.fromEntries(agencies.map(a => [a.id, a]));
const reviewsById = Object.fromEntries(reviewsRaw.agencies.map(a => [a.id, a.reviews || []]));

const TOP_N = 10;
const top = scores.scores.slice(0, TOP_N);

const pct = (v) => (v != null ? v.toFixed(1) + '%' : '—');
const rankMedal = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;

function starStr(r) {
  if (r == null) return '';
  return '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
}

function scoreSection(s) {
  const c = s.components || {};
  const rows = [
    ['MOM 官方评分（权重 30%）', c.momScore],
    ['Google 评分（权重 25%）', c.googleScore],
    ['Retention（权重 20%）', c.retentionScore],
    ['Transfer（权重 15%）', c.transferScore],
    ['规模与经验（权重 10%）', c.scaleScore],
  ].map(([label, v]) => {
    const val = v != null ? Math.round(v) : '—';
    const w = v != null ? Math.round(Math.max(0, Math.min(100, v))) : 0;
    return `<tr><td>${label}</td><td class="num">${val}</td><td><div class="bar"><div class="bar-fill" style="width:${w}%"></div></div></td></tr>`;
  }).join('');
  return `
  <h2>📊 综合评分</h2>
  <p class="desc">综合分 <b>${s.total != null ? s.total.toFixed(1) : '—'}</b>，模型：MOM 官方 30% + Google 25% + Retention 20% + Transfer 15% + 规模经验 10%。</p>
  <table class="mini">
    <tr><th>指标</th><th>得分</th><th>雷达</th></tr>
    ${rows}
  </table>`;
}

function feesSection(n) {
  const f = n.fees || {};
  const items = (f.items || []).map(it => `
    <tr><td>${esc(it.service)}</td><td class="num"><b>${esc(it.price)}</b></td><td class="src">${esc(it.source)}</td></tr>`).join('');
  return `
  <h2>💰 收费模式</h2>
  ${f.summary ? `<p class="desc">${esc(f.summary)}</p>` : ''}
  <table class="mini">
    <tr><th>服务项</th><th>费用</th><th>来源</th></tr>
    ${items || '<tr><td colspan="3" class="muted">暂无数据</td></tr>'}
  </table>
  ${f.notes ? `<p class="footnote">📌 ${esc(f.notes)}</p>` : ''}`;
}

function swSection(n) {
  const s = n.strengths || [];
  const w = n.weaknesses || [];
  return `
  <h2>⚖️ 优势与劣势</h2>
  <div class="sw">
    <div class="sw-col ok">
      <h3>✅ 优势</h3>
      <ul>${s.map(x => `<li>${esc(x)}</li>`).join('') || '<li class="muted">暂无数据</li>'}</ul>
    </div>
    <div class="sw-col bad">
      <h3>⚠️ 劣势 / 顾虑</h3>
      <ul>${w.map(x => `<li>${esc(x)}</li>`).join('') || '<li class="muted">暂无数据</li>'}</ul>
    </div>
  </div>`;
}

function casesSection(n) {
  const cs = n.cases || [];
  return `
  <h2>📁 实际案例</h2>
  ${cs.length ? `<ul class="cases">${cs.map(c => `<li>${esc(c.case)}<span class="src">来源：${esc(c.source)}</span></li>`).join('')}</ul>`
    : '<p class="muted">暂无公开案例。</p>'}`;
}

function reviewsSection(id) {
  const rs = reviewsById[id] || [];
  if (!rs.length) {
    return `<h2>💬 客户真实评论</h2><p class="muted">Google 评论抓取未成功（可能受页面结构限制），暂无评论内容。</p>`;
  }
  const items = rs.map(r => `
    <div class="review">
      <div class="rv-head">
        <span class="rv-author">${esc(r.author || '匿名')}</span>
        <span class="rv-stars">${starStr(r.rating)}</span>
        <span class="rv-date">${esc(r.date || '')}</span>
      </div>
      <p class="rv-text">${esc(r.text)}</p>
    </div>`).join('');
  return `
  <h2>💬 客户真实评论（Google）</h2>
  <p class="desc">以下为 2026-08-22 抓取的 Google Maps 评论原文，仅做排版整理，未做任何删改。评论仅代表个人观点。</p>
  <div class="review-list">${items}</div>`;
}

function momSection(s) {
  const m = s.momData || {};
  const rows = [
    ['MOM 官方评分', m.momRating != null ? `${m.momRating}（${m.momReviews} 条评论）` : '—'],
    ['Retention（续任率）', pct(m.retention)],
    ['Transfer（转手率）', pct(m.transfer)],
    ['派工量（12 个月）', m.placement ?? '—'],
    ['经营年限', m.experienceYears != null ? m.experienceYears + ' 年' : '—'],
    ['牌照号', `${esc(m.license || '—')}（状态核实 ${m.licenseVerified ? '✅' : '待核实'}）`],
    ['官方注册名', esc(m.officialName || '—')],
  ].map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  return `
  <h2>🏛️ MOM 官方指标（EA Directory）</h2>
  <p class="desc">数据抓取自 MOM Employment Agency Directory（2026-08-22）。行业基准：Retention 均值 ${scores.benchmarks.retentionAvg}%、Transfer 均值 ${scores.benchmarks.transferAvg}%。</p>
  <table class="mini">
    <tr><th>指标</th><th>数值</th></tr>
    ${rows}
  </table>`;
}

function contactSection(id) {
  const a = byId[id] || {};
  const m = (scores.scores.find(x => x.id === id) || {}).momData || {};
  const items = [
    a.url ? `<li>官网：<a href="${esc(a.url)}" target="_blank">${esc(a.url)}</a></li>` : '',
    a.address ? `<li>地址：${esc(a.address)}</li>` : '',
    m.license ? `<li>MOM 牌照：${esc(m.license)}</li>` : '',
  ].join('');
  return `<h2>📞 联系与核实</h2><ul class="cases">${items || '<li class="muted">暂无联系方式</li>'}<li class="muted">⚠️ 费用与条款以线下咨询为准；请通过 MOM 官网核验牌照与评分。</li></ul>`;
}

// 生成每家中介研报
const reportPages = top.map((s, idx) => {
  const n = notes[s.id] || {};
  const a = byId[s.id] || {};
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(a.name)} 中介研报 · sg-helper</title>
<style>
  :root { --ink:#1f2937; --muted:#6b7280; --line:#e5e7eb; --accent:#2563eb; --ok:#15803d; --bad:#b91c1c; --bg:#f9fafb; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif; color:var(--ink); background:var(--bg); padding:32px 20px; }
  .wrap { max-width:860px; margin:0 auto; }
  .bread { font-size:12px; color:var(--muted); margin-bottom:14px; }
  .bread a { color:var(--accent); text-decoration:none; }
  h1 { font-size:26px; margin-bottom:4px; }
  .sub { color:var(--muted); font-size:13px; margin-bottom:20px; }
  h2 { font-size:18px; margin:28px 0 10px; padding-bottom:6px; border-bottom:2px solid var(--line); }
  .desc { font-size:13px; color:var(--muted); margin-bottom:12px; line-height:1.7; }
  .desc b { color:var(--ink); }
  .footnote { font-size:12px; color:var(--muted); background:#fff; border:1px solid var(--line); border-radius:8px; padding:10px 14px; margin-top:12px; line-height:1.8; }
  table.mini { width:100%; border-collapse:collapse; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.06); }
  table.mini th, table.mini td { padding:8px 12px; border-bottom:1px solid var(--line); text-align:left; font-size:13px; }
  table.mini th { background:#f3f4f6; font-size:12px; color:var(--muted); }
  .num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .src { font-size:11px; color:var(--muted); }
  .bar { width:110px; height:8px; background:#e5e7eb; border-radius:99px; overflow:hidden; }
  .bar-fill { height:100%; background:var(--accent); border-radius:99px; }
  .hero { background:#fff; border:1px solid var(--line); border-radius:12px; padding:20px; margin-bottom:6px; }
  .hero .big { font-size:40px; font-weight:800; color:var(--accent); }
  .hero .meta { display:flex; flex-wrap:wrap; gap:8px 24px; margin-top:10px; font-size:13px; }
  .hero .meta b { color:var(--ink); }
  .hero .tag { display:inline-block; font-size:11px; padding:2px 8px; border-radius:99px; background:#eff6ff; color:var(--accent); margin-right:6px; }
  .sw { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  @media (max-width:640px) { .sw { grid-template-columns:1fr; } }
  .sw-col { background:#fff; border:1px solid var(--line); border-radius:10px; padding:16px; }
  .sw-col h3 { font-size:14px; margin-bottom:10px; }
  .sw-col.ok h3 { color:var(--ok); }
  .sw-col.bad h3 { color:var(--bad); }
  .sw-col ul { padding-left:18px; font-size:13px; line-height:1.9; }
  ul.cases { padding-left:18px; font-size:13px; line-height:1.9; }
  ul.cases li { margin-bottom:8px; }
  ul.cases .src { display:block; font-size:11px; color:var(--muted); }
  .review-list { display:flex; flex-direction:column; gap:10px; }
  .review { background:#fff; border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
  .rv-head { display:flex; align-items:center; gap:10px; margin-bottom:6px; font-size:12px; }
  .rv-author { font-weight:600; color:var(--ink); }
  .rv-stars { color:#f59e0b; letter-spacing:1px; }
  .rv-date { color:var(--muted); }
  .rv-text { font-size:13px; line-height:1.8; color:#374151; }
  a { color:var(--accent); text-decoration:none; }
  a:hover { text-decoration:underline; }
  .muted { color:var(--muted); }
</style>
</head>
<body>
<div class="wrap">
  <div class="bread"><a href="./index.html">← 研报索引</a> ｜ <a href="../index.html">中介对比</a></div>
  <div class="hero">
    <h1>${rankMedal(idx)} ${esc(a.name)}</h1>
    <p class="sub">${esc((s.momData || {}).officialName || '')} · MOM 牌照 ${esc((s.momData || {}).license || '—')}</p>
    <div class="big">${s.total != null ? s.total.toFixed(1) : '—'}</div>
    <p class="desc" style="margin-top:2px;">综合评分（第 ${idx + 1} 名 / ${top.length}）</p>
    <div class="meta">
      <span><b>MOM 评分</b> ${(s.momData || {}).momRating ?? '—'} / ${(s.momData || {}).momReviews ?? '—'} 评</span>
      <span><b>Google</b> ${s.google ?? '—'} / ${a.rating?.googleCount ?? '—'} 评</span>
      <span><b>Retention</b> ${pct((s.momData || {}).retention)}</span>
      <span><b>Transfer</b> ${pct((s.momData || {}).transfer)}</span>
    </div>
  </div>

  ${scoreSection(s)}
  ${feesSection(n)}
  ${swSection(n)}
  ${casesSection(n)}
  ${reviewsSection(s.id)}
  ${momSection(s)}
  ${contactSection(s.id)}

  <p style="margin-top:28px;color:var(--muted);font-size:12px;">⚠️ 本研报由脚本生成，数据仅供研究参考。信息截至 2026-08-22；费用、置换条款等以各家中介当前正式报价为准，请通过 MOM 官网（mom.gov.sg）独立核验中介牌照与评分。评论内容来自公开渠道，仅代表评论者个人观点。</p>
</div>
</body>
</html>`;
});

// 索引页
const rows = top.map((s, idx) => {
  const a = byId[s.id] || {};
  const n = notes[s.id] || {};
  const rv = reviewsById[s.id] || [];
  return `
  <tr>
    <td>${rankMedal(idx)}</td>
    <td><a href="${s.id}.html"><b>${esc(a.name)}</b></a><div class="src">${esc((s.momData || {}).officialName || '')}</div></td>
    <td class="num">${s.total != null ? s.total.toFixed(1) : '—'}</td>
    <td class="num">${(s.momData || {}).momRating ?? '—'}</td>
    <td class="num">${s.google ?? '—'}</td>
    <td class="num">${pct((s.momData || {}).retention)}</td>
    <td class="num">${pct((s.momData || {}).transfer)}</td>
    <td class="num">${rv.length ? rv.length + ' 条' : '—'}</td>
  </tr>`;
}).join('');

const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>中介研报索引 · sg-helper</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif; color:#1f2937; background:#f9fafb; padding:32px 20px; }
  .wrap { max-width:900px; margin:0 auto; }
  h1 { font-size:26px; margin-bottom:6px; }
  .sub { color:#6b7280; font-size:13px; margin-bottom:22px; line-height:1.7; }
  table { width:100%; border-collapse:collapse; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.06); }
  th, td { padding:10px 12px; border-bottom:1px solid #e5e7eb; text-align:left; vertical-align:middle; }
  th { font-size:12px; color:#6b7280; background:#f3f4f6; }
  td.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .src { font-size:11px; color:#6b7280; }
  a { color:#2563eb; text-decoration:none; }
  a:hover { text-decoration:underline; }
  .muted { color:#6b7280; font-size:12px; margin-top:20px; line-height:1.7; }
</style>
</head>
<body>
<div class="wrap">
  <h1>📚 中介研报（Top ${top.length}）</h1>
  <p class="sub">按综合评分排序生成 2026-08-22。每份研报含：收费模式、优势劣势、实际案例、客户真实评论（Google）、MOM 官方指标。<br>数据来源：MOM EA Directory、Google Maps、各中介官网、公开报道。详情见各研报底部免责声明。</p>
  <table>
    <thead><tr><th>#</th><th>中介</th><th>综合分</th><th>MOM</th><th>Google</th><th>Retention</th><th>Transfer</th><th>评论样本</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="muted">⚠️ 研究参考用途，非正式评级。费用/置换条款以线下咨询为准。请通过 MOM 官网核验中介牌照与评分。</p>
</div>
</body>
</html>`;

// 写文件
const outDir = path.join(ROOT, 'agencies', 'reports');
fs.mkdirSync(outDir, { recursive: true });
for (let i = 0; i < top.length; i++) {
  fs.writeFileSync(path.join(outDir, top[i].id + '.html'), reportPages[i]);
}
fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml);
console.log(`已生成 agencies/reports/index.html + ${top.length} 份研报`);
