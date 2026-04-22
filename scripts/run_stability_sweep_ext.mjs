import fs from 'fs';
import path from 'path';
import { demoARExperiment, computePoles } from '../src/utils/filters.js';

function parseCsvECG(text) {
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const header = lines[0].split(',').map(h=>h.trim());
  const timeIdx = header.findIndex((h) => h === 'time_sec' || h.startsWith('time_sec'));
  const rawIdx = header.findIndex((h) => h === 'ECG_I' || h.includes('ECG_I'));
  const cleanIdx = header.findIndex((h) => h === 'ECG_I_filtered' || h.includes('ECG_I_filtered'));
  const resolvedTimeIdx = timeIdx >= 0 ? timeIdx : 0;
  const resolvedRawIdx = rawIdx >= 0 ? rawIdx : 1;
  const resolvedCleanIdx = cleanIdx >= 0 ? cleanIdx : 2;
  const points = [];
  const clean = [];
  const times = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const t = Number.parseFloat(cols[resolvedTimeIdx]);
    const raw = Number.parseFloat(cols[resolvedRawIdx]);
    const ref = Number.parseFloat(cols[resolvedCleanIdx]);
    if (!Number.isFinite(t) || !Number.isFinite(raw) || !Number.isFinite(ref)) continue;
    points.push({ x: t, y: raw });
    clean.push(ref);
    times.push(t);
  }
  if (points.length < 2) return null;
  let dtSum = 0; let dtCount = 0;
  for (let i = 1; i < Math.min(times.length, 200); i++) {
    const dt = times[i] - times[i-1];
    if (dt>0 && Number.isFinite(dt)) { dtSum += dt; dtCount++; }
  }
  const fsamp = dtCount>0 ? 1/(dtSum/dtCount) : 500;
  return { points, clean, fs: fsamp };
}

async function run() {
  const csvPath = path.resolve('public','ecg200.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found:', csvPath);
    process.exit(1);
  }
  const text = fs.readFileSync(csvPath,'utf8');
  const parsed = parseCsvECG(text);
  if (!parsed) { console.error('Parse failed'); process.exit(1); }
  const rawSamples = parsed.points;
  const clean = parsed.clean;
  const inputYorig = rawSamples.map(p=>p.y);

  const orders = [2,4,6,8,12,16,20,24,32];
  const segments = [256,512,1024,2048, inputYorig.length];
  const regs = [0, 1e-12, 1e-10, 1e-8, 1e-6, 1e-4, 1e-3, 1e-2, 1e-1];
  const modes = ['biased','unbiased'];

  let allStable = [];
  let firstStable = null;

  // try with and without detrend
  for (const detrend of [false, true]) {
    const inputY = detrend ? inputYorig.map(v=>v - (inputYorig.reduce((a,b)=>a+b,0)/inputYorig.length)) : inputYorig.slice();
    for (const seg of segments) {
      const N = Math.min(seg, inputY.length, clean.length);
      const ref = clean.slice(0,N);
      const noisy = inputY.slice(0,N);
      for (const mode of modes) {
        for (const ord of orders) {
          for (const reg of regs) {
            const res = demoARExperiment({ reference: ref, noisy, arOrder: ord, estimateFromNoisy: true, fs: parsed.fs, estimatorMode: mode, regularization: reg });
            const polesInfo = computePoles(res.arCoeffs || []);
            if (polesInfo.stable) {
              const entry = { detrend, mode, order: ord, segment: N, regularization: reg, mse: res.mse };
              allStable.push(entry);
              if (!firstStable) firstStable = entry;
            }
          }
        }
      }
    }
    if (firstStable) break; // stop after first found (prefers no-detrend results first)
  }

  console.log('Extended sweep finished.');
  if (!firstStable) {
    console.log('No stable models found in extended grid.');
  } else {
    console.log('First stable model:', firstStable);
    console.log('\nAll stable entries:');
    for (const e of allStable) console.log(e);
  }
}

run().catch((e)=>{console.error(e); process.exit(1);});
