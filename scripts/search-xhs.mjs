#!/usr/bin/env node
// 小红书搜索结果收集脚本（rednote.com 国际版）
// 前置：CDP proxy 已连接，且小红书已登录（rednote.com 域有登录态）
// 用法：node scripts/search-xhs.mjs <targetId>
// 遍历关键词，收集搜索结果（noteId/标题/作者/日期/点赞）
// 输出：data/agencies/raw/xhs-search.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROXY = 'http://localhost:3456';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const target = process.argv[2];
if (!target) { console.error('需要 targetId 参数'); process.exit(1); }

const KEYWORDS = [
  '新加坡 女佣中介 推荐',
  '新加坡 女佣中介 避雷',
  '新加坡 女佣中介 哪家好',
  '新加坡 女佣中介 红黑榜',
  '新加坡 女佣 中介 真实评价',
  '新加坡 请女佣 经验',
  '新加坡 女佣 中介 靠谱',
  '新加坡 女佣中介 收费',
];

async function evalJs(js) {
  const res = await fetch(`${PROXY}/eval?target=${encodeURIComponent(target)}`, { method: 'POST', body: js });
  const data = await res.json();
  return data.value;
}

async function navigate(url) {
  await fetch(`${PROXY}/navigate?target=${encodeURIComponent(target)}`, { method: 'POST', body: url });
  await sleep(6000);
}

const EXTRACT_JS = `
(() => {
  const cards = [...document.querySelectorAll("section")].filter(s => s.querySelector("img"));
  return cards.map(s => {
    let a = s.querySelector("a[href*=search_result]");
    if (!a) { let p = s.parentElement; for (let i=0;i<4&&p;i++){ a=p.querySelector("a[href*=search_result]"); if(a)break; p=p.parentElement; } }
    const lines = s.innerText.split("\\n").map(l=>l.trim()).filter(Boolean);
    const date = lines.find(l => /20\\d{2}|\\d{2}-\\d{2}|天前|周前|月前/.test(l)) || "";
    const likes = lines.find(l => /^(\\d+|\\.{3})$/.test(l) || l === "赞") || "";
    return {
      noteId: a ? a.href.split("/").pop() : null,
      title: lines[0] || "",
      author: lines[1] || "",
      date: date,
      likes: likes
    };
  });
})()`;

async function main() {
  const results = { fetchedAt: new Date().toISOString().slice(0, 10), keywords: [] };

  for (const kw of KEYWORDS) {
    process.stdout.write(`关键词: ${kw} ... `);
    try {
      const url = 'https://www.rednote.com/search_result?keyword=' + encodeURIComponent(kw);
      await navigate(url);
      const cards = await evalJs(EXTRACT_JS);
      const valid = Array.isArray(cards) ? cards.filter(c => c.noteId) : [];
      results.keywords.push({ keyword: kw, notes: valid });
      console.log(`${valid.length} 篇`);
    } catch (e) {
      console.log('错误', e.message);
      results.keywords.push({ keyword: kw, error: e.message });
    }
    await sleep(800);
  }

  fs.writeFileSync(path.join(ROOT, 'data/agencies/raw/xhs-search.json'), JSON.stringify(results, null, 2));
  console.log(`\n已写入 data/agencies/raw/xhs-search.json，共 ${results.keywords.length} 个关键词`);
}

await main();
