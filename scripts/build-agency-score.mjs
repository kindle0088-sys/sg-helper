#!/usr/bin/env node
// 中介综合评分脚本（阶段 4）
// 评分模型（透明、可解释）：
//   综合分 = MOM官方评分30% + Google评分25% + Retention20% + Transfer15% + 规模经验10%
// 指标归一化（0-100）：
//   momScore     = momRating / 5 * 100
//   googleScore  = google / 5 * 100
//   retention    = min(100, retention% / 70 * 100)      # 70% 视为满分
//   transfer     = max(0, 100 - transfer% / 4 * 100)    # 0% 得 100，4% 得 0
//   scaleScore   = 50%*min(100, log10(placement)/log10(3000)*100) + 50%*min(100, expYears/40*100)
// 行业基准（MOM EA Directory, 2026-08-16~2026-08-17）: retention 均值 62.43%, transfer 均值 1.05%
// 输出：data/agency-scores.json + agencies.json 每家的 score 字段

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/agencies.json'), 'utf8'));

const WEIGHTS = { mom: 0.30, google: 0.25, retention: 0.20, transfer: 0.15, scale: 0.10 };
const cap = (v, max = 100) => Math.min(max, Math.max(0, v));
const round = (v) => Math.round(v * 10) / 10;

function calc(agency) {
  const m = agency.momData;
  if (!m) return null;
  const g = agency.rating?.google;

  const momScore = m.momRating != null ? cap(m.momRating / 5 * 100) : null;
  const googleScore = g != null ? cap(g / 5 * 100) : null;
  const retentionScore = m.retention != null ? cap(m.retention / 70 * 100) : null;
  const transferScore = m.transfer != null ? cap(100 - m.transfer / 4 * 100) : null;
  const scaleScore = m.placement != null || m.experienceYears != null
    ? cap((m.placement != null ? Math.log10(m.placement) / Math.log10(3000) * 100 : 0) * 0.5
        + (m.experienceYears != null ? m.experienceYears / 40 * 100 : 0) * 0.5)
    : null;

  // 只对有至少 mom + google 两维的中介计总分
  const present = { momScore, googleScore, retentionScore, transferScore, scaleScore };
  const have = Object.entries(present).filter(([, v]) => v != null).map(([k]) => k);
  const haveKey = {
    momScore: 'mom', googleScore: 'google', retentionScore: 'retention',
    transferScore: 'transfer', scaleScore: 'scale',
  };

  let total = null;
  if (momScore != null && googleScore != null) {
    let sum = 0, wSum = 0;
    for (const k of have) { const w = WEIGHTS[haveKey[k]]; sum += present[k] * w; wSum += w; }
    total = round(sum / wSum);
  }

  return {
    components: { momScore, googleScore, retentionScore, transferScore, scaleScore },
    total,
    note: m.demeritPoints && m.demeritPoints > 0 ? `⚠️ MOM 记点 ${m.demeritPoints}` : null,
  };
}

const scores = [];
for (const agency of data.agencies) {
  const s = calc(agency);
  if (!s) continue;
  agency.score = s;
  scores.push({
    id: agency.id,
    name: agency.name,
    total: s.total,
    components: s.components,
    momData: agency.momData,
    google: agency.rating?.google,
    note: s.note,
  });
}

scores.sort((a, b) => (b.total ?? -1) - (a.total ?? -1));

fs.writeFileSync(path.join(ROOT, 'data/agency-scores.json'), JSON.stringify({
  generatedAt: new Date().toISOString().slice(0, 10),
  weights: WEIGHTS,
  benchmarks: { retentionAvg: 62.43, transferAvg: 1.05, placementAvg: 48 },
  scores,
}, null, 2));

fs.writeFileSync(path.join(ROOT, 'data/agencies.json'), JSON.stringify(data, null, 2));

console.log('综合评分完成（含 total 的中介）：');
for (const s of scores) {
  console.log(`  ${String(s.total).padStart(5)} ${s.id.padEnd(22)} ${s.name}`);
}
