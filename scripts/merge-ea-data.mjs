#!/usr/bin/env node
// 将 EA Directory 抓取结果合并进 agencies.json
// 用法：node scripts/merge-ea-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(ROOT, 'data/agencies.json');
const rawPath = path.join(ROOT, 'data/agencies/raw/ea-directory.json');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));

// 按 license 索引 EA Directory 数据
const byLic = {};
for (const a of raw.agencies) {
  for (const h of a.hits) byLic[h.license] = h;
}

for (const agency of data.agencies) {
  const lic = agency.license?.[0];
  if (!lic || !byLic[lic]) continue;
  const hit = byLic[lic];
  agency.momData = {
    officialName: hit.name,
    license: hit.license,
    licenseVerified: true,
    status: null,               // 待补充（EA Directory 状态/吊销记录）
    demeritPoints: null,        // 待补充
    retention: hit.retention ? parseFloat(hit.retention) : null,
    transfer: hit.transfer ? parseFloat(hit.transfer) : null,
    placement: hit.placement ? parseInt(hit.placement, 10) : null,
    experienceYears: hit.experience ? parseInt(hit.experience, 10) : null,
    momRating: hit.rating ? parseFloat(hit.rating) : null,
    momReviews: hit.reviews ? parseInt(hit.reviews, 10) : null,
    fetchedAt: raw.fetchedAt,
    source: 'MOM EA Directory',
  };
  agency.licenseVerified = true;
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log('已合并 EA Directory 数据到', dataPath);
console.log('覆盖中介数：', data.agencies.filter(a => a.momData).length, '/', data.agencies.length);
