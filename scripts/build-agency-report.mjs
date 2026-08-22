#!/usr/bin/env node
// 生成中介对比报告 agencies/index.html
// 数据：data/agency-scores.json（由 build-agency-score.mjs 生成）
// 用法：node scripts/build-agency-report.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scores = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/agency-scores.json'), 'utf8'));
const agencies = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/agencies.json'), 'utf8')).agencies;
const byId = Object.fromEntries(agencies.map(a => [a.id, a]));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (v) => (v != null ? v.toFixed(1) + '%' : '—');

function bar(v, max = 100, color = '#2563eb') {
  const w = Math.max(0, Math.min(100, (v / max) * 100));
  return `<div class="bar"><div class="bar-fill" style="width:${w}%;background:${color}"></div></div>`;
}

function componentRow(label, score) {
  const v = score != null ? score : 0;
  const isNull = score == null;
  return `
    <tr>
      <td>${label}</td>
      <td class="num">${isNull ? '—' : v.toFixed(0)}</td>
      <td>${isNull ? '—' : bar(v)}</td>
    </tr>`;
}

const rows = scores.scores.map((s, i) => {
  const a = byId[s.id] || {};
  const m = s.momData || {};
  const c = s.components || {};
  const rank = i + 1;
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
  return `
  <tr class="${rank === 1 ? 'top1' : ''}">
    <td class="rank">${rank}${medal}</td>
    <td>
      <div class="name">${esc(a.name)}</div>
      <div class="sub">${esc(m.officialName || '')} · ${esc(m.license || '')}</div>
      ${s.note ? `<div class="warn">${esc(s.note)}</div>` : ''}
    </td>
    <td class="num score">${s.total != null ? s.total.toFixed(1) : '—'}</td>
    <td class="num">${c.momScore != null ? (m.momRating + ' / ' + m.momReviews + ' 评') : '—'}</td>
    <td class="num">${c.googleScore != null ? (s.google + ' / ' + (a.rating?.googleCount ?? '?') + ' 评') : '—'}</td>
    <td class="num">${m.retention != null ? pct(m.retention) : '—'}</td>
    <td class="num">${m.transfer != null ? pct(m.transfer) : '—'}</td>
    <td class="num">${m.placement ?? '—'}</td>
    <td class="num">${m.experienceYears ?? '—'}y</td>
    <td class="num"><a href="${esc(a.url)}" target="_blank">官网</a></td>
  </tr>`;
}).join('');

const detailBlocks = scores.scores.map(s => {
  const a = byId[s.id] || {};
  const m = s.momData || {};
  const c = s.components || {};
  const srv = (a.services || []).join(' · ');
  const notes = [
    a.notes ? `<li>${esc(a.notes)}</li>` : '',
    a.pros?.length ? `<li><b>优势：</b>${esc(a.pros.join('；'))}</li>` : '',
    a.cons?.length ? `<li><b>顾虑：</b>${esc(a.cons.join('；'))}</li>` : '',
    a.replacementPolicy ? `<li><b>置换政策：</b>${esc(a.replacementPolicy)}</li>` : '',
    a.googleBranches ? `<li><b>分店评分：</b>${esc(a.googleBranches)}</li>` : '',
  ].join('');
  return `
  <div class="detail" id="d-${s.id}">
    <h3>${esc(a.name)}</h3>
    <p class="muted">${esc(m.officialName || '')} · MOM 牌照 ${esc(m.license || '')}</p>
    <table class="mini">
      ${componentRow('MOM 官方评分', c.momScore)}
      ${componentRow('Google 评分', c.googleScore)}
      ${componentRow('Retention', c.retentionScore)}
      ${componentRow('Transfer', c.transferScore)}
      ${componentRow('规模与经验', c.scaleScore)}
      <tr><td>综合分</td><td class="num">${s.total != null ? s.total.toFixed(1) : '—'}</td><td></td></tr>
    </table>
    ${notes ? `<ul class="notes">${notes}</ul>` : ''}
  </div>`;
}).join('');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>中介对比 · sg-helper</title>
<style>
  :root { --ink:#1f2937; --muted:#6b7280; --line:#e5e7eb; --accent:#2563eb; --gold:#b45309; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif; color:var(--ink); background:#f9fafb; padding:32px 20px; }
  .wrap { max-width:1100px; margin:0 auto; }
  h1 { font-size:26px; margin-bottom:6px; }
  .sub { color:var(--muted); font-size:13px; margin-bottom:24px; line-height:1.7; }
  .legend { font-size:12px; color:var(--muted); background:#fff; border:1px solid var(--line); border-radius:8px; padding:12px 16px; margin-bottom:20px; line-height:1.8; }
  .legend b { color:var(--ink); }
  table { width:100%; border-collapse:collapse; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.06); }
  th, td { padding:10px 12px; border-bottom:1px solid var(--line); text-align:left; vertical-align:middle; }
  th { font-size:12px; color:var(--muted); font-weight:600; background:#f3f4f6; }
  td.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .rank { font-weight:700; font-size:15px; width:44px; }
  .top1 { background:#fffbeb; }
  .name { font-weight:600; }
  .sub { font-size:11px; color:var(--muted); }
  .warn { font-size:11px; color:#b91c1c; margin-top:2px; }
  .score { font-size:18px; font-weight:800; color:var(--accent); }
  .bar { width:110px; height:8px; background:#e5e7eb; border-radius:99px; overflow:hidden; }
  .bar-fill { height:100%; border-radius:99px; }
  .detail { background:#fff; border:1px solid var(--line); border-radius:10px; padding:20px; margin-top:16px; }
  .detail h3 { font-size:16px; margin-bottom:4px; }
  .detail .muted { font-size:12px; color:var(--muted); margin-bottom:12px; }
  .detail table.mini { box-shadow:none; border:1px solid var(--line); }
  .detail table.mini td { padding:6px 12px; }
  .detail table.mini td:first-child { width:150px; color:var(--muted); font-size:13px; }
  .detail table.mini td.num { font-weight:700; }
  .notes { margin-top:12px; padding-left:18px; font-size:13px; line-height:1.8; }
  .notes li { margin-bottom:2px; }
  a { color:var(--accent); text-decoration:none; }
  a:hover { text-decoration:underline; }
</style>
</head>
<body>
<div class="wrap">
  <h1>🏢 新加坡女佣中介对比</h1>
  <p class="sub">数据日期：${scores.generatedAt} ｜ 数据来源：MOM EA Directory（官方）+ Google Maps + 小红书观察<br>行业基准（MOM 官方，2026-08-16~17）：Retention 均值 ${scores.benchmarks.retentionAvg}% ｜ Transfer 均值 ${scores.benchmarks.transferAvg}% ｜ Placement 均值 ${scores.benchmarks.placementAvg}</p>

  <div class="legend">
    <b>评分模型：</b>综合分 = MOM 官方评分 ${scores.weights.mom * 100}% + Google 评分 ${scores.weights.google * 100}% + Retention ${scores.weights.retention * 100}% + Transfer ${scores.weights.transfer * 100}% + 规模经验 ${scores.weights.scale * 100}%。
    Retention 以 70% 为满分；Transfer 以 0% 为满分（4% 记 0 分）；规模取派工量对数与经营年限的均值。
    仅供决策参考，非正式评级；中介费/置换条款等需线下确认（见各家中介备注）。
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>中介</th><th>综合分</th><th>MOM 评分</th><th>Google</th>
        <th>Retention</th><th>Transfer</th><th>派工量</th><th>年限</th><th></th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <h2 style="margin-top:32px;font-size:18px;">各家中介明细</h2>
  ${detailBlocks}

  <p style="margin-top:24px;color:var(--muted);font-size:12px;">⚠️ 本页由脚本自动生成，数据仅供研究参考。中介费、置换条款、女佣工资等以各家中介当前报价为准。MOM 数据抓取自 EA Directory（2026-08-22）。</p>
</div>
</body>
</html>`;

const outDir = path.join(ROOT, 'agencies');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log('已生成 agencies/index.html');
