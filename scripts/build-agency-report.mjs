#!/usr/bin/env node
// 生成中介对比报告 agencies/index.html
// 数据：data/agency-scores.json（由 build-agency-score.mjs 生成）
// 功能：中介名称搜索 + 评分表排序（纯前端 JS）
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

// 前端 JS 用数据（原始值，渲染时转义）
const data = scores.scores.map(s => {
  const a = byId[s.id] || {};
  const m = s.momData || {};
  const momTxt = m.momRating != null ? `${m.momRating} / ${m.momReviews} 评` : '—';
  const googleTxt = s.google != null ? `${s.google} / ${a.rating?.googleCount ?? '?'} 评` : '—';
  return {
    id: s.id,
    name: a.name || '',
    sub: [m.officialName, m.license].filter(Boolean).join(' · '),
    note: s.note || null,
    total: s.total != null ? +s.total.toFixed(1) : null,
    mom: m.momRating ?? null,
    momTxt,
    google: s.google ?? null,
    googleTxt,
    retention: m.retention ?? null,
    transfer: m.transfer ?? null,
    placement: m.placement ?? null,
    exp: m.experienceYears ?? null,
    url: a.url || '',
  };
});

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
  .toolbar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin-bottom:14px; }
  .search-box { position:relative; flex:1; min-width:220px; max-width:360px; }
  .search-box input { width:100%; padding:9px 14px 9px 36px; border:1px solid var(--line); border-radius:9px; font-size:14px; background:#fff; outline:none; transition:border .15s, box-shadow .15s; }
  .search-box input:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(37,99,235,.12); }
  .search-box .ic { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--muted); font-size:14px; pointer-events:none; }
  .search-box .clear { position:absolute; right:8px; top:50%; transform:translateY(-50%); border:none; background:none; color:var(--muted); cursor:pointer; font-size:14px; padding:2px 4px; border-radius:4px; }
  .search-box .clear:hover { background:#f3f4f6; color:var(--ink); }
  .result-count { font-size:12px; color:var(--muted); white-space:nowrap; }
  table { width:100%; border-collapse:collapse; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.06); }
  th, td { padding:10px 12px; border-bottom:1px solid var(--line); text-align:left; vertical-align:middle; }
  th { font-size:12px; color:var(--muted); font-weight:600; background:#f3f4f6; }
  th.sortable { cursor:pointer; user-select:none; white-space:nowrap; }
  th.sortable:hover { color:var(--accent); }
  th.sorted { color:var(--accent); }
  th .arrow { margin-left:3px; font-size:10px; opacity:.7; }
  td.num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .rank { font-weight:700; font-size:15px; width:44px; }
  .top1 { background:#fffbeb; }
  tr.hidden, .detail.hidden { display:none; }
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
  .no-result { display:none; text-align:center; padding:24px; color:var(--muted); font-size:14px; }
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

  <div class="toolbar">
    <div class="search-box">
      <span class="ic">🔍</span>
      <input id="searchInput" type="text" placeholder="搜索中介名称 / 牌照号…" autocomplete="off">
      <button class="clear" id="clearBtn" title="清空">✕</button>
    </div>
    <span class="result-count" id="resultCount"></span>
  </div>

  <table id="mainTable">
    <thead>
      <tr>
        <th>#</th>
        <th class="sortable" data-key="name">中介<span class="arrow"></span></th>
        <th class="sortable" data-key="total">综合分<span class="arrow"></span></th>
        <th class="sortable" data-key="mom">MOM 评分<span class="arrow"></span></th>
        <th class="sortable" data-key="google">Google<span class="arrow"></span></th>
        <th class="sortable" data-key="retention">Retention<span class="arrow"></span></th>
        <th class="sortable" data-key="transfer">Transfer<span class="arrow"></span></th>
        <th class="sortable" data-key="placement">派工量<span class="arrow"></span></th>
        <th class="sortable" data-key="exp">年限<span class="arrow"></span></th>
        <th></th>
      </tr>
    </thead>
    <tbody id="tbody"></tbody>
  </table>
  <div class="no-result" id="noResult">没有匹配的中介，换个关键词试试。</div>

  <h2 style="margin-top:32px;font-size:18px;">各家中介明细</h2>
  <div id="details">
    ${detailBlocks}
  </div>

  <p style="margin-top:24px;color:var(--muted);font-size:12px;">⚠️ 本页由脚本自动生成，数据仅供研究参考。中介费、置换条款、女佣工资等以各家中介当前报价为准。MOM 数据抓取自 EA Directory（2026-08-22）。</p>
</div>

<script>
const DATA = ${JSON.stringify(data)};
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const pct = v => v != null ? v.toFixed(1) + '%' : '—';

let query = '';
let sort = { key: 'total', dir: -1 };

function matches(d) {
  if (!query) return true;
  const hay = (d.name + ' ' + d.sub + ' ' + d.id).toLowerCase();
  return hay.includes(query);
}

function cmp(a, b) {
  const k = sort.key;
  const av = a[k], bv = b[k];
  let r;
  if (typeof av === 'number' && typeof bv === 'number') {
    r = (av == null ? -Infinity : av) - (bv == null ? -Infinity : bv);
  } else {
    r = String(av ?? '').localeCompare(String(bv ?? ''), 'zh-CN');
  }
  return r * sort.dir;
}

function medal(i) { return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''; }

function rowHtml(d, rank) {
  return \`<tr class="\${rank === 1 ? 'top1' : ''}">
    <td class="rank">\${rank}\${medal(rank - 1)}</td>
    <td>
      <div class="name">\${esc(d.name)}</div>
      <div class="sub">\${esc(d.sub)}</div>
      \${d.note ? '<div class="warn">' + esc(d.note) + '</div>' : ''}
    </td>
    <td class="num score">\${d.total != null ? d.total.toFixed(1) : '—'}</td>
    <td class="num">\${esc(d.momTxt)}</td>
    <td class="num">\${esc(d.googleTxt)}</td>
    <td class="num">\${pct(d.retention)}</td>
    <td class="num">\${pct(d.transfer)}</td>
    <td class="num">\${d.placement ?? '—'}</td>
    <td class="num">\${d.exp != null ? d.exp + 'y' : '—'}</td>
    <td class="num">\${d.url ? '<a href="' + esc(d.url) + '" target="_blank">官网</a>' : ''}</td>
  </tr>\`;
}

function render() {
  const list = DATA.filter(matches).sort(cmp);
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = list.map((d, i) => rowHtml(d, i + 1)).join('');
  document.getElementById('noResult').style.display = list.length ? 'none' : 'block';
  document.getElementById('resultCount').textContent = list.length + ' / ' + DATA.length + ' 家';

  // 明细块跟随搜索过滤（排序不改变明细顺序）
  document.querySelectorAll('#details .detail').forEach(el => {
    const id = el.id.replace('d-', '');
    const keep = !query || DATA.some(d => d.id === id && matches(d));
    el.classList.toggle('hidden', !keep);
  });

  // 排序指示
  document.querySelectorAll('th.sortable').forEach(th => {
    const active = th.dataset.key === sort.key;
    th.classList.toggle('sorted', active);
    const arrow = th.querySelector('.arrow');
    arrow.textContent = active ? (sort.dir === -1 ? '▼' : '▲') : '';
  });
}

document.getElementById('searchInput').addEventListener('input', e => {
  query = e.target.value.trim().toLowerCase();
  render();
});
document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('searchInput').value = '';
  query = '';
  render();
});
document.querySelectorAll('th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const k = th.dataset.key;
    if (sort.key === k) {
      sort.dir *= -1;
    } else {
      sort.key = k;
      sort.dir = (k === 'name') ? 1 : -1; // 文本列默认升序，数值列默认降序
    }
    render();
  });
});

render();
</script>
</body>
</html>`;

const outDir = path.join(ROOT, 'agencies');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log('已生成 agencies/index.html');
