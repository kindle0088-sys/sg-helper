#!/usr/bin/env node
// Google Maps 评分抓取脚本
// 前置：CDP proxy 已连接
// 用法：node scripts/search-google-maps.mjs <targetId>
// 读取 data/agencies.json 中 momData 存在的中介，逐个在 Google Maps 搜索并提取评分
// 输出：data/agencies/raw/google-maps.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROXY = 'http://localhost:3456';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 各中介在 Google Maps 上的常用名称关键词（官方名往往与地图展示名不同）
const KEYWORD_MAP = {
  'nation-employment': 'Nation',
  'universal-employment': 'Universal Employment',
  'best-home': 'Best Home Employment',
  'homekeeper': 'Homekeeper',
  'status-maids': 'Status',
  'eden-grace': 'Eden Grace',
  'jforce': 'JForce',
  'green-employment': 'Green Employment',
  'gentlehelp': 'GentleHelp',
  'goodhire': 'Goodhire',
  'best-maid': 'Best Maid',
  'ministry-of-helpers': 'Ministry of Helpers',
  'helper-express': 'Helper Express',
};

const target = process.argv[2];
if (!target) { console.error('需要 targetId 参数'); process.exit(1); }

async function evalJs(js) {
  const res = await fetch(`${PROXY}/eval?target=${encodeURIComponent(target)}`, { method: 'POST', body: js });
  const data = await res.json();
  return data.value;
}

async function navigate(url) {
  await fetch(`${PROXY}/navigate?target=${encodeURIComponent(target)}`, { method: 'POST', body: url });
  await sleep(7500);
}

function parseRating(text) {
  // 匹配 "4.9(334)" 或 "4.9 (334)"
  const re = /(\d\.\d+)\s*\((\d[\d,]*)\)/g;
  const hits = [];
  let m;
  while ((m = re.exec(text)) !== null) hits.push({ rating: m[1], reviews: parseInt(m[2].replace(/,/g, ''), 10) });
  return hits;
}

// 按机构名关键词定位评分（避免被广告位干扰）
function findByKeyword(text, keyword) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const ratingRe = /^(\d\.\d+)\s*\((\d[\d,]*)\)/;
  const found = [];
  const upper = keyword.toUpperCase();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toUpperCase().includes(upper)) {
      // 在机构名行前后 4 行内找评分
      for (let j = Math.max(0, i - 4); j <= Math.min(lines.length - 1, i + 4); j++) {
        const mm = lines[j].match(ratingRe);
        if (mm) {
          found.push({ nameLine: lines[i].slice(0, 60), rating: mm[1], reviews: parseInt(mm[2].replace(/,/g, ''), 10) });
          break;
        }
      }
    }
  }
  return found;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/agencies.json'), 'utf8'));
  const results = { fetchedAt: new Date().toISOString().slice(0, 10), agencies: [] };

  for (const agency of data.agencies) {
    const m = agency.momData;
    if (!m) continue;
    const searchTerm = `${m.officialName} Singapore`;
    process.stdout.write(`${agency.id}: ${m.officialName} ... `);
    try {
      const url = 'https://www.google.com/maps/search/' + encodeURIComponent(searchTerm) + '/';
      await navigate(url);
      const text = await evalJs('document.body.innerText.slice(0, 5000)');
      // 关键词：优先用映射，否则取官方名中去掉通用后缀的关键词
      const keyword = KEYWORD_MAP[agency.id] || m.officialName.replace(/ PTE\.? LTD\.?|PRIVATE LIMITED|PTE LTD/gi, '').split(' ').slice(0, 3).join(' ');
      const ratings = findByKeyword(text, keyword);
      results.agencies.push({ id: agency.id, query: searchTerm, keyword, matches: ratings, snippet: text.replace(/\s+/g, ' ').slice(0, 180) });
      console.log(ratings.length ? JSON.stringify(ratings) : '未找到匹配评分');
    } catch (e) {
      console.log('错误', e.message);
      results.agencies.push({ id: agency.id, query: searchTerm, error: e.message });
    }
    await sleep(1000);
  }

  fs.writeFileSync(path.join(ROOT, 'data/agencies/raw/google-maps.json'), JSON.stringify(results, null, 2));
  console.log('\n已写入 data/agencies/raw/google-maps.json');
}

await main();
