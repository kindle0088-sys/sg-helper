// Google Maps 评论批量抓取 v2（CDP 临时脚本）
// 兼容：搜索结果页（列表）与直接跳到详情页两种情况
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROXY = 'http://localhost:3456';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const KEYWORD_MAP = {
  'nation-employment': ['Nation Maid Agency', 'Nation'],
  'universal-employment': ['Universal Employment Agency', 'Universal'],
  'status-maids': ['Status Maids', 'Status'],
  'jforce': ['JForce', 'JForce'],
  'green-employment': ['Green Employment', 'Green'],
  'gentlehelp': ['GentleHelp', 'GentleHelp'],
  'goodhire': ['Goodhire', 'Goodhire'],
  'ministry-of-helpers': ['Ministry of Helpers', 'Ministry of Helpers'],
  'eden-grace': ['Eden Grace', 'Eden Grace'],
  'helper-express': ['Helper Express', 'Helper Express'],
};

async function evalJs(target, js) {
  const res = await fetch(PROXY + '/eval?target=' + encodeURIComponent(target), { method: 'POST', body: js });
  return (await res.json()).value;
}
async function navigate(target, url) {
  await fetch(PROXY + '/navigate?target=' + encodeURIComponent(target), { method: 'POST', body: url });
  await sleep(9000);
}

const res = await fetch(PROXY + '/new', { method: 'POST', body: 'about:blank' });
const target = (await res.json()).targetId;
console.error('target:', target);

const out = { fetchedAt: new Date().toISOString().slice(0, 10), agencies: [] };

for (const [id, kws] of Object.entries(KEYWORD_MAP)) {
  process.stdout.write(id + ' ... ');
  try {
    await navigate(target, 'https://www.google.com/maps/search/' + encodeURIComponent(kws[0] + ' Singapore') + '/');
    // 检测是否已在详情页
    const state = await evalJs(target, `(() => {
      const u = location.href;
      const isDetail = u.includes('/maps/place/') && !u.includes('/maps/search/');
      if (isDetail) return { detail: true, href: u };
      const kw = ${JSON.stringify(kws[1])};
      const links = [...document.querySelectorAll('a[href*="/maps/place/"]')]
        .filter(a => (a.innerText || '').toUpperCase().includes(kw.toUpperCase()));
      if (!links.length) return { detail: false, links: [] };
      const a = links[0];
      return { detail: false, links: [{ href: a.href, txt: (a.innerText || '').replace(/\\n+/g, ' ').trim().slice(0, 60) }] };
    })()`);
    let placeUrl = null;
    let alreadyHere = false;
    if (state.detail) {
      placeUrl = state.href;
      alreadyHere = true; // 已在详情页，无需重新 navigate
    } else if (state.links && state.links.length) {
      placeUrl = state.links[0].href;
    }
    if (!placeUrl) { out.agencies.push({ id, error: '未找到匹配商家' }); console.log('未找到'); continue; }
    // 清理 URL：去掉坐标参数（保留 /maps/place/NAME/@ 之前的部分）
    const m = placeUrl.match(/^(https:\/\/www\.google\.com\/maps\/place\/[^@]+)/);
    if (m) placeUrl = m[1];
    if (!alreadyHere) {
      await navigate(target, placeUrl);
    } else {
      await sleep(2000);
    }
    // 点评价 tab
    await evalJs(target, `(() => {
      const t = [...document.querySelectorAll('[role="tab"], button')].find(b => /(评价|Reviews)/.test(b.innerText || ''));
      if (t) t.click();
    })()`);
    await sleep(4000);
    for (let i = 0; i < 7; i++) {
      await fetch(PROXY + '/scroll?target=' + encodeURIComponent(target) + '&y=4000', { method: 'POST' });
      await sleep(2000);
    }
    const reviews = await evalJs(target, `(() => {
      const cards = [...document.querySelectorAll('.jftiEf')];
      const out = [];
      for (const c of cards) {
        const author = (c.querySelector('.d4r55') || {}).innerText || c.getAttribute('aria-label') || '';
        const rEl = c.querySelector('[role="img"][aria-label*="星"], [role="img"][aria-label*="/"], span[aria-label*="星"]');
        const rating = rEl ? ((rEl.getAttribute('aria-label') || '').match(/(\\d\\.?\\d*)\\s*(星|\\/\\s*5)/) || [])[1] || null : null;
        const date = (c.querySelector('.x7W5Lb, .pYbT2c, .fQ9ohc') || {}).innerText || '';
        const text = (c.querySelector('.wiI7pd, .MyEned, .z3F9be, .xnN2Lb') || {}).innerText || '';
        if (text) out.push({ author: author.slice(0, 40), rating: rating ? parseFloat(rating) : null, date: date.slice(0, 30), text: text.slice(0, 600) });
      }
      return out.slice(0, 15);
    })()`);
    out.agencies.push({ id, url: placeUrl, reviews });
    console.log(reviews.length + ' 条评论');
  } catch (e) {
    out.agencies.push({ id, error: e.message });
    console.log('ERR', e.message);
  }
  await sleep(2000);
}

fs.writeFileSync(path.join(ROOT, 'data/agencies/raw/google-reviews.json'), JSON.stringify(out, null, 2));
console.log('\n已写入 data/agencies/raw/google-reviews.json');
process.exit(0);
