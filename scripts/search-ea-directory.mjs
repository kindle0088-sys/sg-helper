#!/usr/bin/env node
// EA Directory 中介数据抓取脚本
// 前置：CDP proxy 已连接 Chrome，且 EA Directory 已打开（目标 tab）
// 用法：node scripts/search-ea-directory.mjs <targetId> [agencyName ...]
//   - 不传 agencyName 则读 data/agencies.json 中所有 license 存在的条目逐个搜索
// 输出：data/agencies/raw/ea-directory.json（含每家搜索结果卡片数据）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROXY = 'http://localhost:3456';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const targetId = process.argv[2];
if (!targetId) { console.error('需要 targetId 参数'); process.exit(1); }

async function evalJs(target, js) {
  const res = await fetch(`${PROXY}/eval?target=${encodeURIComponent(target)}`, { method: 'POST', body: js });
  const data = await res.json();
  return data.value;
}

async function click(target, selector) {
  const res = await fetch(`${PROXY}/click?target=${encodeURIComponent(target)}`, { method: 'POST', body: selector });
  return res.json();
}

async function searchAgency(target, name) {
  // 动态查找可见的搜索输入框与按钮（表单 ID 随视图变化：eadHomeForm / eadAllAgenciesForm）
  const inpSel = await evalJs(target, `
    (() => {
      const inp = [...document.querySelectorAll("input[id*=searchEaNameFilter]")].find(e => e.offsetWidth || e.offsetHeight);
      if (!inp) return null;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(inp, ${JSON.stringify(name)});
      inp.dispatchEvent(new Event("input", {bubbles:true}));
      inp.dispatchEvent(new Event("change", {bubbles:true}));
      return inp.id;
    })()
  `);
  if (!inpSel) { console.error('搜索输入框未找到'); return ''; }
  await sleep(400);
  const btnSel = await evalJs(target, `
    (() => {
      const btn = [...document.querySelectorAll("button[id*=searchEaNameFilterBtn], input[id*=searchEaNameFilterBtn]")].find(e => e.offsetWidth || e.offsetHeight);
      return btn ? btn.id : null;
    })()
  `);
  if (btnSel) await click(target, `#${btnSel.replace(/:/g, '\\:')}`);
  await sleep(2800);
  // 提取结果卡片文本
  return evalJs(target, 'document.body.innerText');
}

function parseResults(text) {
  // 结果卡片模式：NAME (LICNO)\n(rating - N Reviews)\nRetention...Transfer...Placement...Experience
  const cards = [];
  const re = /([A-Z0-9 &'.\(\)\-\/]{6,}?)\s*\((\d{2}[A-Z]\d{4})\)\s*(?:\n|$)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].trim();
    const lic = m[2];
    const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 600);
    const rating = (tail.match(/\((\d\.?\d*)\s*-\s*(\d+)\s*Reviews\)/) || [])[1] || null;
    const reviews = (tail.match(/\((\d\.?\d*)\s*-\s*(\d+)\s*Reviews\)/) || [])[2] || null;
    const retention = (tail.match(/(\d+(?:\.\d+)?)%\s*\n?\s*Retention Rate/) || [])[1] || null;
    const transfer = (tail.match(/(\d+(?:\.\d+)?)%\s*\n?\s*Transfer Rate/) || [])[1] || null;
    const placement = (tail.match(/(\d+)\s*\n?\s*Placement Vol\./i) || [])[1] || null;
    const experience = (tail.match(/(\d+)\s*yr\s*\n?\s*Experience/i) || [])[1] || null;
    cards.push({ name, license: lic, rating, reviews, retention, transfer, placement, experience });
  }
  return cards;
}

async function main() {
  const args = process.argv.slice(3);
  const outPath = path.join(ROOT, 'data/agencies/raw/ea-directory.json');
  const results = { fetchedAt: new Date().toISOString().slice(0,10), targetId, agencies: [] };

  // 未指定名称时从 agencies.json 收集候选名（含 license 作为搜索词备用）
  let names = args;
  if (!names.length) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/agencies.json'), 'utf8'));
      names = data.agencies.filter(a => a.license?.length).map(a => a.license[0]);
    } catch (e) { console.error('读取 agencies.json 失败', e.message); }
  }

  for (const q of names) {
    process.stdout.write(`搜索: ${q} ... `);
    try {
      const text = await searchAgency(process.argv[2], q);
      const cards = parseResults(text);
      results.agencies.push({ query: q, hits: cards.slice(0, 5) });
      console.log(cards.length ? `命中 ${cards.length} 家` : '无命中');
      await sleep(500);
    } catch (e) {
      console.log('错误', e.message);
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n已写入 ${outPath}`);
}

await main();
