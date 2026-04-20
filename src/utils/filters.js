function clampNumber(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function calculateMSE(reference, filtered) {
  if (!Array.isArray(reference) || !Array.isArray(filtered)) return 0;
  const n = Math.min(reference.length, filtered.length);
  if (n === 0) return 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const e = reference[i] - filtered[i];
    acc += e * e;
  }
  return acc / n;
}

export function autocorrelation(x, lagMax) {
  if (!Array.isArray(x) || x.length === 0) return [];
  const N = x.length;
  const r = new Array(lagMax + 1).fill(0);
  for (let k = 0; k <= lagMax; k++) {
    let acc = 0;
    for (let n = 0; n < N - k; n++) acc += x[n] * x[n + k];
    r[k] = acc / N;
  }
  return r;
}

export function levinsonDurbin(r, order) {
  const p = Math.max(0, Math.floor(order || 0));
  if (!Array.isArray(r) || r.length === 0) return { arCoeffs: [], reflection: [], error: 0 };
  const refl = new Array(p).fill(0);
  let error = r[0] || 0;
  if (p === 0) return { arCoeffs: [], reflection: [], error };

  let prevA = [];
  for (let m = 1; m <= p; m++) {
    let num = r[m] || 0;
    for (let k = 1; k <= m - 1; k++) num -= (prevA[k - 1] || 0) * (r[m - k] || 0);
    const lambda = error === 0 ? 0 : num / error;
    refl[m - 1] = lambda;

    const currA = new Array(m).fill(0);
    for (let k = 1; k <= m - 1; k++) {
      currA[k - 1] = (prevA[k - 1] || 0) - lambda * (prevA[m - k - 1] || 0);
    }
    currA[m - 1] = lambda;
    error = error * (1 - lambda * lambda);
    prevA = currA;
  }

  const ar = new Array(p).fill(0);
  for (let i = 0; i < p; i++) ar[i] = prevA[i] || 0;
  return { arCoeffs: ar, reflection: refl, error };
}

export function estimateAR(signal, order) {
  const p = Math.max(0, Math.floor(order || 0));
  if (!Array.isArray(signal) || signal.length === 0 || p === 0) return { arCoeffs: [], reflection: [], error: 0 };
  const r = autocorrelation(signal, p);
  return levinsonDurbin(r, p);
}

export function applyARPredict(signal, arCoeffs) {
  if (!Array.isArray(signal) || signal.length === 0) return { prediction: [], errorSignal: [] };
  const p = (arCoeffs && arCoeffs.length) || 0;
  const N = signal.length;
  const pred = new Array(N).fill(0);
  const err = new Array(N).fill(0);

  for (let n = 0; n < N; n++) {
    let y = 0;
    for (let k = 1; k <= p; k++) {
      const idx = n - k;
      const xnk = idx >= 0 ? signal[idx] : 0;
      y += (arCoeffs[k - 1] || 0) * xnk;
    }
    pred[n] = y;
    err[n] = signal[n] - y;
  }

  return { prediction: pred, errorSignal: err };
}

export function arPSD(arCoeffs, noiseVariance = 1, nfft = 512, fs = 1) {
  const p = (arCoeffs && arCoeffs.length) || 0;
  const freqs = new Array(nfft).fill(0).map((_, i) => (i * fs) / nfft);
  const psd = new Array(nfft).fill(0);

  for (let i = 0; i < nfft; i++) {
    const f = freqs[i];
    const omega = (-2 * Math.PI * f) / fs;
    let real = 1;
    let imag = 0;
    for (let k = 1; k <= p; k++) {
      const a = arCoeffs[k - 1] || 0;
      const angle = omega * k;
      real -= a * Math.cos(angle);
      imag -= a * Math.sin(angle);
    }
    const denom = real * real + imag * imag;
    psd[i] = denom === 0 ? 0 : noiseVariance / denom;
  }
  return { freqs, psd };
}

export function simulateAR(arCoeffs, noiseStd = 1, length = 1024, seed = null) {
  const p = (arCoeffs && arCoeffs.length) || 0;
  const out = new Array(length).fill(0);
  let rand = Math.random;
  if (typeof seed === "number") {
    let s = seed >>> 0;
    rand = () => {
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  }

  for (let n = 0; n < length; n++) {
    let wn = (rand() * 2 - 1) * noiseStd;
    let val = wn;
    for (let k = 1; k <= p; k++) {
      const idx = n - k;
      const prev = idx >= 0 ? out[idx] : 0;
      val += (arCoeffs[k - 1] || 0) * prev;
    }
    out[n] = val;
  }
  return out;
}

export function demoARExperiment({
  reference = null,
  noisy = null,
  arOrder = 8,
  noiseStd = 0.1,
  estimateFromNoisy = true,
  nfft = 512,
  fs = 1,
  seed = null,
} = {}) {
  if (!Array.isArray(reference) && !Array.isArray(noisy)) return { error: "Provide `reference` or `noisy` array" };
  const N = Array.isArray(reference) ? reference.length : noisy.length;
  let noisySignal = Array.isArray(noisy) ? noisy.slice(0, N) : null;

  if (!noisySignal && Array.isArray(reference)) {
    let rand = Math.random;
    if (typeof seed === "number") {
      let s = seed >>> 0;
      rand = () => {
        s = (1664525 * s + 1013904223) >>> 0;
        return s / 0xffffffff;
      };
    }
    noisySignal = new Array(N);
    for (let i = 0; i < N; i++) noisySignal[i] = reference[i] + (rand() * 2 - 1) * noiseStd;
  }

  const toEstimate = estimateFromNoisy ? noisySignal : Array.isArray(reference) ? reference : noisySignal;
  const { arCoeffs, reflection, error } = estimateAR(toEstimate, arOrder);
  const { prediction, errorSignal } = applyARPredict(noisySignal, arCoeffs);
  const mse = Array.isArray(reference) ? calculateMSE(reference, prediction) : null;

  let noiseVar = 1;
  if (Array.isArray(errorSignal) && errorSignal.length > 0) {
    let acc = 0;
    for (let i = 0; i < errorSignal.length; i++) acc += errorSignal[i] * errorSignal[i];
    noiseVar = acc / errorSignal.length;
  }

  const psd = arPSD(arCoeffs, noiseVar, nfft, fs);
  return {
    arCoeffs,
    reflection,
    modelError: error,
    prediction,
    errorSignal,
    mse,
    psd,
    noisy: noisySignal,
    reference,
  };
}

export function computePolesSimple(arCoeffs) {
  const p = (arCoeffs && arCoeffs.length) || 0;
  if (p === 0) return { poles: [], stable: true };
  if (p === 1) {
    const z = -arCoeffs[0];
    return { poles: [{ re: z, im: 0 }], stable: Math.abs(z) < 1 };
  }
  if (p === 2) {
    const a1 = arCoeffs[0] || 0;
    const a2 = arCoeffs[1] || 0;
    const disc = a1 * a1 - 4 * a2;
    if (disc >= 0) {
      const r1 = (-a1 + Math.sqrt(disc)) / 2;
      const r2 = (-a1 - Math.sqrt(disc)) / 2;
      return { poles: [{ re: r1, im: 0 }, { re: r2, im: 0 }], stable: Math.abs(r1) < 1 && Math.abs(r2) < 1 };
    }
    const re = -a1 / 2;
    const im = Math.sqrt(-disc) / 2;
    const mag = Math.sqrt(re * re + im * im);
    return { poles: [{ re, im }, { re, im: -im }], stable: mag < 1 };
  }
  return { poles: null, stable: null };
}
