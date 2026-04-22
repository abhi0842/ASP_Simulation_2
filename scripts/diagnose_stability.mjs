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
  const text = fs.readFileSync(csvPath,'utf8');
  const parsed = parseCsvECG(text);
  const raw = parsed.points.map(p=>p.y);
  const clean = parsed.clean;

  const combos = [
    {order:2, seg:512, reg:0, mode:'biased'},
    {order:2, seg:512, reg:1e-6, mode:'biased'},
    {order:4, seg:512, reg:0, mode:'biased'},
    {order:8, seg:512, reg:1e-6, mode:'biased'},
    {order:8, seg:1024, reg:1e-6, mode:'biased'},
    {order:16, seg:1024, reg:1e-4, mode:'biased'},
    {order:8, seg:1024, reg:1e-2, mode:'unbiased'},
  ];

  for (const c of combos) {
    const N = Math.min(c.seg, raw.length, clean.length);
    const ref = clean.slice(0,N);
    const noisy = raw.slice(0,N);
    const res = demoARExperiment({ reference: ref, noisy, arOrder: c.order, estimateFromNoisy: true, fs: parsed.fs, estimatorMode: c.mode, regularization: c.reg });
    const coeffs = res.arCoeffs || [];
    const maxCoeff = coeffs.length ? Math.max(...coeffs.map(Math.abs)) : 0;
    const poles = computePoles(coeffs).poles || [];
    const polesMag = poles.map(p=>Math.sqrt(p.re*p.re + p.im*p.im));
    console.log('--- combo', c);
    console.log('numCoeffs', coeffs.length, 'maxCoeff', maxCoeff);
    console.log('firstCoeffs', coeffs.slice(0,6).map(v=>Number(v.toFixed(6))));
    console.log('polesMag', polesMag.map(v=>Number(v.toFixed(6))).slice(0,10));
    console.log('mse', res.mse);
    console.log('\n');
  }
}

run().catch(e=>{console.error(e); process.exit(1);});
